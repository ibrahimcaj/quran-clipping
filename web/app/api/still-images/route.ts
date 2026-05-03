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
const TEXT_GLOW_COLOR = "0x0E3A72";
const TEXT_INNER_GLOW_ALPHA = 0.7;
const TEXT_INNER_GLOW_SIGMA = 6;
const VIDEO_PIXELATE_SIZE = 720;

function escapeAss(t: string) {
    return t
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\r?\n/g, "\\N");
}

function countLines(text: string) {
    return text.length ? text.split(/\r?\n/).length : 0;
}

function blockHeight(text: string, fontSize: number, lineSpacing: number) {
    const lines = countLines(text);
    if (!lines) return 0;
    const lineStep = fontSize + lineSpacing;
    return lines * lineStep - lineSpacing;
}

function makeLineDialogues(
    text: string,
    styleName: string,
    fontName: string,
    fontSize: number,
    blockTop: number,
    lineSpacing: number,
): (string | null)[] {
    if (!text.length) return [];
    const lines = text.split(/\r?\n/);
    const lineStep = fontSize + lineSpacing;
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
): string {
    const cy = TEXT_CARD_SIZE / 2;
    const base = `&H1AFFFFFF,&H1AFFFFFF,&H00000000,&H00000000,0,0,0,0,${scaleX},${scaleY},-2,0,1,0,0`;
    const styles = subtitle
        ? [
              `Style: Title,Geeza Pro,${titleFontSize},${base},2,0,0,0,1`,
              `Style: Sub,Arial,${subtitleFontSize},${base},8,0,0,0,1`,
          ]
        : [`Style: Default,Geeza Pro,${titleFontSize},${base},5,0,0,0,1`];
    const titleHeight = blockHeight(title, titleFontSize, lineSpacing);
    const subtitleHeight = blockHeight(subtitle, subtitleFontSize, lineSpacing);
    const groupHeight = subtitle
        ? titleHeight + lineSpacing + subtitleHeight
        : titleHeight;
    const groupTop = cy - groupHeight / 2;
    const titleTop = groupTop;
    const subtitleTop = groupTop + titleHeight + lineSpacing;
    const dialogues = subtitle
        ? [
              ...makeLineDialogues(
                  title,
                  "Title",
                  "Geeza Pro",
                  titleFontSize,
                  titleTop,
                  lineSpacing,
              ),
              ...makeLineDialogues(
                  subtitle,
                  "Sub",
                  "Arial",
                  subtitleFontSize,
                  subtitleTop,
                  lineSpacing,
              ),
          ].filter((dialogue): dialogue is string => dialogue !== null)
        : [
              ...makeLineDialogues(
                  title,
                  "Default",
                  "Geeza Pro",
                  titleFontSize,
                  cy - blockHeight(title, titleFontSize, lineSpacing) / 2,
                  lineSpacing,
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
                `[g]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,gblur=sigma=${TEXT_GLOW_SIGMA},format=gray[gm]`,
                `[n]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,gblur=sigma=${TEXT_INNER_GLOW_SIGMA},format=gray[nm]`,
                `color=c=white:s=1080x1080:r=1,format=rgba[wh]`,
                `color=c=white:s=1080x1080:r=1,format=rgba[iwh]`,
                `color=c=${TEXT_GLOW_COLOR}:s=1080x1080:r=1,format=rgba[gc]`,
                `[sm]colorchannelmixer=aa=${TEXT_CARD_ALPHA}[sa]`,
                `[gm]colorchannelmixer=aa=${TEXT_GLOW_ALPHA}[ga]`,
                `[nm]colorchannelmixer=aa=${TEXT_INNER_GLOW_ALPHA}[na]`,
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
                    ? `[1:v]${overlayScale},format=yuv420p[ovr];[0:v]format=yuv420p[base];[base][ovr]blend=all_mode=${resolvedOverlayBlendMode}[out]`
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
