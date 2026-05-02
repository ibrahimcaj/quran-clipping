export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getToken, getClientId } from "@/lib/qf-token";

// Returns access_token to the client — safe because access_token is not a secret.
// QF_CLIENT_SECRET never leaves the server.
export async function GET() {
    try {
        const token = await getToken();
        return NextResponse.json({
            access_token: token,
            client_id: getClientId(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
