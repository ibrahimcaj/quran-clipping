export const dynamic = "force-dynamic";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { type OverlayBlendMode } from "@/lib/ffmpeg-experiments";

// mirrors the visual constants in ffmpeg-pipeline-runner
const TEXT_CARD_SIZE = 320;
const PIXELATE_SIZE = 720;
const TEXT_CARD_ALPHA = 1.0;
const TEXT_GLOW_ALPHA = 1;
const TEXT_GLOW_SIGMA = 4;
const TEXT_INNER_GLOW_ALPHA = 0.7;
const TEXT_INNER_GLOW_SIGMA = 6;
const VIDEO_PIXELATE_SIZE = 720;

type TextCardStyleConfig = {
    textOpacity: number;
    textColor: string;
    textStrokeWidth: number;
    textStrokeColor: string;
    textGlowAlpha: number;
    textGlowSigma: number;
    textGlowColor: string;
    textInnerGlowAlpha: number;
    textInnerGlowSigma: number;
};

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function normalizeHexColorString(value: unknown, fallback: string) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return /^#?[0-9a-fA-F]{6}$/.test(trimmed)
        ? `#${trimmed.replace(/^#/, "").toUpperCase()}`
        : fallback;
}

function hexToAssColor(hex: string) {
    const value = hex.replace(/^#/, "").toUpperCase();
    return `&H00${value.slice(4, 6)}${value.slice(2, 4)}${value.slice(0, 2)}`;
}

function hexToFfmpegColor(hex: string) {
    return `0x${hex.replace(/^#/, "").toUpperCase()}`;
}

function escapeAss(t: string) {
    return t
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\r?\n/g, "\\N");
}

function estimateLineWidth(text: string, fontSize: number, scaleX: number) {
    const horizontalScale = scaleX / 100;
    let units = 0;
    for (const char of text) {
        if (char === " ") units += 0.35;
        else if ("ilI'`.,:;!|".includes(char)) units += 0.28;
        else if ("mwMW@#%&".includes(char)) units += 0.9;
        else units += 0.6;
    }
    return units * fontSize * horizontalScale;
}

function wrapText(
    text: string,
    fontSize: number,
    scaleX: number,
    maxWidth: number,
) {
    const sourceLines = text.split(/\r?\n/);
    const wrapped: string[] = [];

    for (const sourceLine of sourceLines) {
        const trimmed = sourceLine.trim();
        if (!trimmed) {
            wrapped.push("");
            continue;
        }

        const words = trimmed.split(/\s+/);
        let current = "";

        for (const word of words) {
            const next = current ? `${current} ${word}` : word;
            if (
                current &&
                estimateLineWidth(next, fontSize, scaleX) > maxWidth
            ) {
                wrapped.push(current);
                current = word;
            } else {
                current = next;
            }
        }

        if (current) wrapped.push(current);
    }

    return wrapped;
}

function blockHeight(
    lines: string[],
    fontSize: number,
    lineSpacing: number,
    scaleY: number,
) {
    if (!lines.length) return 0;
    const scaledFontSize = fontSize * (scaleY / 100);
    // lineSpacing controls spacing within each multiline block.
    const lineStep = scaledFontSize + lineSpacing;
    return lines.length * lineStep - lineSpacing;
}

function makeLineDialogues(
    lines: string[],
    styleName: string,
    fontName: string,
    fontSize: number,
    blockTop: number,
    lineSpacing: number,
    scaleY: number,
): (string | null)[] {
    if (!lines.length) return [];
    const scaledFontSize = fontSize * (scaleY / 100);
    const lineStep = scaledFontSize + lineSpacing;
    return lines.map((line, index) => {
        const posY = blockTop + index * lineStep;
        if (!line.length) return null;
        return `Dialogue: 0,0:00:00.00,0:00:05.00,${styleName},,0,0,0,,{\\an8\\pos(${TEXT_CARD_SIZE / 2},${Math.round(posY)})\\fn${fontName}\\fs${fontSize}}${escapeAss(line)}`;
    });
}

