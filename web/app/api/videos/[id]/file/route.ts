export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getVideoMimeType } from "@/lib/storage";
import { ObjectId } from "mongodb";
import * as fs from "fs";

export async function GET(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return new NextResponse(null, { status: 400 });
    const db = await getDb();
    const doc = await db.collection("videos").findOne({ _id: new ObjectId(id) });
    if (!doc || !fs.existsSync(doc.filePath as string)) {
        return new NextResponse(null, { status: 404 });
    }
    const buffer = fs.readFileSync(doc.filePath as string);
    return new Response(buffer, {
        headers: {
            "Content-Type": getVideoMimeType(doc.filePath as string),
            "Content-Length": buffer.byteLength.toString(),
            "Content-Disposition": `inline; filename="${doc.originalFilename}"`,
        },
    });
}
