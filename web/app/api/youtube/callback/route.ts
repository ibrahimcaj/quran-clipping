export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: process.env.YOUTUBE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  if (!tokens.refresh_token) return NextResponse.json({ error: "No refresh token — revoke app access in Google account and retry" }, { status: 400 });

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const channelData = await channelRes.json() as { items?: { id: string; snippet: { title: string; thumbnails: { default: { url: string } } } }[] };
  const item = channelData.items?.[0];
  if (!item) return NextResponse.json({ error: "Could not fetch channel info" }, { status: 400 });

  const db = await getDb();
  await db.collection("accounts").updateOne(
    { type: "youtube", channelId: item.id },
    {
      $set: {
        type: "youtube",
        channelId: item.id,
        name: item.snippet.title,
        icon: item.snippet.thumbnails.default.url,
        tokens,
        connectedAt: new Date(),
      }
    },
    { upsert: true }
  );

  const base = process.env.YOUTUBE_REDIRECT_URI!.replace("/api/youtube/callback", "");
  return NextResponse.redirect(new URL("/", base));
}
