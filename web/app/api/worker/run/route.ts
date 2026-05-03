export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runAutoclip } from "@/lib/worker";

export async function POST() {
    try {
        const result = await runAutoclip();
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
