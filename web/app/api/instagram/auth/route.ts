export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const scope = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
  ].join(",");

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
  url.searchParams.set("redirect_uri", process.env.INSTAGRAM_REDIRECT_URI!);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url.toString());
}
