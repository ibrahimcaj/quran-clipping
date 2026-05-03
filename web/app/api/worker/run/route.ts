export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runAutoclip } from "@/lib/worker";

export async function POST() {
    try {
        void runAutoclip();
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
