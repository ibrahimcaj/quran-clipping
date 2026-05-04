import { ObjectId, type Db } from "mongodb";
import {
    OVERLAY_BLEND_MODES,
    type OverlayBlendMode,
} from "@/lib/ffmpeg-experiments";
import { DEFAULT_UPLOAD_CAPTION_TEMPLATE } from "@/lib/upload-caption";

export type AccountVideoConfig = {
    vignette: number;
    exposure: number;
    saturation: number;
    overlayId: string | null;
    overlayBlendMode: OverlayBlendMode;
    workerUploadIntervalMinutes: number;
    audioLeadSeconds: number;
    clipTailSeconds: number;
    maxVideoClipSeconds: number;
    randomAyahMinSeconds: number;
    randomAyahMaxSeconds: number;
    uploadCaptionTemplate: string;
    textOpacity: number;
    textColor: string;
    textStrokeWidth: number;
    textStrokeColor: string;
    textGlowAlpha: number;
    textGlowSigma: number;
    textGlowColor: string;
    textInnerGlowAlpha: number;
    textInnerGlowSigma: number;
    videoSelectionMode: "all" | "specific";
    selectedVideoIds: string[];
    lutSelectionMode: "all" | "specific";
    selectedLutIds: string[];
};

export type AccountConfig = AccountVideoConfig & {
    enabledIds: number[];
};

type VideoConfigDoc = {
    vignette?: number;
    exposure?: number;
    saturation?: number;
    overlayId?: ObjectId | string | null;
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
    videoSelectionMode?: string;
    selectedVideoIds?: (ObjectId | string)[];
    lutSelectionMode?: string;
    selectedLutIds?: (ObjectId | string)[];
};

type AccountConfigDoc = {
    accountId: ObjectId;
    enabledIds?: number[];
    vignette?: number;
    exposure?: number;
    saturation?: number;
    overlayId?: ObjectId | string | null;
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
    videoSelectionMode?: string;
    selectedVideoIds?: (ObjectId | string)[];
    lutSelectionMode?: string;
    selectedLutIds?: (ObjectId | string)[];
};

export const DEFAULT_ACCOUNT_VIDEO_CONFIG: AccountVideoConfig = {
    vignette: 0,
    exposure: 0,
    saturation: 1,
    overlayId: null,
    overlayBlendMode: "normal",
    workerUploadIntervalMinutes: 60,
    audioLeadSeconds: 1.5,
    clipTailSeconds: 0,
    maxVideoClipSeconds: 5,
    randomAyahMinSeconds: 0,
    randomAyahMaxSeconds: 30,
    uploadCaptionTemplate: DEFAULT_UPLOAD_CAPTION_TEMPLATE,
    textOpacity: 1,
    textColor: "#FFFFFF",
    textStrokeWidth: 0,
    textStrokeColor: "#000000",
    textGlowAlpha: 1,
    textGlowSigma: 100,
    textGlowColor: "#0E3A72",
    textInnerGlowAlpha: 0.7,
    textInnerGlowSigma: 6,
    videoSelectionMode: "all",
    selectedVideoIds: [],
    lutSelectionMode: "all",
    selectedLutIds: [],
};

function normalizeHexColor(
    value: unknown,
    fallback: string,
) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return /^#?[0-9a-fA-F]{6}$/.test(trimmed)
        ? `#${trimmed.replace(/^#/, "").toUpperCase()}`
        : fallback;
}

