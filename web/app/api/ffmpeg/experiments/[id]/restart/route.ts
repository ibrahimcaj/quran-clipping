export const dynamic = "force-dynamic";

import { spawn } from "child_process";
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
  const original = await db.collection("ffmpegExperiments").findOne({ _id: new ObjectId(id) });
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = {
    operation: original.operation,
    status: "queued" as const,
    currentStep: "Queued",
    sourceVideoNames: [] as string[],
    sourceVideoCount: 0,
    lutId: null,
    overlayId: (original.overlayId as ObjectId | null | undefined) ?? null,
    overlayName: (original.overlayName as string | null | undefined) ?? null,
    overlayBlendMode: (original.overlayBlendMode as string | null | undefined) ?? null,
    // preserve verse and reciter so the pipeline reuses them
    recitationId: (original.recitationId as string | null | undefined) ?? null,
    reciterName: (original.reciterName as string | null | undefined) ?? null,
    verseKey: (original.verseKey as string | null | undefined) ?? null,
    verseText: (original.verseText as string | null | undefined) ?? null,
    outputPath: null,
    outputName: null,
    outputCreatedAt: null,
    outputExpiredAt: null,
    uploads: [],
    logs: [
      {
        message: `Restarted from experiment ${id}`,
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
    overlayId: doc.overlayId?.toString?.() ?? doc.overlayId,
    workerPid: child.pid,
    hasOutputFile: false,
  }, { status: 201 });
}
