export const dynamic = "force-dynamic";

import * as fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { resolveExperimentOutputState } from "@/lib/ffmpeg-experiment-output";

export async function GET(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return new NextResponse(null, { status: 400 });

    const db = await getDb();
    const collection = db.collection("ffmpegExperiments");
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    const resolved = await resolveExperimentOutputState(collection, doc);
    if (
        !resolved.doc?.outputPath ||
        typeof resolved.doc.outputPath !== "string" ||
        !resolved.hasOutputFile
    ) {
        return new NextResponse(null, { status: 404 });
    }

    const buffer = fs.readFileSync(resolved.doc.outputPath);
    return new Response(buffer, {
        headers: {
            "Content-Type": "video/mp4",
            "Content-Length": buffer.byteLength.toString(),
            "Content-Disposition": `inline; filename="${resolved.doc.outputName}"`,
        },
    });
}