function makeAssCard(
    title: string,
    subtitle: string,
    titleFontSize: number,
    subtitleFontSize: number,
    scaleX = 80,
    scaleY = 125,
    lineSpacing = 8,
    styleConfig?: TextCardStyleConfig,
): string {
    const cy = TEXT_CARD_SIZE / 2;
    const resolvedStyle = styleConfig ?? {
        textOpacity: TEXT_CARD_ALPHA,
        textColor: "#FFFFFF",
        textStrokeWidth: 0,
        textStrokeColor: "#000000",
        textGlowAlpha: TEXT_GLOW_ALPHA,
        textGlowSigma: TEXT_GLOW_SIGMA,
        textGlowColor: "#0E3A72",
        textInnerGlowAlpha: TEXT_INNER_GLOW_ALPHA,
        textInnerGlowSigma: TEXT_INNER_GLOW_SIGMA,
    };
    const primaryColor = hexToAssColor(resolvedStyle.textColor);
    const outlineColor = hexToAssColor(resolvedStyle.textStrokeColor);
    const base = `${primaryColor},${primaryColor},${outlineColor},&H00000000,0,0,0,0,${scaleX},${scaleY},-2,0,1,${resolvedStyle.textStrokeWidth},0`;
    const hasSubtitle = subtitle.trim().length > 0;
    const maxTextWidth = TEXT_CARD_SIZE * 0.78;
    const titleLines = wrapText(title, titleFontSize, scaleX, maxTextWidth);
    const subtitleLines = hasSubtitle
        ? wrapText(subtitle, subtitleFontSize, scaleX, maxTextWidth)
        : [];
    const styles = hasSubtitle
        ? [
              `Style: Title,Geeza Pro,${titleFontSize},${base},2,0,0,0,1`,
              `Style: Sub,Arial,${subtitleFontSize},${base},8,0,0,0,1`,
          ]
        : [`Style: Default,Geeza Pro,${titleFontSize},${base},5,0,0,0,1`];
    const titleHeight = blockHeight(
        titleLines,
        titleFontSize,
        lineSpacing,
        scaleY,
    );
    const subtitleHeight = blockHeight(
        subtitleLines,
        subtitleFontSize,
        lineSpacing,
        scaleY,
    );
    // The same lineSpacing also controls the gap between title and subtitle.
    const blockGap = lineSpacing;
    const groupHeight = hasSubtitle
        ? titleHeight + blockGap + subtitleHeight
        : titleHeight;
    const groupTop = cy - groupHeight / 2;
    const titleTop = groupTop;
    const subtitleTop = groupTop + titleHeight + blockGap;
    const dialogues = hasSubtitle
        ? [
              ...makeLineDialogues(
                  titleLines,
                  "Title",
                  "Geeza Pro",
                  titleFontSize,
                  titleTop,
                  lineSpacing,
                  scaleY,
              ),
              ...makeLineDialogues(
                  subtitleLines,
                  "Sub",
                  "Arial",
                  subtitleFontSize,
                  subtitleTop,
                  lineSpacing,
                  scaleY,
              ),
          ].filter((dialogue): dialogue is string => dialogue !== null)
        : [
              ...makeLineDialogues(
                  titleLines,
                  "Default",
                  "Geeza Pro",
                  titleFontSize,
                  cy -
                      blockHeight(
                          titleLines,
                          titleFontSize,
                          lineSpacing,
                          scaleY,
                      ) /
                          2,
                  lineSpacing,
                  scaleY,
              ),
          ].filter((dialogue): dialogue is string => dialogue !== null);
    return [
        "[Script Info]",
        "ScriptType: v4.00+",
        `PlayResX: ${TEXT_CARD_SIZE}`,
        `PlayResY: ${TEXT_CARD_SIZE}`,
        "ScaledBorderAndShadow: yes",
        "WrapStyle: 0",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        ...styles,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ...dialogues,
        "",
    ].join("\n");
}

function run(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
        let err = "";
        proc.stderr.on("data", (c: Buffer) => {
            err += c.toString();
        });
        proc.on("error", reject);
        proc.on("close", (code) =>
            code === 0
                ? resolve()
                : reject(new Error(err.trim() || `${cmd} exited ${code}`)),
        );
    });
}

async function probeDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const proc = spawn(
            "ffprobe",
            [
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                filePath,
            ],
            { stdio: ["ignore", "pipe", "pipe"] },
        );
        let out = "";
        proc.stdout.on("data", (c: Buffer) => {
            out += c.toString();
        });
        proc.on("close", (code) => {
            const n = parseFloat(out.trim());
            if (code !== 0 || !isFinite(n)) reject(new Error("ffprobe failed"));
            else resolve(n);
        });
    });
}

