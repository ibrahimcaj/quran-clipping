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

        const body = await req.json() as {
            name?: string;
            defaultStartSeconds?: number;
            defaultEndSeconds?: number | null;
        };
        const name = body.name?.trim();
        if (
            typeof body.defaultStartSeconds !== "number" &&
            typeof body.defaultEndSeconds !== "number" &&
            body.defaultEndSeconds !== null &&
            !name
        ) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const update: Record<string, string | number | null | Date> = {
            updatedAt: new Date(),
        };
        if (name) {
            update.name = name;
        }
        if (typeof body.defaultStartSeconds === "number") {
            update.defaultStartSeconds = Math.max(0, body.defaultStartSeconds);
        }
        if (typeof body.defaultEndSeconds === "number") {
            update.defaultEndSeconds = Math.max(0, body.defaultEndSeconds);
        } else if (body.defaultEndSeconds === null) {
            update.defaultEndSeconds = null;
        }

        const db = await getDb();
        await db.collection("audios").updateOne(
            { _id: new ObjectId(id) },
            { $set: update },
        );
        const updated = await db.collection("audios").findOne({ _id: new ObjectId(id) });
        return NextResponse.json({ ...updated, _id: updated?._id.toString() });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
