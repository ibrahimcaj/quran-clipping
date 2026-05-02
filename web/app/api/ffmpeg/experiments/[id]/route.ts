export const dynamic = "force-dynamic";

import * as fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
    deleteExperimentOutputDirectory,
    resolveExperimentOutputState,
    serializeExperiment,
} from "@/lib/ffmpeg-experiment-output";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const collection = db.collection("ffmpegExperiments");
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  const resolved = await resolveExperimentOutputState(collection, doc);
  if (!resolved.doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeExperiment(resolved.doc, resolved.hasOutputFile));
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const collection = db.collection("ffmpegExperiments");
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  await collection.deleteOne({ _id: new ObjectId(id) });

  if (doc?.outputPath && typeof doc.outputPath === "string") {
    if (fs.existsSync(doc.outputPath)) {
      deleteExperimentOutputDirectory(doc.outputPath);
    }
  }

  return NextResponse.json({ ok: true });
}
