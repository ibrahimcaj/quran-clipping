import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import { spawn } from "child_process";

const AUTOCLIP_INTERVAL_MS = 3600000;

declare global {
    var __workerRunning: boolean | undefined;
    var __autoclipRunning: boolean | undefined;
}

global.__workerRunning ??= false;
global.__autoclipRunning ??= false;

async function runAutoclip() {
    if (global.__autoclipRunning) return;
    global.__autoclipRunning = true;

    const jobId = new ObjectId();
    let db: Awaited<ReturnType<typeof getDb>> | null = null;

    try {
        db = await getDb();
        await db.collection("autoclipJobs").insertOne({
            _id: jobId,
            status: "processing",
            startedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const appBase = process.env.NEXT_PUBLIC_APP_URL || `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3000}`;

        const reciterCfg = await db.collection("configuration").findOne({ type: "reciters" }) as {
            enabledIds?: (string | number)[];
        } | null;
        const enabledIds = Array.isArray(reciterCfg?.enabledIds) && reciterCfg.enabledIds.length > 0
            ? reciterCfg.enabledIds.map(String)
            : ["7"];

        let verse: Record<string, unknown> | null = null;
        let recitationId = "7";
        for (let i = 0; i < 3 && !verse; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 1500));
            const rid = enabledIds[Math.floor(Math.random() * enabledIds.length)];
            const res = await fetch(`${appBase}/api/qf/verses?random=true&recitation=${rid}`);
            if (!res.ok) continue;
            const data = await res.json() as { verse?: Record<string, unknown> };
            if (data.verse) { verse = data.verse; recitationId = rid; }
        }

        if (!verse || typeof verse.verse_key !== "string") {
            await db.collection("autoclipJobs").updateOne(
                { _id: jobId },
                { $set: { status: "skipped", skippedAt: new Date(), updatedAt: new Date() } },
            );
            return;
        }

        const videos = await db.collection("videos").find({}).sort({ createdAt: -1 }).limit(1).toArray();
        if (!videos.length) throw new Error("no videos available");

        const videoId = (videos[0]._id as ObjectId).toString();
        const verseKey = verse.verse_key as string;

        const videoCfg = await db.collection("configuration").findOne({ type: "video" }) as {
            overlayId?: string;
            overlayBlendMode?: string;
        } | null;

        const experimentId = new ObjectId().toString();
        await db.collection("ffmpegExperiments").insertOne({
            _id: new ObjectId(experimentId),
            verseKey,
            recitationId,
            sourceVideoIds: [videoId],
            sourceVideoNames: [(videos[0].originalFilename as string) ?? "video"],
            overlayId: videoCfg?.overlayId ?? null,
            overlayBlendMode: videoCfg?.overlayBlendMode ?? null,
            status: "queued",
            currentStep: "Queued",
            logs: [{ message: "Auto-clip job", createdAt: new Date().toISOString() }],
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await db.collection("autoclipJobs").updateOne(
            { _id: jobId },
            { $set: { experimentId, updatedAt: new Date() } },
        );

        await new Promise<void>((resolve, reject) => {
            const proc = spawn("pnpm", [
                "exec", "tsx",
                "scripts/ffmpeg-pipeline-runner.ts",
                experimentId,
                "pipeline",
                videoId,
                verseKey,
                recitationId,
            ], { cwd: process.cwd(), env: process.env });
            proc.on("error", reject);
            proc.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error(`pipeline exited with code ${code}`));
            });
        });

        const uploadRes = await fetch(`${appBase}/api/ffmpeg/experiments/${experimentId}/upload`, {
            method: "POST",
        });
        if (!uploadRes.ok) throw new Error("upload failed");

        await db.collection("autoclipJobs").updateOne(
            { _id: jobId },
            { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date() } },
        );
    } catch (error) {
        if (db) {
            await db.collection("autoclipJobs").updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: "failed",
                        error: error instanceof Error ? error.message : String(error),
                        failedAt: new Date(),
                        updatedAt: new Date(),
                    },
                },
            ).catch(() => {});
        }
    } finally {
        global.__autoclipRunning = false;
    }
}

export function startWorker() {
    if (global.__workerRunning) return;
    global.__workerRunning = true;
    setInterval(() => void runAutoclip(), AUTOCLIP_INTERVAL_MS);
    void runAutoclip();
    console.log("[worker] started (autoclip=hourly)");
}
