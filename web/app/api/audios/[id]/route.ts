export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import * as fs from "fs";

export async function DELETE(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) return new NextResponse(null, { status: 400 });
        const db = await getDb();
        const doc = await db.collection("audios").findOne({ _id: new ObjectId(id) });
        if (doc?.filePath && fs.existsSync(doc.filePath as string)) {
            fs.unlinkSync(doc.filePath as string);
        }
        await db.collection("audios").deleteOne({ _id: new ObjectId(id) });
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
        await db.collection("audios").updateOne(
            { _id: new ObjectId(id) },
            { $set: { name, updatedAt: new Date() } },
        );
        const updated = await db.collection("audios").findOne({ _id: new ObjectId(id) });
        return NextResponse.json({ ...updated, _id: updated?._id.toString() });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
