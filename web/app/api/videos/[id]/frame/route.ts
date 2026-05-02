export const dynamic = "force-dynamic";

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { buildVideoFramesDir, ensureDir } from "@/lib/storage";

function runFfmpeg(args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", args);
        let stderr = "";
        proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr.trim() || "ffmpeg failed"));
        });
    });
}

export async function GET(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
        return new NextResponse(null, { status: 400 });
    }

    const db = await getDb();
    const doc = await db.collection("videos").findOne({ _id: new ObjectId(id) });
    if (!doc?.filePath || !fs.existsSync(doc.filePath as string)) {
        return new NextResponse(null, { status: 404 });
    }

    const framesDir = buildVideoFramesDir(id, String(doc.name ?? id));
    ensureDir(framesDir);
    const framePath = path.join(framesDir, "first.jpg");

    if (!fs.existsSync(framePath)) {
        await runFfmpeg([
            "-y",
            "-ss", "0.05",
            "-i", doc.filePath as string,
            "-frames:v", "1",
            "-vf", "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080",
            "-q:v", "2",
            framePath,
        ]);
    }

    const buffer = fs.readFileSync(framePath);
    return new Response(buffer, {
        headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": buffer.byteLength.toString(),
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
