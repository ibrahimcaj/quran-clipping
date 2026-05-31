export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import {
    DEFAULT_ACCOUNT_VIDEO_CONFIG,
    sanitizeAccountConfigPatch,
} from "@/lib/account-config";

export async function GET() {
    try {
        const db = await getDb();
        const doc = await db.collection("configuration").findOne({ type: "video" });
        return NextResponse.json({
            vignette: (doc?.vignette as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.vignette,
            exposure: (doc?.exposure as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.exposure,
            saturation: (doc?.saturation as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.saturation,
            overlayId: doc?.overlayId?.toString?.() ?? doc?.overlayId ?? null,
            overlayBlendMode: (doc?.overlayBlendMode as string | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.overlayBlendMode,
            workerUploadIntervalMinutes:
                (doc?.workerUploadIntervalMinutes as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.workerUploadIntervalMinutes,
            audioLeadSeconds: (doc?.audioLeadSeconds as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.audioLeadSeconds,
            clipTailSeconds: (doc?.clipTailSeconds as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.clipTailSeconds,
            maxVideoClipSeconds: (doc?.maxVideoClipSeconds as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.maxVideoClipSeconds,
            randomAyahMinSeconds: (doc?.randomAyahMinSeconds as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.randomAyahMinSeconds,
            randomAyahMaxSeconds: (doc?.randomAyahMaxSeconds as number | undefined) ?? DEFAULT_ACCOUNT_VIDEO_CONFIG.randomAyahMaxSeconds,
            uploadCaptionTemplate:
                (doc?.uploadCaptionTemplate as string | undefined) ??
                DEFAULT_UPLOAD_CAPTION_TEMPLATE,
            textOpacity:
                (doc?.textOpacity as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textOpacity,
            textColor:
                (doc?.textColor as string | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textColor,
            textStrokeWidth:
                (doc?.textStrokeWidth as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textStrokeWidth,
            textStrokeColor:
                (doc?.textStrokeColor as string | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textStrokeColor,
            textGlowAlpha:
                (doc?.textGlowAlpha as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textGlowAlpha,
            textGlowSigma:
                (doc?.textGlowSigma as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textGlowSigma,
            textGlowColor:
                (doc?.textGlowColor as string | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textGlowColor,
            textInnerGlowAlpha:
                (doc?.textInnerGlowAlpha as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textInnerGlowAlpha,
            textInnerGlowSigma:
                (doc?.textInnerGlowSigma as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textInnerGlowSigma,
            arabicFontSize:
                (doc?.arabicFontSize as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.arabicFontSize,
            englishFontSize:
                (doc?.englishFontSize as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.englishFontSize,
            textBlockGap:
                (doc?.textBlockGap as number | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.textBlockGap,
            videoSelectionMode:
                (doc?.videoSelectionMode as string | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.videoSelectionMode,
            selectedVideoIds: Array.isArray(doc?.selectedVideoIds)
                ? doc.selectedVideoIds.map((value) => value?.toString?.() ?? String(value))
                : [],
            lutSelectionMode:
                (doc?.lutSelectionMode as string | undefined) ??
                DEFAULT_ACCOUNT_VIDEO_CONFIG.lutSelectionMode,
            selectedLutIds: Array.isArray(doc?.selectedLutIds)
                ? doc.selectedLutIds.map((value) => value?.toString?.() ?? String(value))
                : [],
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
            workerUploadIntervalMinutes?: number;
            audioLeadSeconds?: number;
            clipTailSeconds?: number;
            maxVideoClipSeconds?: number;
            randomAyahMinSeconds?: number;
            randomAyahMaxSeconds?: number;
            uploadCaptionTemplate?: string;
            textOpacity?: number;
            textColor?: string;
            textStrokeWidth?: number;
            textStrokeColor?: string;
            textGlowAlpha?: number;
            textGlowSigma?: number;
            textGlowColor?: string;
            textInnerGlowAlpha?: number;
            textInnerGlowSigma?: number;
            arabicFontSize?: number;
            englishFontSize?: number;
            textBlockGap?: number;
            videoSelectionMode?: string;
            selectedVideoIds?: string[];
            lutSelectionMode?: string;
            selectedLutIds?: string[];
        };
        let update: Record<
            string,
            number | string | ObjectId | null | ObjectId[]
        > = {};
        try {
            update = sanitizeAccountConfigPatch(body) as Record<
                string,
                number | string | ObjectId | null | ObjectId[]
            >;
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : String(error) },
                { status: 400 },
            );
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
