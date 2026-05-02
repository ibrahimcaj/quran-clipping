export const dynamic = "force-dynamic";

import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { OVERLAY_BLEND_MODES, type ExperimentOperation, type OverlayBlendMode } from "@/lib/ffmpeg-experiments";
import {
    resolveExperimentOutputState,
    serializeExperiment,
} from "@/lib/ffmpeg-experiment-output";

type ExperimentStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export async function GET() {
    try {
        const db = await getDb();
        const collection = db.collection("ffmpegExperiments");
        const experiments = await collection.find().sort({ createdAt: -1 }).limit(20).toArray();
        const resolved = await Promise.all(
            experiments.map((item) => resolveExperimentOutputState(collection, item)),
        );
        return NextResponse.json(
            resolved
                .filter((item) => item.doc)
                .map((item) => serializeExperiment(item.doc!, item.hasOutputFile)),
        );
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            operation: ExperimentOperation;
            overlayId?: string | null;
            overlayBlendMode?: OverlayBlendMode;
            verseKey?: string | null;
            recitationId?: string | null;
        };

        if (!["pipeline", "mix_random_verse"].includes(body.operation)) {
            return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
        }
        if (body.overlayId && !ObjectId.isValid(body.overlayId)) {
            return NextResponse.json({ error: "Invalid overlay id" }, { status: 400 });
        }
        if (body.overlayBlendMode && !OVERLAY_BLEND_MODES.includes(body.overlayBlendMode)) {
            return NextResponse.json({ error: "Unsupported overlay blend mode" }, { status: 400 });
        }
        if (body.verseKey && typeof body.verseKey !== "string") {
            return NextResponse.json({ error: "Invalid verse key" }, { status: 400 });
        }
        if (body.recitationId && typeof body.recitationId !== "string") {
            return NextResponse.json({ error: "Invalid recitation id" }, { status: 400 });
        }
        if ((body.verseKey && !body.recitationId) || (!body.verseKey && body.recitationId)) {
            return NextResponse.json({ error: "verseKey and recitationId must be provided together" }, { status: 400 });
        }
        if (body.operation === "mix_random_verse" && (!body.verseKey || !body.recitationId)) {
            return NextResponse.json(
                { error: "mix_random_verse requires a verse selected in the UI" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const videoCount = await db.collection("videos").countDocuments();
        if (videoCount === 0) {
            return NextResponse.json({ error: "Upload at least one video first" }, { status: 400 });
        }
        const videoConfig = await db
            .collection("configuration")
            .findOne({ type: "video" });
        const requestedOverlayId = body.overlayId ?? (typeof videoConfig?.overlayId === "string" ? videoConfig.overlayId : null);
        const requestedOverlayBlendMode = body.overlayBlendMode
            ?? (
                typeof videoConfig?.overlayBlendMode === "string" && OVERLAY_BLEND_MODES.includes(videoConfig.overlayBlendMode as OverlayBlendMode)
                    ? videoConfig.overlayBlendMode as OverlayBlendMode
                    : "normal"
            );
        let overlayName: string | null = null;
        if (requestedOverlayId) {
            const overlay = await db.collection("overlays").findOne({ _id: new ObjectId(requestedOverlayId) });
            if (!overlay) {
                return NextResponse.json({ error: "Selected overlay not found" }, { status: 400 });
            }
            overlayName = (overlay.name as string | undefined) ?? (overlay.originalFilename as string | undefined) ?? null;
        }

        const doc = {
            operation: body.operation,
            status: "queued" as ExperimentStatus,
            currentStep: "Queued",
            sourceVideoNames: [] as string[],
            sourceVideoCount: 0,
            lutId: null,
            overlayId: requestedOverlayId ? new ObjectId(requestedOverlayId) : null,
            overlayName,
            overlayBlendMode: requestedOverlayId ? requestedOverlayBlendMode : null,
            recitationId: body.recitationId ?? null,
            reciterName: null,
            verseKey: body.verseKey ?? null,
            verseText: null,
            outputPath: null,
            outputName: null,
            outputCreatedAt: null,
            outputExpiredAt: null,
            uploads: [],
            logs: [
                {
                    message: "Queued",
                    createdAt: new Date().toISOString(),
                },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const insert = await db.collection("ffmpegExperiments").insertOne(doc);
        const experimentId = insert.insertedId.toString();

        const child = spawn(
            "pnpm",
            ["exec", "tsx", "scripts/ffmpeg-pipeline-runner.ts", experimentId],
            {
                cwd: process.cwd(),
                env: process.env,
                detached: true,
                stdio: "ignore",
            },
        );
        await db.collection("ffmpegExperiments").updateOne(
            { _id: insert.insertedId },
            { $set: { workerPid: child.pid, updatedAt: new Date() } },
        );
        child.unref();

        return NextResponse.json({
            ...doc,
            _id: experimentId,
            lutId: null,
            overlayId: doc.overlayId ? doc.overlayId.toString() : null,
            workerPid: child.pid,
            hasOutputFile: false,
        }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
