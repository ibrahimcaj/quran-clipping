export const dynamic = "force-dynamic";

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { LUT_PREVIEWS_DIR, ensureDir } from "@/lib/storage";

function escapeFilterPath(filePath: string) {
    return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function ffprobeDuration(inputPath: string) {
    return new Promise<number>((resolve, reject) => {
        const proc = spawn("ffprobe", [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            inputPath,
        ]);

        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
        proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || "ffprobe failed"));
                return;
            }
            const seconds = Number.parseFloat(stdout.trim());
            if (!Number.isFinite(seconds) || seconds <= 0) {
                reject(new Error("Invalid duration"));
                return;
            }
            resolve(seconds);
        });
    });
}

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
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const db = await getDb();
        const lut = await db.collection("luts").findOne({ _id: new ObjectId(id) });
        if (!lut?.filePath || !fs.existsSync(lut.filePath as string)) {
            return NextResponse.json({ error: "LUT not found" }, { status: 404 });
        }

        const videos = await db.collection("videos").find({ filePath: { $exists: true } }).toArray();
        const available = videos.filter((video) => typeof video.filePath === "string" && fs.existsSync(video.filePath));
        if (available.length === 0) {
            return NextResponse.json({ error: "Upload at least one video to preview LUTs" }, { status: 400 });
        }

        const video = available[Math.floor(Math.random() * available.length)];
        const durationSeconds = typeof video.durationSeconds === "number" && video.durationSeconds > 0
            ? video.durationSeconds
            : await ffprobeDuration(video.filePath as string);
        if (typeof video.durationSeconds !== "number") {
            await db.collection("videos").updateOne(
                { _id: video._id },
                { $set: { durationSeconds, updatedAt: new Date() } },
            );
        }

        ensureDir(LUT_PREVIEWS_DIR);
        const previewPath = path.join(
            LUT_PREVIEWS_DIR,
            `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
        );
        const seekSeconds = Math.max(0, Math.min(durationSeconds - 0.1, Math.random() * Math.max(durationSeconds - 0.1, 0)));

        await runFfmpeg([
            "-y",
            "-ss", seekSeconds.toFixed(3),
            "-i", video.filePath as string,
            "-frames:v", "1",
            "-vf",
            `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1,lut3d=file='${escapeFilterPath(lut.filePath as string)}'`,
            "-q:v", "2",
            previewPath,
        ]);

        const buffer = fs.readFileSync(previewPath);
        fs.rmSync(previewPath, { force: true });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
