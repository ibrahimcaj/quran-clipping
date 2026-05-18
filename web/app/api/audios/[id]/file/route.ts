export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getAudioMimeType } from "@/lib/storage";
import * as fs from "fs";

export async function GET(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
        return new NextResponse(null, { status: 400 });
    }

    const db = await getDb();
    const doc = await db.collection("audios").findOne({ _id: new ObjectId(id) });
    if (!doc?.filePath || !fs.existsSync(doc.filePath as string)) {
        return new NextResponse(null, { status: 404 });
    }

    const buffer = fs.readFileSync(doc.filePath as string);
    return new Response(buffer, {
        headers: {
            "Content-Type": getAudioMimeType(doc.filePath as string),
            "Content-Length": buffer.byteLength.toString(),
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
