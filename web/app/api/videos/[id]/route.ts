export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";
import { buildVideoFilePath, buildVideoFramesDir, ensureDir } from "@/lib/storage";

export async function DELETE(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) return new NextResponse(null, { status: 400 });
        const db = await getDb();
        const doc = await db.collection("videos").findOne({ _id: new ObjectId(id) });
        if (doc?.filePath && fs.existsSync(doc.filePath as string)) {
            fs.unlinkSync(doc.filePath as string);
        }
        if (doc?.tempUploadPath && fs.existsSync(doc.tempUploadPath as string)) {
            fs.unlinkSync(doc.tempUploadPath as string);
        }
        if (doc?.name) {
            const framesDir = buildVideoFramesDir(id, String(doc.name));
            if (fs.existsSync(framesDir)) {
                fs.rmSync(framesDir, { recursive: true, force: true });
            }
        }
        await db.collection("videos").deleteOne({ _id: new ObjectId(id) });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

        const body = await req.json() as { name?: string };
        const name = body.name?.trim();
        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const db = await getDb();
        const _id = new ObjectId(id);
        const existing = await db.collection("videos").findOne({ _id });
        if (!existing) {
            return NextResponse.json({ error: "Video not found" }, { status: 404 });
        }

        const nextFilePath = buildVideoFilePath(id, name);
        const previousFramesDir = buildVideoFramesDir(id, String(existing.name ?? id));
        const nextFramesDir = buildVideoFramesDir(id, name);

        if (existing.filePath && typeof existing.filePath === "string" && existing.filePath !== nextFilePath && fs.existsSync(existing.filePath)) {
            ensureDir(path.dirname(nextFilePath));
            fs.renameSync(existing.filePath, nextFilePath);
        }

        if (previousFramesDir !== nextFramesDir && fs.existsSync(previousFramesDir)) {
            ensureDir(path.dirname(nextFramesDir));
            fs.renameSync(previousFramesDir, nextFramesDir);
        }

        await db.collection("videos").updateOne(
            { _id },
            { $set: { name, filePath: nextFilePath, updatedAt: new Date() } },
        );
        const updated = await db.collection("videos").findOne({ _id });
        return NextResponse.json({ ...updated, _id: updated?._id.toString() });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
