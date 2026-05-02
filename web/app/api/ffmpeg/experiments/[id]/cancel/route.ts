export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function POST(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const _id = new ObjectId(id);
    const experiment = await db.collection("ffmpegExperiments").findOne({ _id });
    if (!experiment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (experiment.status === "completed" || experiment.status === "failed" || experiment.status === "cancelled") {
        return NextResponse.json({ error: "Experiment is no longer running" }, { status: 400 });
    }

    const pid = typeof experiment.workerPid === "number" ? experiment.workerPid : null;

    await db.collection("ffmpegExperiments").updateOne(
        { _id },
        {
            $set: {
                status: "cancelled",
                currentStep: "Cancelled",
                cancelRequestedAt: new Date(),
                workerPid: null,
                updatedAt: new Date(),
            },
            $push: {
                logs: {
                    message: "Cancellation requested",
                    createdAt: new Date().toISOString(),
                },
            },
        },
    );

    if (pid) {
        try {
            process.kill(-pid, "SIGTERM");
        } catch {
            try {
                process.kill(pid, "SIGTERM");
            } catch {
                // process may already be gone
            }
        }
    }

    const updated = await db.collection("ffmpegExperiments").findOne({ _id });
    return NextResponse.json({ ...updated, _id: updated?._id.toString() });
}
