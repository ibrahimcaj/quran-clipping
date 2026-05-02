export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
    try {
        const db = await getDb();
        const doc = await db.collection("configuration").findOne({ type: "reciters" });
        return NextResponse.json({
            type: "reciters",
            enabledIds: (doc?.enabledIds as number[] | undefined) ?? [],
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const { enabledIds } = await req.json() as { enabledIds: number[] };
    if (!Array.isArray(enabledIds)) {
        return NextResponse.json({ error: "enabledIds must be an array" }, { status: 400 });
    }
    if (enabledIds.length === 0) {
        return NextResponse.json(
            { error: "At least one reciter must be enabled" },
            { status: 400 },
        );
    }
    const db = await getDb();
    await db.collection("configuration").updateOne(
        { type: "reciters" },
        { $set: { type: "reciters", enabledIds, updatedAt: new Date() } },
        { upsert: true },
    );
    return NextResponse.json({ ok: true });
}