function normalizeVideoConfig(doc?: VideoConfigDoc | null): AccountVideoConfig {
    return {
        vignette:
            typeof doc?.vignette === "number" ? doc.vignette : 0,
        exposure:
            typeof doc?.exposure === "number" ? doc.exposure : 0,
        saturation:
            typeof doc?.saturation === "number" ? doc.saturation : 1,
        overlayId:
            doc?.overlayId?.toString?.() ?? doc?.overlayId ?? null,
        overlayBlendMode:
            typeof doc?.overlayBlendMode === "string" &&
            OVERLAY_BLEND_MODES.includes(
                doc.overlayBlendMode as OverlayBlendMode,
            )
                ? (doc.overlayBlendMode as OverlayBlendMode)
                : "normal",
        workerUploadIntervalMinutes:
            typeof doc?.workerUploadIntervalMinutes === "number"
                ? doc.workerUploadIntervalMinutes
                : 60,
        audioLeadSeconds:
            typeof doc?.audioLeadSeconds === "number"
                ? doc.audioLeadSeconds
                : 1.5,
        clipTailSeconds:
            typeof doc?.clipTailSeconds === "number" ? doc.clipTailSeconds : 0,
        maxVideoClipSeconds:
            typeof doc?.maxVideoClipSeconds === "number"
                ? doc.maxVideoClipSeconds
                : 5,
        randomAyahMinSeconds:
            typeof doc?.randomAyahMinSeconds === "number"
                ? doc.randomAyahMinSeconds
                : 0,
        randomAyahMaxSeconds:
            typeof doc?.randomAyahMaxSeconds === "number"
                ? doc.randomAyahMaxSeconds
                : 30,
        uploadCaptionTemplate:
            typeof doc?.uploadCaptionTemplate === "string" &&
            doc.uploadCaptionTemplate.trim().length > 0
                ? doc.uploadCaptionTemplate
                : DEFAULT_UPLOAD_CAPTION_TEMPLATE,
        textOpacity:
            typeof doc?.textOpacity === "number" ? doc.textOpacity : 1,
        textColor: normalizeHexColor(doc?.textColor, "#FFFFFF"),
        textStrokeWidth:
            typeof doc?.textStrokeWidth === "number" ? doc.textStrokeWidth : 0,
        textStrokeColor: normalizeHexColor(doc?.textStrokeColor, "#000000"),
        textGlowAlpha:
            typeof doc?.textGlowAlpha === "number" ? doc.textGlowAlpha : 1,
        textGlowSigma:
            typeof doc?.textGlowSigma === "number" ? doc.textGlowSigma : 100,
        textGlowColor: normalizeHexColor(doc?.textGlowColor, "#0E3A72"),
        textInnerGlowAlpha:
            typeof doc?.textInnerGlowAlpha === "number"
                ? doc.textInnerGlowAlpha
                : 0.7,
        textInnerGlowSigma:
            typeof doc?.textInnerGlowSigma === "number"
                ? doc.textInnerGlowSigma
                : 6,
        videoSelectionMode:
            doc?.videoSelectionMode === "specific" ? "specific" : "all",
        selectedVideoIds: Array.isArray(doc?.selectedVideoIds)
            ? doc.selectedVideoIds.map((value) => String(value))
            : [],
        lutSelectionMode:
            doc?.lutSelectionMode === "specific" ? "specific" : "all",
        selectedLutIds: Array.isArray(doc?.selectedLutIds)
            ? doc.selectedLutIds.map((value) => String(value))
            : [],
    };
}

export async function getGlobalAccountConfig(db: Db): Promise<AccountConfig> {
    const [recitersDoc, videoDoc] = await Promise.all([
        db.collection("configuration").findOne({ type: "reciters" }),
        db.collection("configuration").findOne({ type: "video" }),
    ]);
    return {
        enabledIds: Array.isArray(recitersDoc?.enabledIds)
            ? (recitersDoc.enabledIds as number[])
            : [],
        ...normalizeVideoConfig(videoDoc as VideoConfigDoc | null),
    };
}

export async function getMergedAccountConfig(
    db: Db,
    accountId: string,
): Promise<AccountConfig> {
    const base = await getGlobalAccountConfig(db);
    const accountDoc = (await db.collection("accountConfigurations").findOne({
        accountId: new ObjectId(accountId),
    })) as AccountConfigDoc | null;

    if (!accountDoc) {
        return base;
    }

    return {
        ...base,
        ...normalizeVideoConfig(accountDoc),
        enabledIds: Array.isArray(accountDoc.enabledIds)
            ? accountDoc.enabledIds
            : base.enabledIds,
    };
}

