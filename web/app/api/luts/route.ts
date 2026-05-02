export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { LUTS_DIR, ensureDir, getSafeLutExtension } from "@/lib/storage";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
    try {
        const db = await getDb();
        const luts = await db.collection("luts").find().sort({ createdAt: -1 }).toArray();
        return NextResponse.json(luts.map((l) => ({ ...l, _id: l._id.toString() })));
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("lut") as File | null;
        if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

        const ext = getSafeLutExtension(file.name);
        if (!ext) return NextResponse.json({ error: "unsupported file type" }, { status: 400 });

        ensureDir(LUTS_DIR);

        const db = await getDb();
        const _id = new ObjectId();
        const dest = path.join(LUTS_DIR, `${_id.toString()}${ext}`);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(dest, buffer);

        const doc = {
            _id,
            name: path.basename(file.name, ext),
            originalFilename: file.name,
            filePath: dest,
            sizeBytes: buffer.byteLength,
            createdAt: new Date(),
        };
        await db.collection("luts").insertOne(doc);
        return NextResponse.json({ ...doc, _id: _id.toString() }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
