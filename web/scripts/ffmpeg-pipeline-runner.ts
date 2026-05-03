import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
import { spawn } from "child_process";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import { EXPERIMENTS_DIR, PREPARED_VIDEOS_DIR, safeSlug } from "../lib/storage";
import { mapTranslationsToSegments } from "../lib/translation-mapper";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const require = createRequire(import.meta.url);
const Ffmpeg = require("ffmpeg");

const RECITER_PATHS: Record<
    string,
    { cdn: string; path: string; label: string }
> = {
    "1": {
        cdn: "https://audio.qurancdn.com",
        path: "AbdulBaset/Mujawwad/mp3",
        label: "Abdul Basit (Mujawwad)",
    },
    "2": {
        cdn: "https://audio.qurancdn.com",
        path: "AbdulBaset/Murattal/mp3",
        label: "Abdul Basit (Murattal)",
    },
    "3": {
        cdn: "https://audio.qurancdn.com",
        path: "Sudais/mp3",
        label: "Abdur-Rahman As-Sudais",
    },
    "4": {
        cdn: "https://audio.qurancdn.com",
        path: "Shatri/mp3",
        label: "Abu Bakr Al-Shatri",
    },
    "5": {
        cdn: "https://audio.qurancdn.com",
        path: "Rifai/mp3",
        label: "Hani Ar-Rifai",
    },
    "6": {
        cdn: "https://mirrors.quranicaudio.com/everyayah",
        path: "Husary_64kbps",
        label: "Mahmoud Al-Husary",
    },
    "7": {
        cdn: "https://audio.qurancdn.com",
        path: "Alafasy/mp3",
        label: "Mishari Al-Afasy",
    },
    "8": {
        cdn: "https://audio.qurancdn.com",
        path: "Minshawi/Mujawwad/mp3",
        label: "Mohamed Al-Minshawi (Mujawwad)",
    },
    "9": {
        cdn: "https://audio.qurancdn.com",
        path: "Minshawi/Murattal/mp3",
        label: "Mohamed Al-Minshawi (Murattal)",
    },
    "10": {
        cdn: "https://audio.qurancdn.com",
        path: "Shuraym/mp3",
        label: "Saud Ash-Shuraym",
    },
    "11": {
        cdn: "https://mirrors.quranicaudio.com/everyayah",
        path: "Mohammad_al_Tablaway_128kbps",
        label: "Mohamed Al-Tablawi",
    },
    "12": {
        cdn: "https://mirrors.quranicaudio.com/everyayah",
        path: "Husary_Muallim_128kbps",
        label: "Mahmoud Al-Husary (Muallim)",
    },
};

type VerseWord = {
    id: number;
    position: number;
    text_uthmani?: string;
    text_imlaei?: string;
    text_imlaei_simple?: string;
    text?: string;
    translation?: { text?: string; language_name?: string };
    char_type_name: string;
    timestamp_from?: number;
    timestamp_to?: number;
};

type VersePayload = {
    verse_key: string;
    text_uthmani?: string;
    text_imlaei?: string;
    text_imlaei_simple?: string;
    words?: VerseWord[];
    audio?: { segments?: number[][] };
    translations?: { resource_id?: number; text?: string }[];
};

type VideoDoc = {
    _id: ObjectId;
    originalFilename: string;
    filePath: string;
    name?: string;
    durationSeconds?: number;
};

type TimedVideo = VideoDoc & {
    durationSeconds: number;
};

type PlannedSegment = TimedVideo & {
    clipDurationSeconds: number;
    startOffsetSeconds: number;
    preparedPath: string;
};

const OUTPUT_FPS = 30;
const SEGMENT_END_MARGIN_SECONDS = 0.25;
const TEXT_CARD_SIZE = 320;
const PIXELATE_SIZE = 720;
const TEXT_CARD_ALPHA = 1.0;
const TEXT_GLOW_ALPHA = 1;
const TEXT_GLOW_SIGMA = 100;
const TEXT_GLOW_COLOR = "0x0E3A72";
const TEXT_INNER_GLOW_ALPHA = 0.7;
const TEXT_INNER_GLOW_SIGMA = 6;
const VIDEO_PIXELATE_SIZE = 720;
const TEXT_PAIR_LEAD_SECONDS = 0.04;
const TEXT_PAIR_TAIL_SECONDS = 0.08;
const TEXT_PAIR_MIN_SECONDS = 0.35;
const TEXT_PAIR_GAP_SECONDS = 0.02;

function ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
}

function createExperimentOutputPaths(experimentId: string) {
    ensureDir(EXPERIMENTS_DIR);
    const workDir = path.join(EXPERIMENTS_DIR, experimentId);
    ensureDir(workDir);
    const preparedDir = path.join(workDir, "prepared");
    ensureDir(preparedDir);

    return {
        workDir,
        preparedDir,
        concatList: path.join(workDir, "concat.txt"),
        stitched: path.join(workDir, "stitched.mp4"),
        lutted: path.join(workDir, "lutted.mp4"),
        postprocessed: path.join(workDir, "postprocessed.mp4"),
        overlaid: path.join(workDir, "overlaid.mp4"),
        textOverlaid: path.join(workDir, "text_overlaid.mp4"),
        verseAudio: path.join(workDir, "verse.mp3"),
    };
}

function getPreparedVideoPath(videoId: string) {
    ensureDir(PREPARED_VIDEOS_DIR);
    return path.join(PREPARED_VIDEOS_DIR, `${videoId}.mp4`);
}

function createProbeAudioPath() {
    ensureDir(EXPERIMENTS_DIR);
    return path.join(
        EXPERIMENTS_DIR,
        `.probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`,
    );
}