export async function POST(req: NextRequest) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "still-"));
    try {
        const {
            videoId,
            lutId,
            title = "",
            subtitle = "",
            titleFontSize = 32,
            subtitleFontSize = 14,
            scaleX = 80,
            scaleY = 125,
            lineSpacing = 8,
            vignette,
            exposure,
            saturation,
            overlayId,
            overlayBlendMode,
        } = (await req.json()) as {
            videoId: string;
            lutId?: string | null;
            title?: string;
            subtitle?: string;
            titleFontSize?: number;
            subtitleFontSize?: number;
            scaleX?: number;
            scaleY?: number;
            lineSpacing?: number;
            vignette?: number;
            exposure?: number;
            saturation?: number;
            overlayId?: string | null;
            overlayBlendMode?: OverlayBlendMode | null;
        };
        const safeScaleX = Math.max(1, Math.min(500, Math.round(scaleX)));
        const safeScaleY = Math.max(1, Math.min(500, Math.round(scaleY)));
        const safeLineSpacing = Math.max(
            -100,
            Math.min(200, Math.round(lineSpacing)),
        );
        const safeTitleFontSize = Math.max(
            8,
            Math.min(200, Math.round(titleFontSize)),
        );
        const safeSubtitleFontSize = Math.max(
            8,
            Math.min(200, Math.round(subtitleFontSize)),
        );

        if (!videoId || !ObjectId.isValid(videoId)) {
            return NextResponse.json(
                { error: "Invalid videoId" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const video = (await db
            .collection("videos")
            .findOne({ _id: new ObjectId(videoId) })) as {
            filePath?: string;
        } | null;
        if (!video?.filePath || !fs.existsSync(video.filePath)) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 },
            );
        }

        let lutPath: string | null = null;
        if (lutId && ObjectId.isValid(lutId)) {
            const lut = (await db
                .collection("luts")
                .findOne({ _id: new ObjectId(lutId) })) as {
                filePath?: string;
            } | null;
            if (lut?.filePath && fs.existsSync(lut.filePath))
                lutPath = lut.filePath;
        }

        let overlayPath: string | null = null;
        if (overlayId && ObjectId.isValid(overlayId)) {
            const overlay = (await db
                .collection("overlays")
                .findOne({ _id: new ObjectId(overlayId) })) as {
                filePath?: string;
            } | null;
            if (overlay?.filePath && fs.existsSync(overlay.filePath))
                overlayPath = overlay.filePath;
        }

        const cfg = (await db
            .collection("configuration")
            .findOne({ type: "video" })) as Record<string, unknown> | null;
        const resolvedVignette =
            typeof vignette === "number"
                ? Math.max(0, Math.min(1, vignette))
                : typeof cfg?.vignette === "number"
                  ? cfg.vignette
                  : 0;
        const resolvedExposure =
            typeof exposure === "number"
                ? Math.max(-3, Math.min(3, exposure))
                : typeof cfg?.exposure === "number"
                  ? cfg.exposure
                  : 0;
        const resolvedSaturation =
            typeof saturation === "number"
                ? Math.max(0, Math.min(3, saturation))
                : typeof cfg?.saturation === "number"
                  ? cfg.saturation
                  : 1;
        const resolvedOverlayId =
            overlayId === undefined
                ? (cfg?.overlayId?.toString?.() ?? cfg?.overlayId ?? null)
                : overlayId;
        const resolvedOverlayBlendMode =
            typeof overlayBlendMode === "string"
                ? overlayBlendMode
                : typeof cfg?.overlayBlendMode === "string"
                  ? cfg.overlayBlendMode
                  : "normal";
        const textStyleConfig: TextCardStyleConfig = {
            textOpacity:
                typeof cfg?.textOpacity === "number"
                    ? clampNumber(cfg.textOpacity, 0, 1)
                    : TEXT_CARD_ALPHA,
            textColor: normalizeHexColorString(cfg?.textColor, "#FFFFFF"),
            textStrokeWidth:
                typeof cfg?.textStrokeWidth === "number"
                    ? clampNumber(cfg.textStrokeWidth, 0, 20)
                    : 0,
            textStrokeColor: normalizeHexColorString(
                cfg?.textStrokeColor,
                "#000000",
            ),
            textGlowAlpha:
                typeof cfg?.textGlowAlpha === "number"
                    ? clampNumber(cfg.textGlowAlpha, 0, 1)
                    : TEXT_GLOW_ALPHA,
            textGlowSigma:
                typeof cfg?.textGlowSigma === "number"
                    ? clampNumber(cfg.textGlowSigma, 0, 300)
                    : TEXT_GLOW_SIGMA,
            textGlowColor: normalizeHexColorString(
                cfg?.textGlowColor,
                "#0E3A72",
            ),
            textInnerGlowAlpha:
                typeof cfg?.textInnerGlowAlpha === "number"
                    ? clampNumber(cfg.textInnerGlowAlpha, 0, 1)
                    : TEXT_INNER_GLOW_ALPHA,
            textInnerGlowSigma:
                typeof cfg?.textInnerGlowSigma === "number"
                    ? clampNumber(cfg.textInnerGlowSigma, 0, 300)
                    : TEXT_INNER_GLOW_SIGMA,
        };

        if (
            !overlayPath &&
            resolvedOverlayId &&
            ObjectId.isValid(String(resolvedOverlayId))
        ) {
            const overlay = (await db
                .collection("overlays")
                .findOne({ _id: new ObjectId(String(resolvedOverlayId)) })) as {
                filePath?: string;
            } | null;
            if (overlay?.filePath && fs.existsSync(overlay.filePath))
                overlayPath = overlay.filePath;
        }

        const duration = await probeDuration(video.filePath);
        const offset = Math.random() * Math.max(0, duration - 2);

        // extract frame + square crop + pixelate + optional lut + post
        const frameFilters: string[] = [
            `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1`,
            `scale=${VIDEO_PIXELATE_SIZE}:${VIDEO_PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor`,
        ];
        if (lutPath) frameFilters.push(`lut3d=file=${lutPath}`);
        if (resolvedVignette > 0)
            frameFilters.push(
                `vignette=a=${(Math.PI * 0.9 * resolvedVignette).toFixed(4)}`,
            );
        if (resolvedExposure !== 0)
            frameFilters.push(
                `exposure=exposure=${resolvedExposure.toFixed(2)}`,
            );
        if (resolvedSaturation !== 1)
            frameFilters.push(`eq=saturation=${resolvedSaturation.toFixed(2)}`);

        const framePng = path.join(workDir, "frame.png");
        await run("ffmpeg", [
            "-y",
            "-ss",
            offset.toFixed(3),
            "-i",
            video.filePath,
            "-frames:v",
            "1",
            "-vf",
            frameFilters.join(","),
            framePng,
        ]);

        // render text card with same glow treatment as video pipeline
        const assPath = path.join(workDir, "card.ass");
        const cardPng = path.join(workDir, "card.png");
        fs.writeFileSync(
            assPath,
            makeAssCard(
                title,
                subtitle,
                safeTitleFontSize,
                safeSubtitleFontSize,
                safeScaleX,
                safeScaleY,
                safeLineSpacing,
                textStyleConfig,
            ),
            "utf8",
        );
        const esc = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");

        await run("ffmpeg", [
            "-y",
            "-f",
            "lavfi",
            "-i",
            `color=c=black@0.0:s=${TEXT_CARD_SIZE}x${TEXT_CARD_SIZE}:r=1,format=rgba`,
            "-filter_complex",
            [
                `[0:v]format=rgba,ass=${esc},split=3[b][g][n]`,
                `[b]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,format=gray[sm]`,
                `[g]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,gblur=sigma=${textStyleConfig.textGlowSigma},format=gray[gm]`,
                `[n]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,gblur=sigma=${textStyleConfig.textInnerGlowSigma},format=gray[nm]`,
                `color=c=${hexToFfmpegColor(textStyleConfig.textColor)}:s=1080x1080:r=1,format=rgba[wh]`,
                `color=c=${hexToFfmpegColor(textStyleConfig.textColor)}:s=1080x1080:r=1,format=rgba[iwh]`,
                `color=c=${hexToFfmpegColor(textStyleConfig.textGlowColor)}:s=1080x1080:r=1,format=rgba[gc]`,
                `[sm]colorchannelmixer=aa=${textStyleConfig.textOpacity}[sa]`,
                `[gm]colorchannelmixer=aa=${textStyleConfig.textGlowAlpha}[ga]`,
                `[nm]colorchannelmixer=aa=${textStyleConfig.textInnerGlowAlpha}[na]`,
                `[wh][sa]alphamerge[sh]`,
                `[gc][ga]alphamerge[gl]`,
                `[iwh][na]alphamerge[ig]`,
                `[gl][sh]overlay=format=auto[mid]`,
                `[mid][ig]overlay=format=auto[out]`,
            ].join(";"),
            "-map",
            "[out]",
            "-frames:v",
            "1",
            "-update",
            "1",
            cardPng,
        ]);

        // composite card onto frame
        const compositedPng = path.join(workDir, "composited.png");
        await run("ffmpeg", [
            "-y",
            "-i",
            framePng,
            "-i",
            cardPng,
            "-filter_complex",
            "[0:v][1:v]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2:format=auto[out]",
            "-map",
            "[out]",
            "-frames:v",
            "1",
            compositedPng,
        ]);

        const outputPng = path.join(workDir, "output.png");
        if (overlayPath && fs.existsSync(overlayPath)) {
            const overlayScale = `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1`;
            const overlayFilter =
                resolvedOverlayBlendMode &&
                resolvedOverlayBlendMode !== "normal"
                    ? `[1:v]${overlayScale},format=gbrp[ovr];[0:v]format=gbrp[base];[base][ovr]blend=all_mode=${resolvedOverlayBlendMode}[out]`
                    : `[1:v]${overlayScale}[ovr];[0:v][ovr]overlay=0:0:eof_action=pass[out]`;
            await run("ffmpeg", [
                "-y",
                "-i",
                compositedPng,
                "-i",
                overlayPath,
                "-filter_complex",
                overlayFilter,
                "-map",
                "[out]",
                "-frames:v",
                "1",
                outputPng,
            ]);
        } else {
            fs.copyFileSync(compositedPng, outputPng);
        }

        const buf = fs.readFileSync(outputPng);
        return new Response(buf, {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": 'attachment; filename="still.png"',
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
        );
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}
