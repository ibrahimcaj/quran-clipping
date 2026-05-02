export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const db = await getDb();
  const account = await db.collection("accounts").findOne({ type: "youtube" });
  if (!account) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, channel: { name: account.name, icon: account.icon } });
}