async function inspectVideo(inputPath: string) {
    return new Promise<void>((resolve, reject) => {
        try {
            new Ffmpeg(inputPath, (error: Error | null) => {
                if (error) reject(error);
                else resolve();
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function runProcess(
    command: string,
    args: string[],
    onLine?: (line: string) => Promise<void> | void,
    onProgress?: (progress: { frame?: number; fps?: number; time?: number; percent?: number }) => Promise<void> | void,
) {
    return new Promise<void>((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        let buffer = "";
        let lastLoggedAt = 0;

        proc.stderr.on("data", async (chunk) => {
            const text = chunk.toString();
            stderr += text;
            buffer += text;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;

                // log errors immediately; throttle everything else to ~1/sec
                const isError = /error|invalid|no such file|cannot open|failed|undefined/i.test(line);
                const now = Date.now();
                if (onLine && (isError || now - lastLoggedAt > 1000)) {
                    lastLoggedAt = now;
                    await onLine(line);
                }

                if (line.includes("frame=") && onProgress) {
                    const frameMatch = line.match(/frame=\s*(\d+)/);
                    const fpsMatch = line.match(/fps=\s*([\d.]+)/);
                    const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);

                    if (frameMatch || fpsMatch || timeMatch) {
                        const frame = frameMatch ? parseInt(frameMatch[1], 10) : undefined;
                        const fps = fpsMatch ? parseFloat(fpsMatch[1]) : undefined;
                        const totalSeconds =
                            timeMatch ?
                                parseInt(timeMatch[1], 10) * 3600 +
                                parseInt(timeMatch[2], 10) * 60 +
                                parseFloat(timeMatch[3])
                            : undefined;

                        await onProgress({ frame, fps, time: totalSeconds });
                    }
                }
            }
        });

        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                new Error(
                    stderr.trim() || `${command} exited with code ${code}`,
                ),
            );
        });
    });
}

async function ffprobeDuration(inputPath: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const proc = spawn(
            "ffprobe",
            [
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                inputPath,
            ],
        );
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        proc.stderr.on("data", (data) => {
            stderr += data.toString();
        });
        proc.on("close", (code) => {
            if (code === 0) {
                const duration = parseFloat(stdout.trim());
                resolve(Number.isFinite(duration) ? duration : 0);
            } else {
                reject(new Error(`ffprobe exit code ${code}${stderr ? `: ${stderr}` : ""}`));
            }
        });
        proc.on("error", reject);
    });
}

