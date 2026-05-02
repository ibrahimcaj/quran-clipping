export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const db = await getDb();
    await req.json().catch(() => null);
    await db.collection("accounts").updateOne(
        { _id: new ObjectId(id) },
        { $set: { updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const db = await getDb();
    await db.collection("accounts").deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
}
