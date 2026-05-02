export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
    const db = await getDb();
    const accounts = await db.collection("accounts")
        .find({ type: { $in: ["youtube", "instagram"] } })
        .sort({ connectedAt: 1 })
        .toArray();
    return NextResponse.json(
        accounts.map((a) => ({
            _id: a._id.toString(),
            type: a.type,
            channelId: a.channelId ?? "",
            igUserId: a.igUserId ?? "",
            name: a.name,
            icon: a.icon,
            connectedAt: a.connectedAt,
        })),
    );
}