async function runFfmpegWithProgress(
    args: string[],
    onLine?: (line: string) => Promise<void> | void,
    setProgressFn?: (progress: { frame?: number; fps?: number; time?: number; percent?: number }) => Promise<void> | void,
): Promise<void> {
    if (onLine) {
        // log the full command so stuck steps are debuggable
        await onLine(`ffmpeg ${args.map(a => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
    }

    let totalSeconds = 0;
    const inputIndex = args.indexOf("-i");
    if (inputIndex !== -1 && inputIndex + 1 < args.length) {
        const inputFile = args[inputIndex + 1];
        try {
            totalSeconds = await ffprobeDuration(inputFile);
            if (onLine && totalSeconds > 0) await onLine(`input duration: ${totalSeconds.toFixed(2)}s`);
        } catch {
            // probing failed — percent tracking unavailable
        }
    }

    await runProcess(
        "ffmpeg",
        args,
        onLine,
        async (progress) => {
            if (setProgressFn) {
                await setProgressFn({ ...progress, totalSeconds });
            }
        },
    );
}


function verseAudioUrl(verseKey: string, recitationId: string) {
    const entry = RECITER_PATHS[recitationId];
    if (!entry) throw new Error("Unsupported reciter");
    const [chapter, verse] = verseKey.split(":");
    if (!chapter || !verse) throw new Error("Invalid verse key");
    const file = `${chapter.padStart(3, "0")}${verse.padStart(3, "0")}.mp3`;
    return `${entry.cdn}/${entry.path}/${file}`;
}

async function downloadFile(url: string, filePath: string) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to download file: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
}

function getAppBase() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        `http://${process.env.HOST ?? "localhost"}:${process.env.PORT ?? 3000}`
    );
}

// routes through our Next.js API so translations are always included
async function fetchVerseFromApi(params: Record<string, string>): Promise<VersePayload> {
    const url = `${getAppBase()}/api/qf/verses?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    const text = await response.text();
    const data = JSON.parse(text) as { verse?: VersePayload; error?: string };
    if (!response.ok || !data.verse) {
        throw new Error(data.error ?? "Failed to fetch verse");
    }
    return data.verse;
}

async function getRandomVerse(recitationId: string): Promise<VersePayload> {
    return fetchVerseFromApi({ random: "true", recitation: recitationId });
}

async function getVerseByKey(
    verseKey: string,
    recitationId: string,
): Promise<VersePayload> {
    return fetchVerseFromApi({ verse_key: verseKey, recitation: recitationId });
}

async function selectRenderableVerse(
    recitationId: string,
    maxCoverageSeconds: number,
    minAyahSeconds: number,
    maxAyahSeconds: number,
    log: (message: string) => Promise<void>,
) {
    const attempts = 12;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const verse = await getRandomVerse(recitationId);
        await log(`Candidate verse ${attempt}/${attempts}: ${verse.verse_key}`);

        const tempAudioPath = createProbeAudioPath();

        try {
            await downloadFile(
                verseAudioUrl(verse.verse_key, recitationId),
                tempAudioPath,
            );
            const durationSeconds = await ffprobeDuration(tempAudioPath);
            if (durationSeconds < minAyahSeconds) {
                await log(
                    `Skipped ${verse.verse_key}: ${durationSeconds.toFixed(2)}s is shorter than minimum ${minAyahSeconds.toFixed(2)}s`,
                );
                continue;
            }
            if (durationSeconds > maxAyahSeconds) {
                await log(
                    `Skipped ${verse.verse_key}: ${durationSeconds.toFixed(2)}s exceeds configured max ${maxAyahSeconds.toFixed(2)}s`,
                );
                continue;
            }
            if (durationSeconds <= maxCoverageSeconds) {
                return { verse, durationSeconds };
            }
            await log(
                `Skipped ${verse.verse_key}: ${durationSeconds.toFixed(2)}s exceeds ${maxCoverageSeconds.toFixed(2)}s of unique coverage`,
            );
        } finally {
            if (fs.existsSync(tempAudioPath)) {
                fs.rmSync(tempAudioPath, { force: true });
            }
        }
    }

    throw new Error(
        `Could not find a random verse that fits ${maxCoverageSeconds.toFixed(2)}s of available unique footage`,
    );
}

function chooseRandom<T>(items: T[]) {
    return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
}

function randomOffset(maxStart: number) {
    if (maxStart <= 0) return 0;
    return Math.random() * maxStart;
}

function buildVideoSequence(
    videos: TimedVideo[],
    targetSeconds: number,
    maxClipSeconds: number,
): PlannedSegment[] {
    const sequence: PlannedSegment[] = [];
    let total = 0;
    for (const chosen of shuffle(videos)) {
        if (total >= targetSeconds) break;
        const remaining = targetSeconds - total;
        const clipDurationSeconds = Math.min(
            chosen.durationSeconds,
            maxClipSeconds,
            remaining,
        );
        if (clipDurationSeconds <= 0) continue;
        const startOffsetSeconds = randomOffset(
            Math.max(
                chosen.durationSeconds -
                    clipDurationSeconds -
                    SEGMENT_END_MARGIN_SECONDS,
                0,
            ),
        );

        sequence.push({
            ...chosen,
            clipDurationSeconds,
            startOffsetSeconds,
            preparedPath: getPreparedVideoPath(chosen._id.toString()),
        });
        total += clipDurationSeconds;
    }

    if (total < targetSeconds) {
        throw new Error(
            `Not enough unique video coverage for this verse. Need ${targetSeconds.toFixed(2)}s, only have ${total.toFixed(2)}s across unique clips.`,
        );
    }

    return sequence;
}

function makeOutputFilename(
    verseKey: string,
    reciterName: string,
    epochMs: number,
) {
    const verseSlug = safeSlug(verseKey.replace(":", "-"));
    const reciterSlug = safeSlug(reciterName);
    return `${verseSlug}_${reciterSlug}_${epochMs}.mp4`;
}

function cleanupIntermediateArtifacts(
    paths: ReturnType<typeof createExperimentOutputPaths>,
    finalPath: string,
) {
    const filesToDelete = [
        paths.concatList,
        paths.stitched,
        paths.lutted,
        paths.postprocessed,
        paths.overlaid,
        paths.textOverlaid,
        paths.verseAudio,
    ];
    for (const filePath of filesToDelete) {
        if (fs.existsSync(filePath) && filePath !== finalPath) {
            fs.rmSync(filePath, { force: true });
        }
    }
    if (fs.existsSync(paths.preparedDir)) {
        fs.rmSync(paths.preparedDir, { recursive: true, force: true });
    }
}

function minimumAcceptedSegmentDuration(expectedSeconds: number) {
    if (expectedSeconds <= 1)
        return Math.max(expectedSeconds - 0.08, expectedSeconds * 0.8);
    if (expectedSeconds <= 3)
        return Math.max(expectedSeconds - 0.12, expectedSeconds * 0.88);
    return Math.max(expectedSeconds - 0.18, expectedSeconds * 0.94);
}

async function createValidatedSegment(
    video: PlannedSegment,
    preparedDurationSeconds: number,
    outputPath: string,
    log: (message: string) => Promise<void>,
) {
    const expectedSeconds = video.clipDurationSeconds;
    const minimumDuration = minimumAcceptedSegmentDuration(expectedSeconds);
    const attempts = 4;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const safeMaxStart = Math.max(
            preparedDurationSeconds -
                expectedSeconds -
                SEGMENT_END_MARGIN_SECONDS,
            0,
        );
        const startOffsetSeconds =
            attempt === 1
                ? Math.min(video.startOffsetSeconds, safeMaxStart)
                : randomOffset(safeMaxStart);

        await log(
            `Preparing ${video.originalFilename} from ${startOffsetSeconds.toFixed(2)}s for ${expectedSeconds.toFixed(2)}s (attempt ${attempt}/${attempts})`,
        );

        await runProcess(
            "ffmpeg",
            [
                "-y",
                "-i",
                video.preparedPath,
                "-vf",
                `trim=start=${startOffsetSeconds.toFixed(3)}:duration=${expectedSeconds.toFixed(3)},setpts=PTS-STARTPTS,fps=${OUTPUT_FPS},format=yuv420p`,
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                outputPath,
            ],
            log,
        );

        const actualDuration = await ffprobeDuration(outputPath);
        if (actualDuration >= minimumDuration) {
            return {
                actualDuration,
                startOffsetSeconds,
            };
        }

        await log(
            `Discarded short segment from ${video.originalFilename}: ${actualDuration.toFixed(2)}s produced, expected ${expectedSeconds.toFixed(2)}s`,
        );
        fs.rmSync(outputPath, { force: true });
    }

    throw new Error(
        `Could not extract a stable segment from ${video.originalFilename}`,
    );
}

async function getVideoDurationSeconds(
    db: Awaited<ReturnType<MongoClient["db"]>>,
    video: VideoDoc,
) {
    if (
        typeof video.durationSeconds === "number" &&
        Number.isFinite(video.durationSeconds) &&
        video.durationSeconds > 0
    ) {
        return video.durationSeconds;
    }
    const durationSeconds = await ffprobeDuration(video.filePath);
    await db
        .collection("videos")
        .updateOne(
            { _id: video._id },
            { $set: { durationSeconds, updatedAt: new Date() } },
        );
    return durationSeconds;
}

async function collectTimedVideos(db: Awaited<ReturnType<MongoClient["db"]>>) {
    const videos = (await db
        .collection("videos")
        .find()
        .toArray()) as unknown as VideoDoc[];
    const timedVideos: TimedVideo[] = [];

    for (const video of videos) {
        if (!video.filePath || !fs.existsSync(video.filePath)) continue;
        const durationSeconds = await getVideoDurationSeconds(db, video);
        timedVideos.push({ ...video, durationSeconds });
    }

    return timedVideos;
}

// mirrors the segment-merging logic in /api/qf/verses/route.ts
function mergeSegmentTimings(
    words: VerseWord[],
    segments: number[][] | undefined,
): VerseWord[] {
    if (!segments?.length) return words;
    const byPosition = new Map<
        number,
        { timestamp_from: number; timestamp_to: number }
    >();
    for (const seg of segments) {
        let position: number | null = null;
        let from: number | null = null;
        let to: number | null = null;
        if (seg.length >= 4) {
            position = typeof seg[1] === "number" ? seg[1] : null;
            from = typeof seg[2] === "number" ? seg[2] : null;
            to = typeof seg[3] === "number" ? seg[3] : null;
        } else if (seg.length === 3) {
            position = typeof seg[0] === "number" ? seg[0] : null;
            from = typeof seg[1] === "number" ? seg[1] : null;
            to = typeof seg[2] === "number" ? seg[2] : null;
        }
        if (position !== null && from !== null && to !== null) {
            byPosition.set(position, {
                timestamp_from: from,
                timestamp_to: to,
            });
        }
    }
    return words.map((word) => {
        const timing = word.position
            ? byPosition.get(word.position)
            : undefined;
        return timing ? { ...word, ...timing } : word;
    });
}

function getOverlayWordText(word: VerseWord): string {
    return word.text_imlaei ?? word.text_uthmani ?? word.text ?? "";
}

function getOverlayWordTranslation(word: VerseWord): string {
    return (word.translation?.text ?? "").replace(/<[^>]+>/g, "").trim();
}

function escapeAssText(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\r?\n/g, "\\N");
}

function formatAssTimestamp(seconds: number): string {
    const centiseconds = Math.max(0, Math.round(seconds * 100));
    const hours = Math.floor(centiseconds / 360000);
    const minutes = Math.floor((centiseconds % 360000) / 6000);
    const secs = Math.floor((centiseconds % 6000) / 100);
    const cs = centiseconds % 100;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function createAssCard(arabic: string, english: string, size: number, titleFontSize = 36, subtitleFontSize = 11, scaleX = 80, scaleY = 125, lineSpacing = 8): string {
    const cy = size / 2;
    // marginV for bottom-aligned title: text bottom = size - marginV = cy - lineSpacing/2
    // marginV for top-aligned subtitle: text top = marginV = cy + lineSpacing/2
    // both equal cy + lineSpacing/2
    const marginV = Math.round(cy + lineSpacing / 2);
    const base = `&H1AFFFFFF,&H1AFFFFFF,&H00000000,&H00000000,0,0,0,0,${scaleX},${scaleY},-2,0,1,0,0`;
    const styles = english
        ? [
            `Style: Title,Geeza Pro,${titleFontSize},${base},2,0,0,${marginV},1`,
            `Style: Sub,Arial,${subtitleFontSize},${base},8,0,0,${marginV},1`,
          ]
        : [
            `Style: Default,Geeza Pro,${titleFontSize},${base},5,0,0,0,1`,
          ];
    const dialogues = english
        ? [
            `Dialogue: 0,0:00:00.00,0:00:05.00,Title,,0,0,0,,{\\fnGeeza Pro\\fs${titleFontSize}}${escapeAssText(arabic)}`,
            `Dialogue: 0,0:00:00.00,0:00:05.00,Sub,,0,0,0,,{\\fnArial\\fs${subtitleFontSize}}${escapeAssText(english)}`,
          ]
        : [
            `Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,{\\fnGeeza Pro\\fs${titleFontSize}}${escapeAssText(arabic)}`,
          ];
    return [
        "[Script Info]",
        "ScriptType: v4.00+",
        `PlayResX: ${size}`,
        `PlayResY: ${size}`,
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

function buildSubtitleCardFilter(
    inputLabel: string,
    assPath: string,
    outputLabel: string,
): string {
    const escapedAssPath = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    return [
        `[${inputLabel}]format=rgba,ass=${escapedAssPath},split=3[${outputLabel}Base][${outputLabel}GlowSrc][${outputLabel}InnerSrc]`,
        `[${outputLabel}Base]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,format=gray[${outputLabel}SharpMask]`,
        `[${outputLabel}GlowSrc]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,gblur=sigma=${TEXT_GLOW_SIGMA},format=gray[${outputLabel}GlowMask]`,
        `[${outputLabel}InnerSrc]scale=${PIXELATE_SIZE}:${PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor,gblur=sigma=${TEXT_INNER_GLOW_SIGMA},format=gray[${outputLabel}InnerMask]`,
        `color=c=white:s=1080x1080:r=1,format=rgba[${outputLabel}White]`,
        `color=c=white:s=1080x1080:r=1,format=rgba[${outputLabel}InnerWhite]`,
        `color=c=${TEXT_GLOW_COLOR}:s=1080x1080:r=1,format=rgba[${outputLabel}GlowColor]`,
        `[${outputLabel}SharpMask]colorchannelmixer=aa=${TEXT_CARD_ALPHA}[${outputLabel}SharpAlpha]`,
        `[${outputLabel}GlowMask]colorchannelmixer=aa=${TEXT_GLOW_ALPHA}[${outputLabel}GlowAlpha]`,
        `[${outputLabel}InnerMask]colorchannelmixer=aa=${TEXT_INNER_GLOW_ALPHA}[${outputLabel}InnerAlpha]`,
        `[${outputLabel}White][${outputLabel}SharpAlpha]alphamerge[${outputLabel}Sharp]`,
        `[${outputLabel}GlowColor][${outputLabel}GlowAlpha]alphamerge[${outputLabel}Glow]`,
        `[${outputLabel}InnerWhite][${outputLabel}InnerAlpha]alphamerge[${outputLabel}Inner]`,
        `[${outputLabel}Glow][${outputLabel}Sharp]overlay=format=auto[${outputLabel}Mid]`,
        `[${outputLabel}Mid][${outputLabel}Inner]overlay=format=auto[${outputLabel}]`,
    ].join(";");
}

async function renderSubtitleCardPngBatch(
    cards: {
        arabic: string;
        english: string;
        assPath: string;
        outputPath: string;
        titleFontSize?: number;
        subtitleFontSize?: number;
        scaleX?: number;
        scaleY?: number;
        lineSpacing?: number;
    }[],
    log: (msg: string) => Promise<void>,
) {
    for (const card of cards) {
        fs.writeFileSync(
            card.assPath,
            createAssCard(card.arabic, card.english, TEXT_CARD_SIZE, card.titleFontSize, card.subtitleFontSize, card.scaleX, card.scaleY, card.lineSpacing),
            "utf8",
        );
    }

    const ffArgs: string[] = ["-y"];
    const filterParts: string[] = [];

    for (const [index, card] of cards.entries()) {
        ffArgs.push(
            "-f",
            "lavfi",
            "-i",
            `color=c=black@0.0:s=${TEXT_CARD_SIZE}x${TEXT_CARD_SIZE}:r=1,format=rgba`,
        );
        filterParts.push(
            buildSubtitleCardFilter(`${index}:v`, card.assPath, `card${index}`),
        );
    }

    ffArgs.push("-filter_complex", filterParts.join(";"));

    for (const [index, card] of cards.entries()) {
        ffArgs.push(
            "-map",
            `[card${index}]`,
            "-frames:v",
            "1",
            "-update",
            "1",
            card.outputPath,
        );
    }

    await runProcess("ffmpeg", ffArgs, log);
}

async function main() {
    const id = process.argv[2];
    if (!id) {
        throw new Error("Experiment id is required");
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI must be set");
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db("clips");
    const collection = db.collection("ffmpegExperiments");
    let wasCancelled = false;
    let currentId: ObjectId | null = null;

    const log = async (message: string) => {
        await collection.updateOne(
            { _id: currentId },
            {
                $push: {
                    logs: {
                        message,
                        createdAt: new Date().toISOString(),
                    },
                },
                $set: {
                    updatedAt: new Date(),
                },
            },
        );
    };

    const setStep = async (
        step: string,
        status: "queued" | "running" | "completed" | "failed" = "running",
    ) => {
        await collection.updateOne(
            { _id: currentId },
            {
                $set: {
                    currentStep: step,
                    currentStepPercent: 0,
                    currentStepFrameCount: 0,
                    currentStepTotalFrames: 0,
                    status,
                    updatedAt: new Date(),
                },
            },
        );
        await log(step);
    };

    const setProgress = async (progress: {
        frame?: number;
        fps?: number;
        time?: number;
        totalSeconds?: number;
    }) => {
        if (!currentId || !progress.frame) return;
        let percent = 0;
        if (progress.totalSeconds && progress.time) {
            percent = Math.min(100, Math.round((progress.time / progress.totalSeconds) * 100));
        }
        await collection.updateOne(
            { _id: currentId },
            {
                $set: {
                    currentStepPercent: percent,
                    currentStepFrameCount: progress.frame,
                    updatedAt: new Date(),
                },
            },
        );
    };

    const markCancelled = async (message: string) => {
        if (!currentId || wasCancelled) return;
        wasCancelled = true;
        await collection.updateOne(
            { _id: currentId },
            {
                $set: {
                    status: "cancelled",
                    currentStep: "Cancelled",
                    workerPid: null,
                    updatedAt: new Date(),
                },
                $push: {
                    logs: {
                        message,
                        createdAt: new Date().toISOString(),
                    },
                },
            },
        );
    };

    process.on("SIGTERM", () => {
        void markCancelled("Processing cancelled").finally(() => {
            process.exit(0);
        });
    });

    try {
        currentId = new ObjectId(id);
        const experiment = await collection.findOne({ _id: currentId });
        if (!experiment) throw new Error("Experiment not found");

        const existingVerseKey = experiment.verseKey as
            | string
            | null
            | undefined;
        const existingRecitationId = experiment.recitationId as
            | string
            | null
            | undefined;
        const requiresSelectedVerse =
            experiment.operation === "mix_random_verse";

        if (
            (existingVerseKey && !existingRecitationId) ||
            (!existingVerseKey && existingRecitationId)
        ) {
            throw new Error(
                "Experiment has incomplete verse selection metadata",
            );
        }
        if (
            requiresSelectedVerse &&
            (!existingVerseKey || !existingRecitationId)
        ) {
            throw new Error(
                "This experiment requires the verse selected in the UI; no verse was stored on the job",
            );
        }

        let recitationId: string;
        let reciterName: string;

        if (existingVerseKey && existingRecitationId) {
            recitationId = existingRecitationId;
            reciterName =
                RECITER_PATHS[recitationId]?.label ?? `Reciter ${recitationId}`;
            await log(`Reusing reciter: ${reciterName}`);
        } else {
            await setStep("Choose enabled reciter");
            const config = await db
                .collection("configuration")
                .findOne({ type: "reciters" });
            const enabledIds = (
                (config?.enabledIds as number[] | undefined) ?? []
            ).map(String);
            if (enabledIds.length === 0)
                throw new Error("No enabled reciters found");
            recitationId = chooseRandom(enabledIds);
            reciterName =
                RECITER_PATHS[recitationId]?.label ?? `Reciter ${recitationId}`;
            await log(`Selected reciter: ${reciterName}`);
        }

        const videoConfigDoc = await db
            .collection("configuration")
            .findOne({ type: "video" });
        const randomAyahMinSeconds =
            typeof videoConfigDoc?.randomAyahMinSeconds === "number"
                ? videoConfigDoc.randomAyahMinSeconds
                : 0;
        const randomAyahMaxSeconds =
            typeof videoConfigDoc?.randomAyahMaxSeconds === "number"
                ? videoConfigDoc.randomAyahMaxSeconds
                : 30;
        const clipTailSeconds =
            typeof videoConfigDoc?.clipTailSeconds === "number"
                ? videoConfigDoc.clipTailSeconds
                : 0;
        const maxVideoClipSeconds =
            typeof videoConfigDoc?.maxVideoClipSeconds === "number"
                ? videoConfigDoc.maxVideoClipSeconds
                : 5;

        await setStep("Collect available videos");
        const timedVideos = await collectTimedVideos(db);
        if (timedVideos.length === 0) {
            throw new Error("No valid videos available");
        }
        const maxCoverageSeconds = timedVideos.reduce(
            (sum, video) => sum + Math.min(video.durationSeconds, maxVideoClipSeconds),
            0,
        );
        await log(
            `Unique usable video coverage: ${maxCoverageSeconds.toFixed(2)}s`,
        );

        let verse: VersePayload;
        let targetSeconds: number;

        if (existingVerseKey && existingRecitationId) {
            await setStep("Fetch selected verse");
            verse = await getVerseByKey(existingVerseKey, recitationId);
            const tempAudioPath = createProbeAudioPath();
            try {
                await downloadFile(
                    verseAudioUrl(existingVerseKey, recitationId),
                    tempAudioPath,
                );
                if (!fs.existsSync(tempAudioPath)) {
                    throw new Error(`Downloaded audio file not found at ${tempAudioPath}`);
                }
                const stats = fs.statSync(tempAudioPath);
                await log(`Downloaded audio: ${stats.size} bytes`);
                if (stats.size === 0) {
                    throw new Error(`Downloaded audio file is empty (0 bytes)`);
                }
                targetSeconds = await ffprobeDuration(tempAudioPath);
            } catch (err) {
                await log(`Error fetching verse audio: ${err instanceof Error ? err.message : String(err)}`);
                throw err;
            } finally {
                if (fs.existsSync(tempAudioPath))
                    fs.rmSync(tempAudioPath, { force: true });
            }
            await log(
                `Using selected verse ${existingVerseKey} (${targetSeconds.toFixed(2)}s)`,
            );
        } else {
            await setStep("Fetch random verse");
            ({ verse, durationSeconds: targetSeconds } =
                await selectRenderableVerse(
                    recitationId,
                    maxCoverageSeconds,
                    randomAyahMinSeconds,
                    randomAyahMaxSeconds,
                    log,
                ));
            await log(`Selected verse ${verse.verse_key}`);
        }

        const verseKey = verse.verse_key;
        const verseText = verse.text_uthmani ?? null;

        await collection.updateOne(
            { _id: currentId },
            {
                $set: {
                    recitationId,
                    reciterName,
                    verseKey,
                    verseText,
                    updatedAt: new Date(),
                },
            },
        );

        const paths = createExperimentOutputPaths(id);
        const outputName = makeOutputFilename(
            verseKey,
            reciterName,
            Date.now(),
        );
        const finalPath = path.join(paths.workDir, outputName);

        await setStep("Download verse audio");
        await downloadFile(
            verseAudioUrl(verseKey, recitationId),
            paths.verseAudio,
        );
        await log(`Verse audio duration ${targetSeconds.toFixed(2)}s`);

        await setStep("Choose random video sequence");
        const videoTargetSeconds = Math.max(targetSeconds + clipTailSeconds, 0.5);
        const sequence = buildVideoSequence(timedVideos, videoTargetSeconds, maxVideoClipSeconds);
        await log(
            `Sequence: ${sequence
                .map(
                    (video) =>
                        `${video.originalFilename} (${video.startOffsetSeconds.toFixed(2)}s + ${video.clipDurationSeconds.toFixed(2)}s)`,
                )
                .join(" -> ")}`,
        );

        let lutPath: string | null = null;
        let lutName: string | null = null;
        if (experiment.lutId) {
            const lut = await db
                .collection("luts")
                .findOne({ _id: experiment.lutId as ObjectId });
            lutPath = lut?.filePath ?? null;
            lutName = (lut?.originalFilename as string | undefined) ?? null;
        } else {
            const luts = await db.collection("luts").find().toArray();
            if (luts.length > 0) {
                const randomLut = chooseRandom(luts);
                lutPath = (randomLut.filePath as string | undefined) ?? null;
                lutName =
                    (randomLut.originalFilename as string | undefined) ?? null;
                if (randomLut._id) {
                    await collection.updateOne(
                        { _id: currentId },
                        {
                            $set: {
                                lutId: randomLut._id,
                                updatedAt: new Date(),
                            },
                        },
                    );
                }
            }
        }
        if (lutName) {
            await log(`Selected LUT: ${lutName}`);
        } else {
            await log("No LUT selected or available");
        }

        let overlayPath: string | null = null;
        let overlayName: string | null = null;
        let overlayBlendMode: string | null = null;
        if (experiment.overlayId) {
            const overlay = await db
                .collection("overlays")
                .findOne({ _id: experiment.overlayId as ObjectId });
            overlayPath = (overlay?.filePath as string | null) ?? null;
            overlayName =
                (overlay?.name as string | undefined) ??
                (overlay?.originalFilename as string | undefined) ??
                null;
            overlayBlendMode =
                (experiment.overlayBlendMode as string | null | undefined) ??
                "normal";
        }
        if (overlayName && overlayBlendMode) {
            await log(`Selected overlay: ${overlayName} (${overlayBlendMode})`);
        } else {
            await log("No overlay selected");
        }
        await collection.updateOne(
            { _id: currentId },
            {
                $set: {
                    sourceVideoIds: sequence.map((video) =>
                        video._id.toString(),
                    ),
                    sourceVideoNames: sequence.map(
                        (video) => video.originalFilename,
                    ),
                    sourceVideoCount: sequence.length,
                    outputName,
                    overlayName,
                    overlayBlendMode,
                    updatedAt: new Date(),
                },
            },
        );

        await setStep("Prepare reusable square masters");
        const preparedDurations = new Map<string, number>();
        for (const segment of sequence) {
            if (fs.existsSync(segment.preparedPath)) {
                await log(
                    `Reusing prepared master for ${segment.originalFilename}`,
                );
            } else {
                await log(
                    `Preparing square master for ${segment.originalFilename}`,
                );
                await runFfmpegWithProgress(
                    [
                        "-y",
                        "-i",
                        segment.filePath,
                        "-vf",
                        `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1,fps=${OUTPUT_FPS}`,
                        "-c:v",
                        "libx264",
                        "-preset",
                        "veryfast",
                        "-crf",
                        "18",
                        "-pix_fmt",
                        "yuv420p",
                        "-an",
                        segment.preparedPath,
                    ],
                    log,
                    setProgress,
                );
            }
            if (!preparedDurations.has(segment.preparedPath)) {
                preparedDurations.set(
                    segment.preparedPath,
                    await ffprobeDuration(segment.preparedPath),
                );
            }
        }

        await setStep("Cut 5-second square segments");
        const preparedFiles: string[] = [];
        for (const [index, video] of sequence.entries()) {
            const preparedPath = path.join(
                paths.preparedDir,
                `${String(index + 1).padStart(2, "0")}.mp4`,
            );
            preparedFiles.push(preparedPath);
            const preparedDurationSeconds = preparedDurations.get(
                video.preparedPath,
            );
            if (!preparedDurationSeconds) {
                throw new Error(
                    `Missing prepared duration for ${video.originalFilename}`,
                );
            }
            await createValidatedSegment(
                video,
                preparedDurationSeconds,
                preparedPath,
                log,
            );
        }

        await setStep("Stitch prepared clips");
        fs.writeFileSync(
            paths.concatList,
            preparedFiles
                .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
                .join("\n"),
            "utf8",
        );

        await runFfmpegWithProgress(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                paths.concatList,
                "-t",
                videoTargetSeconds.toFixed(3),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-an",
                paths.stitched,
            ],
            log,
            setProgress,
        );

        let currentVideo = paths.stitched;

        if (lutPath) {
            await setStep("Apply LUT");
            await runFfmpegWithProgress(
                [
                    "-y",
                    "-i",
                    currentVideo,
                    "-vf",
                    `lut3d=file=${lutPath}`,
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "18",
                    "-pix_fmt",
                    "yuv420p",
                    "-an",
                    paths.lutted,
                ],
                log,
                setProgress,
            );
            currentVideo = paths.lutted;
        }

        const vignetteStrength =
            typeof videoConfigDoc?.vignette === "number"
                ? videoConfigDoc.vignette
                : 0;
        const exposureStops =
            typeof videoConfigDoc?.exposure === "number"
                ? videoConfigDoc.exposure
                : 0;
        const saturationAmount =
            typeof videoConfigDoc?.saturation === "number"
                ? videoConfigDoc.saturation
                : 1;
        const audioLeadSeconds =
            typeof videoConfigDoc?.audioLeadSeconds === "number"
                ? videoConfigDoc.audioLeadSeconds
                : 1.5;
        const postFilters: string[] = [
            `scale=${VIDEO_PIXELATE_SIZE}:${VIDEO_PIXELATE_SIZE}:flags=neighbor,scale=1080:1080:flags=neighbor`,
        ];
        if (vignetteStrength > 0)
            postFilters.push(
                `vignette=a=${(Math.PI * 0.9 * vignetteStrength).toFixed(4)}`,
            );
        if (exposureStops !== 0)
            postFilters.push(`exposure=exposure=${exposureStops.toFixed(2)}`);
        if (saturationAmount !== 1)
            postFilters.push(`eq=saturation=${saturationAmount.toFixed(2)}`);

        if (postFilters.length > 0) {
            await setStep("Apply post-processing");
            await runFfmpegWithProgress(
                [
                    "-y",
                    "-i",
                    currentVideo,
                    "-vf",
                    postFilters.join(","),
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "18",
                    "-pix_fmt",
                    "yuv420p",
                    "-an",
                    paths.postprocessed,
                ],
                log,
                setProgress,
            );
            currentVideo = paths.postprocessed;
        }

        const textOverride = experiment.textOverride as { title?: string; subtitle?: string; titleFontSize?: number; subtitleFontSize?: number; scaleX?: number; scaleY?: number; lineSpacing?: number } | null | undefined;

        if (textOverride?.title) {
            await setStep("Render text card overlay");
            const assPath = path.join(paths.workDir, "override.ass");
            const pngPath = path.join(paths.workDir, "override.png");
            await renderSubtitleCardPngBatch([{
                arabic: textOverride.title,
                english: textOverride.subtitle ?? "",
                titleFontSize: textOverride.titleFontSize ?? 36,
                subtitleFontSize: textOverride.subtitleFontSize ?? 11,
                scaleX: textOverride.scaleX ?? 80,
                scaleY: textOverride.scaleY ?? 125,
                lineSpacing: textOverride.lineSpacing ?? 8,
                assPath,
                outputPath: pngPath,
            }], log);

            await runFfmpegWithProgress(
                [
                    "-y", "-i", currentVideo,
                    "-loop", "1", "-i", pngPath,
                    "-filter_complex",
                    `[0:v][1:v]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2:enable='between(t,0,${targetSeconds.toFixed(3)})':eof_action=pass[vout]`,
                    "-map", "[vout]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an",
                    "-shortest",
                    paths.textOverlaid,
                ],
                log, setProgress,
            );
            if (fs.existsSync(pngPath)) fs.rmSync(pngPath, { force: true });
            if (fs.existsSync(assPath)) fs.rmSync(assPath, { force: true });
            currentVideo = paths.textOverlaid;
        }

        const rawWords = [...(verse.words ?? [])].sort(
            (a, b) => a.position - b.position,
        );
        const timedWords = mergeSegmentTimings(rawWords, verse.audio?.segments);
        const textWords = timedWords.filter(
            (w) => w.char_type_name === "word" && getOverlayWordText(w),
        );
        if (!textOverride?.title && textWords.length > 0) {
            await setStep("Render Arabic text overlay");
            const pairCount = Math.ceil(textWords.length / 2);
            const slotSeconds = targetSeconds / pairCount;

            // collect arabic segments for translation mapping
            const arabicSegments = [];
            for (let i = 0; i < textWords.length; i += 2) {
                const chunk = textWords.slice(i, i + 2);
                const arabicText = chunk
                    .map((w) => getOverlayWordText(w))
                    .join(" ");
                arabicSegments.push({
                    text: arabicText,
                    position: Math.floor(i / 2),
                });
            }

            // get full verse translation — QF API may omit it, fall back to public Quran.com API
            let fullTranslation =
                verse.translations?.[0]?.text?.replace(/<[^>]+>/g, "").trim() ?? "";
            await log(`Gemini: mapping ${arabicSegments.length} segments from translation: "${fullTranslation.substring(0, 120)}"`);
            const mappedSegments = fullTranslation
                ? await mapTranslationsToSegments(arabicSegments, fullTranslation, log)
                      .then((segments) => {
                          log(`Gemini: mapped ${segments.length} segments successfully`);
                          segments.forEach((s, i) => log(`Gemini segment ${i + 1}: "${s.arabicText}" → "${s.englishTranslation}"`));
                          return segments;
                      })
                      .catch(async (err) => {
                          await log(`Gemini: failed - ${err instanceof Error ? err.message : String(err)}, falling back to segment translations`);
                          return null;
                      })
                : null;

            const pairs: {
                arabic: string;
                english: string;
                startS: number;
                endS: number;
            }[] = [];
            for (let i = 0; i < textWords.length; i += 2) {
                const chunk = textWords.slice(i, i + 2);
                const pairIndex = Math.floor(i / 2);
                const timedChunk = chunk.filter(
                    (word) =>
                        typeof word.timestamp_from === "number" &&
                        typeof word.timestamp_to === "number",
                );
                const firstTimedWord = timedChunk[0];
                const lastTimedWord = timedChunk[timedChunk.length - 1];
                const fallbackStart = pairIndex * slotSeconds;
                const fallbackEnd = (pairIndex + 1) * slotSeconds;
                const startS = pairIndex === 0
                    ? 0
                    : firstTimedWord
                      ? Math.max(
                            firstTimedWord.timestamp_from! / 1000 -
                                TEXT_PAIR_LEAD_SECONDS,
                            0,
                        )
                      : fallbackStart;
                let endS = lastTimedWord
                    ? Math.min(
                          lastTimedWord.timestamp_to! / 1000 +
                              TEXT_PAIR_TAIL_SECONDS,
                          targetSeconds,
                      )
                    : fallbackEnd;

                if (endS <= startS) {
                    endS = Math.min(
                        startS + TEXT_PAIR_MIN_SECONDS,
                        targetSeconds,
                    );
                }

                pairs.push({
                    arabic: chunk.map((w) => getOverlayWordText(w)).join(" "),
                    english:
                        mappedSegments?.[pairIndex]?.englishTranslation ??
                        chunk
                            .map((w) => getOverlayWordTranslation(w))
                            .filter(Boolean)
                            .join(" "),
                    startS,
                    endS,
                });
            }

            for (let i = 0; i < pairs.length - 1; i += 1) {
                const nextStart = pairs[i + 1].startS;
                const maxEnd = Math.max(
                    pairs[i].startS + TEXT_PAIR_MIN_SECONDS,
                    nextStart - TEXT_PAIR_GAP_SECONDS,
                );
                pairs[i].endS = Math.min(pairs[i].endS, maxEnd, targetSeconds);
                if (pairs[i].endS <= pairs[i].startS) {
                    pairs[i].endS = Math.min(
                        pairs[i].startS + TEXT_PAIR_MIN_SECONDS,
                        targetSeconds,
                    );
                }
            }

            const pngPaths: string[] = [];
            const cardArtifacts = pairs.map((pair, index) => {
                const number = String(index + 1).padStart(2, "0");
                return {
                    arabic: pair.arabic,
                    english: pair.english,
                    assPath: path.join(paths.workDir, `pair_${number}.ass`),
                    outputPath: path.join(paths.workDir, `pair_${number}.png`),
                };
            });
            await renderSubtitleCardPngBatch(cardArtifacts, log);
            for (const artifact of cardArtifacts) {
                pngPaths.push(artifact.outputPath);
            }

            const ffArgs: string[] = ["-y", "-i", currentVideo];
            for (const pngPath of pngPaths) {
                ffArgs.push("-loop", "1", "-i", pngPath);
            }

            const filterParts: string[] = [];
            let prevStream = "0:v";
            for (let i = 0; i < pairs.length; i += 1) {
                const { startS, endS } = pairs[i];
                const outStream = i === pairs.length - 1 ? "vout" : `v${i}`;
                filterParts.push(
                    `[${prevStream}][${i + 1}:v]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2:enable='between(t,${startS.toFixed(3)},${endS.toFixed(3)})':eof_action=pass[${outStream}]`,
                );
                prevStream = outStream;
            }

            await runFfmpegWithProgress(
                [
                    ...ffArgs,
                    "-filter_complex",
                    filterParts.join(";"),
                    "-map",
                    "[vout]",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "18",
                    "-pix_fmt",
                    "yuv420p",
                    "-an",
                    paths.textOverlaid,
                ],
                log,
                setProgress,
            );

            for (let i = 0; i < pngPaths.length; i += 1) {
                if (fs.existsSync(pngPaths[i]))
                    fs.rmSync(pngPaths[i], { force: true });
                const cardAssPath = cardArtifacts[i].assPath;
                if (fs.existsSync(cardAssPath))
                    fs.rmSync(cardAssPath, { force: true });
            }

            currentVideo = paths.textOverlaid;
        }

        if (overlayPath && fs.existsSync(overlayPath)) {
            await setStep("Apply overlay image");
            const overlayScale = `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1`;
            const overlayFilter =
                overlayBlendMode && overlayBlendMode !== "normal"
                    ? `[1:v]${overlayScale},format=gbrp[ovr];[0:v]format=gbrp[base];[base][ovr]blend=all_mode=${overlayBlendMode}[vout]`
                    : `[1:v]${overlayScale}[ovr];[0:v][ovr]overlay=0:0:eof_action=pass[vout]`;
            await runFfmpegWithProgress(
                [
                    "-y",
                    "-i",
                    currentVideo,
                    "-loop",
                    "1",
                    "-i",
                    overlayPath,
                    "-filter_complex",
                    overlayFilter,
                    "-map",
                    "[vout]",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "18",
                    "-pix_fmt",
                    "yuv420p",
                    "-an",
                    "-shortest",
                    paths.overlaid,
                ],
                log,
                setProgress,
            );
            currentVideo = paths.overlaid;
        }

        if (experiment.operation === "mix_random_verse") {
            await setStep("Merge Quran audio");
            const audioInputArgs =
                audioLeadSeconds > 0
                    ? ["-ss", audioLeadSeconds.toFixed(3), "-i", paths.verseAudio]
                    : ["-i", paths.verseAudio];
            const audioMapArgs =
                clipTailSeconds > 0
                    ? ["-filter_complex", `[1:a]apad=pad_dur=${clipTailSeconds.toFixed(3)}[a]`, "-map", "0:v:0", "-map", "[a]"]
                    : ["-map", "0:v:0", "-map", "1:a:0"];
            await runFfmpegWithProgress(
                [
                    "-y",
                    "-i", currentVideo,
                    ...audioInputArgs,
                    ...audioMapArgs,
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-shortest",
                    finalPath,
                ],
                log,
                setProgress,
            );
        } else {
            fs.copyFileSync(currentVideo, finalPath);
        }

        cleanupIntermediateArtifacts(paths, finalPath);

        await collection.updateOne(
            { _id: currentId },
            {
                $set: {
                    status: "completed",
                    currentStep: "Complete",
                    updatedAt: new Date(),
                    outputPath: finalPath,
                    outputName,
                    outputCreatedAt: new Date(),
                    outputExpiredAt: null,
                    workerPid: null,
                },
            },
        );
        const expiryWorker = spawn(
            "pnpm",
            [
                "exec",
                "tsx",
                "scripts/expire-ffmpeg-output.ts",
                currentId.toString(),
                finalPath,
            ],
            {
                cwd: process.cwd(),
                env: process.env,
                detached: true,
                stdio: "ignore",
            },
        );
        expiryWorker.unref();
        await log("Pipeline complete");
    } catch (error) {
        if (wasCancelled) {
            return;
        }
        await collection.updateOne(
            { _id: currentId ?? new ObjectId(id) },
            {
                $set: {
                    status: "failed",
                    currentStep: "Failed",
                    updatedAt: new Date(),
                    error:
                        error instanceof Error ? error.message : String(error),
                    workerPid: null,
                },
                $push: {
                    logs: {
                        message:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        createdAt: new Date().toISOString(),
                    },
                },
            },
        );
        process.exitCode = 1;
    } finally {
        await client.close().catch(() => {});
    }
}

void main();
