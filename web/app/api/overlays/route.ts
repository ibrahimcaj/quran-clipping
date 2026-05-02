export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";
import { getDb } from "@/lib/mongodb";
import { OVERLAYS_DIR, ensureDir, getSafeImageExtension } from "@/lib/storage";

export async function GET() {
    try {
        const db = await getDb();
        const overlays = await db.collection("overlays").find().sort({ createdAt: -1 }).toArray();
        return NextResponse.json(overlays.map((overlay) => ({ ...overlay, _id: overlay._id.toString() })));
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("overlay") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No overlay file uploaded" }, { status: 400 });
        }

        const ext = getSafeImageExtension(file.name);
        if (!ext) {
            return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
        }

        ensureDir(OVERLAYS_DIR);

        const db = await getDb();
        const _id = new ObjectId();
        const filePath = path.join(OVERLAYS_DIR, `${_id.toString()}${ext}`);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        const doc = {
            _id,
            name: path.basename(file.name, ext),
            originalFilename: file.name,
            filePath,
            sizeBytes: buffer.byteLength,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection("overlays").insertOne(doc);
        return NextResponse.json({ ...doc, _id: _id.toString() }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
