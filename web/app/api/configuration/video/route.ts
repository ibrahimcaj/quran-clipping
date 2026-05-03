export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { OVERLAY_BLEND_MODES } from "@/lib/ffmpeg-experiments";
import { DEFAULT_UPLOAD_CAPTION_TEMPLATE } from "@/lib/upload-caption";

export async function GET() {
    try {
        const db = await getDb();
        const doc = await db.collection("configuration").findOne({ type: "video" });
        return NextResponse.json({
            vignette: (doc?.vignette as number | undefined) ?? 0,
            exposure: (doc?.exposure as number | undefined) ?? 0,
            saturation: (doc?.saturation as number | undefined) ?? 1,
            overlayId: doc?.overlayId?.toString?.() ?? doc?.overlayId ?? null,
            overlayBlendMode: (doc?.overlayBlendMode as string | undefined) ?? "normal",
            audioLeadSeconds: (doc?.audioLeadSeconds as number | undefined) ?? 1.5,
            clipTailSeconds: (doc?.clipTailSeconds as number | undefined) ?? 0,
            maxVideoClipSeconds: (doc?.maxVideoClipSeconds as number | undefined) ?? 5,
            randomAyahMinSeconds: (doc?.randomAyahMinSeconds as number | undefined) ?? 0,
            randomAyahMaxSeconds: (doc?.randomAyahMaxSeconds as number | undefined) ?? 30,
            uploadCaptionTemplate:
                (doc?.uploadCaptionTemplate as string | undefined) ??
                DEFAULT_UPLOAD_CAPTION_TEMPLATE,
        });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json() as {
            vignette?: number;
            exposure?: number;
            saturation?: number;
            overlayId?: string | null;
            overlayBlendMode?: string;
            audioLeadSeconds?: number;
            clipTailSeconds?: number;
            maxVideoClipSeconds?: number;
            randomAyahMinSeconds?: number;
            randomAyahMaxSeconds?: number;
            uploadCaptionTemplate?: string;
        };
        const update: Record<string, number | string | ObjectId | null> = {};
        if (typeof body.vignette === "number") update.vignette = Math.max(0, Math.min(1, body.vignette));
        if (typeof body.exposure === "number") update.exposure = Math.max(-3, Math.min(3, body.exposure));
        if (typeof body.saturation === "number") update.saturation = Math.max(0, Math.min(3, body.saturation));
        if (body.overlayId === null || body.overlayId === "") update.overlayId = null;
        else if (typeof body.overlayId === "string") {
            if (!ObjectId.isValid(body.overlayId)) {
                return NextResponse.json({ error: "Invalid overlay id" }, { status: 400 });
            }
            update.overlayId = new ObjectId(body.overlayId);
        }
        if (typeof body.overlayBlendMode === "string") {
            if (!OVERLAY_BLEND_MODES.includes(body.overlayBlendMode as typeof OVERLAY_BLEND_MODES[number])) {
                return NextResponse.json({ error: "Invalid overlay blend mode" }, { status: 400 });
            }
            update.overlayBlendMode = body.overlayBlendMode;
        }
        if (typeof body.audioLeadSeconds === "number") {
            update.audioLeadSeconds = Math.max(0, Math.min(5, body.audioLeadSeconds));
        }
        if (typeof body.clipTailSeconds === "number") {
            update.clipTailSeconds = Math.max(-60, Math.min(60, body.clipTailSeconds));
        }
        if (typeof body.maxVideoClipSeconds === "number") {
            update.maxVideoClipSeconds = Math.max(1, Math.min(60, body.maxVideoClipSeconds));
        }
        if (typeof body.randomAyahMinSeconds === "number") {
            update.randomAyahMinSeconds = Math.max(0, Math.min(300, body.randomAyahMinSeconds));
        }
        if (typeof body.randomAyahMaxSeconds === "number") {
            update.randomAyahMaxSeconds = Math.max(0, Math.min(300, body.randomAyahMaxSeconds));
        }
        if (typeof body.uploadCaptionTemplate === "string") {
            update.uploadCaptionTemplate = body.uploadCaptionTemplate.trim() || DEFAULT_UPLOAD_CAPTION_TEMPLATE;
        }
        if (
            typeof update.randomAyahMinSeconds === "number" &&
            typeof update.randomAyahMaxSeconds === "number" &&
            update.randomAyahMinSeconds > update.randomAyahMaxSeconds
        ) {
            return NextResponse.json({ error: "Random ayah min length cannot exceed max length" }, { status: 400 });
        }
        const db = await getDb();
        await db.collection("configuration").updateOne(
            { type: "video" },
            { $set: { type: "video", ...update, updatedAt: new Date() } },
            { upsert: true },
        );
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
