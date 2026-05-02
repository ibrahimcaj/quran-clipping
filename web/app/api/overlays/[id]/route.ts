export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import { getDb } from "@/lib/mongodb";

export async function DELETE(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const db = await getDb();
        const doc = await db.collection("overlays").findOne({ _id: new ObjectId(id) });
        if (doc?.filePath && fs.existsSync(doc.filePath as string)) {
            fs.unlinkSync(doc.filePath as string);
        }

        await db.collection("overlays").deleteOne({ _id: new ObjectId(id) });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const body = await req.json() as { name?: string };
        const name = body.name?.trim();
        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const db = await getDb();
        await db.collection("overlays").updateOne(
            { _id: new ObjectId(id) },
            { $set: { name, updatedAt: new Date() } },
        );
        const updated = await db.collection("overlays").findOne({ _id: new ObjectId(id) });
        return NextResponse.json({ ...updated, _id: updated?._id.toString() });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
