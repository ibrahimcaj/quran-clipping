export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const tokenRes = await fetch(`${GRAPH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.json({ error: `Token exchange failed: ${JSON.stringify(tokenData)}` }, { status: 400 });
  }

  const llRes = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`,
  );
  const llData = await llRes.json();
  const accessToken: string = llData.access_token ?? tokenData.access_token;

  const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${accessToken}`);
  const pagesData = await pagesRes.json();
  const pages: { id: string; name: string; access_token: string }[] = pagesData.data ?? [];

  if (!pages.length) {
    return NextResponse.json({ error: "No Facebook Pages found. Make sure your account manages at least one Page linked to an Instagram Business/Creator account." }, { status: 400 });
  }

  const db = await getDb();
  let connected = 0;

  for (const page of pages) {
    const igRes = await fetch(
      `${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
    );
    const igData = await igRes.json();
    const igId: string | undefined = igData.instagram_business_account?.id;
    if (!igId) continue;

    const profileRes = await fetch(
      `${GRAPH}/${igId}?fields=name,username,profile_picture_url&access_token=${accessToken}`,
    );
    const profile = await profileRes.json();

    await db.collection("accounts").updateOne(
      { type: "instagram", igUserId: igId },
      {
        $set: {
          type: "instagram",
          igUserId: igId,
          name: profile.name ?? profile.username ?? page.name,
          icon: profile.profile_picture_url ?? "",
          accessToken,
          connectedAt: new Date(),
        },
      },
      { upsert: true },
    );
    connected++;
  }

  if (!connected) {
    return NextResponse.json({
      error: "No Instagram Business/Creator accounts linked to your Pages. Convert your Instagram account to Business or Creator in Instagram settings.",
    }, { status: 400 });
  }

  const base = process.env.INSTAGRAM_REDIRECT_URI!.replace("/api/instagram/callback", "");
  return NextResponse.redirect(new URL("/", base));
}