export function sanitizeAccountConfigPatch(body: {
    enabledIds?: number[];
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
    videoSelectionMode?: string;
    selectedVideoIds?: string[];
    lutSelectionMode?: string;
    selectedLutIds?: string[];
}) {
    const update: Record<
        string,
        number | string | ObjectId | null | number[] | ObjectId[]
    > =
        {};
    if (Array.isArray(body.enabledIds)) {
        update.enabledIds = body.enabledIds.map((id) => Math.round(id));
    }
    if (typeof body.vignette === "number") {
        update.vignette = Math.max(0, Math.min(1, body.vignette));
    }
    if (typeof body.exposure === "number") {
        update.exposure = Math.max(-3, Math.min(3, body.exposure));
    }
    if (typeof body.saturation === "number") {
        update.saturation = Math.max(0, Math.min(3, body.saturation));
    }
    if (body.overlayId === null || body.overlayId === "") {
        update.overlayId = null;
    } else if (typeof body.overlayId === "string") {
        if (!ObjectId.isValid(body.overlayId)) {
            throw new Error("Invalid overlay id");
        }
        update.overlayId = new ObjectId(body.overlayId);
    }
    if (typeof body.overlayBlendMode === "string") {
        if (
            !OVERLAY_BLEND_MODES.includes(
                body.overlayBlendMode as OverlayBlendMode,
            )
        ) {
            throw new Error("Invalid overlay blend mode");
        }
        update.overlayBlendMode = body.overlayBlendMode;
    }
    if (typeof body.workerUploadIntervalMinutes === "number") {
        update.workerUploadIntervalMinutes = Math.max(
            1,
            Math.min(1440, Math.round(body.workerUploadIntervalMinutes)),
        );
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
        update.uploadCaptionTemplate =
            body.uploadCaptionTemplate.trim() || DEFAULT_UPLOAD_CAPTION_TEMPLATE;
    }
    if (typeof body.textOpacity === "number") {
        update.textOpacity = Math.max(0, Math.min(1, body.textOpacity));
    }
    if (typeof body.textColor === "string") {
        update.textColor = normalizeHexColor(body.textColor, "#FFFFFF");
    }
    if (typeof body.textStrokeWidth === "number") {
        update.textStrokeWidth = Math.max(0, Math.min(20, body.textStrokeWidth));
    }
    if (typeof body.textStrokeColor === "string") {
        update.textStrokeColor = normalizeHexColor(body.textStrokeColor, "#000000");
    }
    if (typeof body.textGlowAlpha === "number") {
        update.textGlowAlpha = Math.max(0, Math.min(1, body.textGlowAlpha));
    }
    if (typeof body.textGlowSigma === "number") {
        update.textGlowSigma = Math.max(0, Math.min(300, body.textGlowSigma));
    }
    if (typeof body.textGlowColor === "string") {
        update.textGlowColor = normalizeHexColor(body.textGlowColor, "#0E3A72");
    }
    if (typeof body.textInnerGlowAlpha === "number") {
        update.textInnerGlowAlpha = Math.max(0, Math.min(1, body.textInnerGlowAlpha));
    }
    if (typeof body.textInnerGlowSigma === "number") {
        update.textInnerGlowSigma = Math.max(0, Math.min(300, body.textInnerGlowSigma));
    }
    if (typeof body.videoSelectionMode === "string") {
        update.videoSelectionMode =
            body.videoSelectionMode === "specific" ? "specific" : "all";
    }
    if (Array.isArray(body.selectedVideoIds)) {
        update.selectedVideoIds = body.selectedVideoIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));
    }
    if (typeof body.lutSelectionMode === "string") {
        update.lutSelectionMode =
            body.lutSelectionMode === "specific" ? "specific" : "all";
    }
    if (Array.isArray(body.selectedLutIds)) {
        update.selectedLutIds = body.selectedLutIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));
    }

    if (
        typeof update.randomAyahMinSeconds === "number" &&
        typeof update.randomAyahMaxSeconds === "number" &&
        update.randomAyahMinSeconds > update.randomAyahMaxSeconds
    ) {
        throw new Error("Random ayah min length cannot exceed max length");
    }

    return update;
}
