import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import { spawn } from "child_process";

const AUTOCLIP_INTERVAL_MS = 3600000;

type AutoclipRunResult =
    | {
          status: "started";
          jobId: string;
          experimentId: string;
          verseKey: string;
          recitationId: string;
      }
    | {
          status: "busy";
          reason: string;
      }
    | {
          status: "skipped";
          jobId: string;
          reason: string;
      };

declare global {
    var __workerRunning: boolean | undefined;
    var __autoclipRunning: boolean | undefined;
}

global.__workerRunning ??= false;
global.__autoclipRunning ??= false;

function logWorker(message: string) {
    console.log(`[worker] ${message}`);
}

export async function runAutoclip(): Promise<AutoclipRunResult> {
    if (global.__autoclipRunning) {
        logWorker("run requested while another autoclip run is already active");
        return {
            status: "busy",
            reason: "Another autoclip run is already active.",
        };
    }
    global.__autoclipRunning = true;

    const jobId = new ObjectId();
    let db: Awaited<ReturnType<typeof getDb>> | null = null;

    try {
        logWorker(`starting autoclip run ${jobId}`);
        db = await getDb();
        logWorker(`connected to database for job ${jobId}`);

        // db-level guard: skip if a job is already processing or started recently
        const cutoff = new Date(Date.now() - 90 * 60 * 1000);
        const active = await db.collection("autoclipJobs").findOne({
            status: "processing",
            startedAt: { $gt: cutoff },
        });
        if (active) {
            logWorker(
                `job ${jobId} skipped because autoclip job ${active._id?.toString?.() ?? "unknown"} is already processing`,
            );
            return {
                status: "busy",
                reason: "An autoclip job is already processing.",
            };
        }
        await db.collection("autoclipJobs").insertOne({
            _id: jobId,
            status: "processing",
            startedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        logWorker(`job ${jobId} inserted into autoclipJobs`);

        const appBase = process.env.NEXT_PUBLIC_APP_URL || `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3000}`;
        logWorker(`job ${jobId} using app base ${appBase}`);

        const reciterCfg = await db.collection("configuration").findOne({ type: "reciters" }) as {
            enabledIds?: (string | number)[];
        } | null;
        const enabledIds = Array.isArray(reciterCfg?.enabledIds) && reciterCfg.enabledIds.length > 0
            ? reciterCfg.enabledIds.map(String)
            : ["7"];
        logWorker(`job ${jobId} enabled reciters: ${enabledIds.join(", ")}`);

        let verse: Record<string, unknown> | null = null;
        let recitationId = "7";
        for (let i = 0; i < 3 && !verse; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 1500));
            const rid = enabledIds[Math.floor(Math.random() * enabledIds.length)];
            logWorker(`job ${jobId} requesting random verse attempt ${i + 1} with reciter ${rid}`);
            const res = await fetch(`${appBase}/api/qf/verses?random=true&recitation=${rid}`);
            if (!res.ok) {
                logWorker(`job ${jobId} random verse request failed with HTTP ${res.status}`);
                continue;
            }
            const data = await res.json() as { verse?: Record<string, unknown> };
            if (data.verse) { verse = data.verse; recitationId = rid; }
        }

        if (!verse || typeof verse.verse_key !== "string") {
            await db.collection("autoclipJobs").updateOne(
                { _id: jobId },
                { $set: { status: "skipped", skippedAt: new Date(), updatedAt: new Date() } },
            );
            logWorker(`job ${jobId} skipped because no verse was found`);
            return {
                status: "skipped",
                jobId: jobId.toString(),
                reason: "No verse was found for the enabled reciters.",
            };
        }
        logWorker(`job ${jobId} selected verse ${verse.verse_key} with reciter ${recitationId}`);

        const videos = await db.collection("videos").find({}).sort({ createdAt: -1 }).limit(1).toArray();
        if (!videos.length) throw new Error("no videos available");

        const videoId = (videos[0]._id as ObjectId).toString();
        const verseKey = verse.verse_key as string;
        logWorker(`job ${jobId} selected video ${videoId}`);

        const videoCfg = await db.collection("configuration").findOne({ type: "video" }) as {
            overlayId?: string;
            overlayBlendMode?: string;
        } | null;

        const experimentId = new ObjectId().toString();
        await db.collection("ffmpegExperiments").insertOne({
            _id: new ObjectId(experimentId),
            operation: "mix_random_verse",
            verseKey,
            recitationId,
            sourceVideoIds: [videoId],
            sourceVideoNames: [(videos[0].originalFilename as string) ?? "video"],
            overlayId: videoCfg?.overlayId ?? null,
            overlayBlendMode: videoCfg?.overlayBlendMode ?? null,
            status: "queued",
            currentStep: "Queued",
            logs: [{ message: "Auto-clip job", createdAt: new Date().toISOString() }],
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await db.collection("autoclipJobs").updateOne(
            { _id: jobId },
            { $set: { experimentId, updatedAt: new Date() } },
        );
        logWorker(`job ${jobId} created experiment ${experimentId}`);

        await new Promise<void>((resolve, reject) => {
            logWorker(`job ${jobId} spawning pipeline runner for experiment ${experimentId}`);
            const proc = spawn("pnpm", [
                "exec", "tsx",
                "scripts/ffmpeg-pipeline-runner.ts",
                experimentId,
                "pipeline",
                videoId,
                verseKey,
                recitationId,
            ], { cwd: process.cwd(), env: process.env });
            logWorker(`job ${jobId} pipeline pid ${proc.pid ?? "unknown"}`);
            proc.on("error", reject);
            proc.on("close", (code) => {
                logWorker(`job ${jobId} pipeline exited with code ${code}`);
                if (code === 0) resolve();
                else reject(new Error(`pipeline exited with code ${code}`));
            });
        });

        logWorker(`job ${jobId} starting upload for experiment ${experimentId}`);
        const uploadRes = await fetch(`${appBase}/api/ffmpeg/experiments/${experimentId}/upload`, {
            method: "POST",
        });
        if (!uploadRes.ok) {
            logWorker(`job ${jobId} upload failed with HTTP ${uploadRes.status}`);
            throw new Error("upload failed");
        }
        logWorker(`job ${jobId} upload finished for experiment ${experimentId}`);

        await db.collection("autoclipJobs").updateOne(
            { _id: jobId },
            { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date() } },
        );
        logWorker(`job ${jobId} completed successfully`);
        return {
            status: "started",
            jobId: jobId.toString(),
            experimentId,
            verseKey,
            recitationId,
        };
    } catch (error) {
        logWorker(
            `job ${jobId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (db) {
            await db.collection("autoclipJobs").updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: "failed",
                        error: error instanceof Error ? error.message : String(error),
                        failedAt: new Date(),
                        updatedAt: new Date(),
                    },
                },
            ).catch(() => {});
        }
        throw error;
    } finally {
        global.__autoclipRunning = false;
        logWorker(`autoclip run ${jobId} finished`);
    }
}

export function startWorker() {
    if (global.__workerRunning) return;
    global.__workerRunning = true;
    setInterval(() => void runAutoclip(), AUTOCLIP_INTERVAL_MS);
    void runAutoclip();
    console.log("[worker] started (autoclip=hourly)");
}
