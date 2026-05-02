export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch("https://api.quran.com/api/v4/resources/recitations", {
            next: { revalidate: 86400 }, // cache for 24 h — list rarely changes
        });
        if (!res.ok) {
            return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 });
        }
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
