import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import { spawn } from "child_process";

const CONCURRENCY = 3;
const AUTOCLIP_INTERVAL_MS = 3600000; // 1 hour

declare global {
    var __workerRunning: boolean | undefined;
    var __runningJobs: Map<string, AbortController> | undefined;
    var __lastAutoclipTime: number | undefined;
}

global.__runningJobs ??= new Map();
global.__workerRunning ??= false;
global.__lastAutoclipTime ??= 0;

export function cancelJob(jobId: string) {
    const ac = global.__runningJobs!.get(jobId);
    if (ac) {
        ac.abort();
        global.__runningJobs!.delete(jobId);
    }
}

export function isJobRunning(jobId: string): boolean {
    return global.__runningJobs!.has(jobId);
}

async function runAutoclipJob(
    db: Awaited<ReturnType<typeof getDb>>,
    job: { _id: ObjectId; status: string },
    signal: AbortSignal,
) {
    try {
        await db
            .collection("autoclipJobs")
            .updateOne(
                { _id: job._id },
                { $set: { status: "processing", startedAt: new Date() } },
            );

        const verse = await (async () => {
            const reciterCfg = await db.collection("configuration").findOne({ type: "reciters" }) as {
                enabledIds?: (string | number)[];
            } | null;

            const enabledIds = Array.isArray(reciterCfg?.enabledIds) && reciterCfg.enabledIds.length > 0
                ? reciterCfg.enabledIds.map(String)
                : ["7"];
            const recitationId = enabledIds[Math.floor(Math.random() * enabledIds.length)];

            const res = await fetch(
                `https://api.quran.com/api/v4/verses/random?recitation=${recitationId}&words=true&translations=131&word_fields=text_uthmani,text_imlaei,text_imlaei_simple,translation,code_v1`,
                { signal },
            );
            const data = (await res.json()) as {
                verse?: Record<string, unknown>;
            };
            return { verse: data.verse, recitationId };
        })();

        if (!verse.verse || typeof verse.verse.verse_key !== "string") {
            throw new Error("Failed to fetch verse");
        }

        const videoCfg = await db.collection("configuration").findOne({ type: "video" }) as {
            overlayId?: string;
            overlayBlendMode?: string;
        } | null;

        const videos = await db
            .collection("videos")
            .find({})
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();
        if (!videos.length) throw new Error("No videos available");

        const videoId = (videos[0]._id as ObjectId).toString();
        const verseKey = verse.verse.verse_key as string;
        const recitationId = verse.recitationId;
        const experimentId = new ObjectId().toString();

        const experiment = {
            _id: new ObjectId(experimentId),
            verseKey,
            recitationId,
            sourceVideoIds: [videoId],
            sourceVideoNames: [
                (videos[0].originalFilename as string) ?? "video",
            ],
            overlayId: videoCfg?.overlayId ?? null,
            overlayBlendMode: videoCfg?.overlayBlendMode ?? null,
            status: "queued",
            currentStep: "Queued",
            logs: [
                {
                    message: "Auto-clip job",
                    createdAt: new Date().toISOString(),
                },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection("ffmpegExperiments").insertOne(experiment);

        await new Promise<void>((resolve, reject) => {
            const proc = spawn("pnpm", [
                "exec",
                "tsx",
                "scripts/ffmpeg-pipeline-runner.ts",
                experimentId,
                "pipeline",
                videoId,
                verseKey,
                recitationId,
            ]);
            proc.on("error", reject);
            proc.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Pipeline exited with code ${code}`));
            });
        });

        const uploadRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`}/api/ffmpeg/experiments/${experimentId}/upload`,
            {
                method: "POST",
                signal,
            },
        );

        if (!uploadRes.ok) throw new Error("Upload failed");

        await db
            .collection("autoclipJobs")
            .updateOne(
                { _id: job._id },
                { $set: { status: "completed", completedAt: new Date() } },
            );
    } catch (error) {
        await db.collection("autoclipJobs").updateOne(
            { _id: job._id },
            {
                $set: {
                    status: "failed",
                    error:
                        error instanceof Error ? error.message : String(error),
                    failedAt: new Date(),
                },
            },
        );
        throw error;
    }
}

async function tick() {
    const jobs = global.__runningJobs!;
    if (jobs.size >= CONCURRENCY) return;

    try {
        const db = await getDb();
        const slots = CONCURRENCY - jobs.size;
        const runningIds = [...jobs.keys()];

        // auto-schedule hourly clip if needed
        const now = Date.now();
        if (now - global.__lastAutoclipTime! >= AUTOCLIP_INTERVAL_MS) {
            global.__lastAutoclipTime = now;
            const randomDelayMs = Math.random() * (15 * 60 * 1000 - 1 * 60 * 1000) + 1 * 60 * 1000;
            await db.collection("autoclipJobs").insertOne({
                _id: new ObjectId(),
                status: "queued",
                createdAt: new Date(),
                processAfter: new Date(now + randomDelayMs),
                updatedAt: new Date(),
            });
        }

        const queuedJobs = await db
            .collection("autoclipJobs")
            .find({
                status: "queued",
                processAfter: { $lte: new Date() },
                _id: { $nin: runningIds.map((id) => new ObjectId(id)) },
            })
            .limit(slots)
            .toArray();

        for (const job of queuedJobs) {
            const ac = new AbortController();
            const jobId = job._id!.toString();
            jobs.set(jobId, ac);
            runAutoclipJob(
                db,
                job as { _id: ObjectId; status: string },
                ac.signal,
            )
                .catch(() => {})
                .finally(() => jobs.delete(jobId));
        }
    } catch {
        // DB not ready yet
    }
}

export function startWorker() {
    if (global.__workerRunning) return;
    global.__workerRunning = true;

    setInterval(tick, 3000);
    tick();
    console.log(
        "[worker] Queue worker started (concurrency=3, autoclip=hourly)",
    );
}
