export const dynamic = "force-dynamic";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
    VIDEOS_DIR,
    VIDEO_UPLOADS_DIR,
    ensureDir,
    getSafeVideoExtension,
    buildVideoFilePath,
} from "@/lib/storage";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
    try {
        const db = await getDb();
        const videos = await db.collection("videos").find().sort({ createdAt: -1 }).toArray();
        return NextResponse.json(videos.map((v) => ({ ...v, _id: v._id.toString() })));
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("video") as File | null;
        if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

        const ext = getSafeVideoExtension(file.name);
        if (!ext) return NextResponse.json({ error: "unsupported file type" }, { status: 400 });

        ensureDir(VIDEOS_DIR);
        ensureDir(VIDEO_UPLOADS_DIR);

        const db = await getDb();
        const _id = new ObjectId();
        const tempUploadPath = path.join(VIDEO_UPLOADS_DIR, `${_id.toString()}${ext}`);
        const baseName = path.basename(file.name, ext);
        const dest = buildVideoFilePath(_id.toString(), baseName);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(tempUploadPath, buffer);

        const doc = {
            _id,
            name: baseName,
            originalFilename: file.name,
            filePath: dest,
            tempUploadPath,
            mimeType: "video/mp4",
            sizeBytes: 0,
            status: "queued",
            currentStep: "Queued",
            logs: [
                {
                    message: "Queued",
                    createdAt: new Date().toISOString(),
                },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection("videos").insertOne(doc);

        const child = spawn(
            "pnpm",
            ["exec", "tsx", "scripts/video-upload-processor.ts", _id.toString()],
            {
                cwd: process.cwd(),
                env: process.env,
                detached: true,
                stdio: "ignore",
            },
        );
        child.unref();

        return NextResponse.json({ ...doc, _id: _id.toString() }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
