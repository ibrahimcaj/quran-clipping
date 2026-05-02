import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const OUTPUT_FPS = 30;

function runProcess(command: string, args: string[], onLine?: (line: string) => Promise<void> | void) {
    return new Promise<void>((resolve, reject) => {
        const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
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
                const interesting =
                    line.includes("time=") ||
                    line.includes("Duration:") ||
                    line.startsWith("Input #") ||
                    line.startsWith("Output #") ||
                    line.includes("Stream mapping");

                const now = Date.now();
                if (interesting && onLine && now - lastLoggedAt > 700) {
                    lastLoggedAt = now;
                    await onLine(line);
                }
            }
        });

        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
        });
    });
}

function ffprobeDuration(inputPath: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const proc = spawn("ffprobe", [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            inputPath,
        ], { stdio: ["ignore", "pipe", "pipe"] });

        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
        proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || "ffprobe failed"));
                return;
            }
            const seconds = Number.parseFloat(stdout.trim());
            if (!Number.isFinite(seconds) || seconds <= 0) {
                reject(new Error("Invalid duration"));
                return;
            }
            resolve(seconds);
        });
    });
}

async function main() {
    const id = process.argv[2];
    if (!id || !ObjectId.isValid(id)) {
        throw new Error("Valid video id is required");
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI must be set");
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db("clips");
    const collection = db.collection("videos");
    const _id = new ObjectId(id);

    const log = async (message: string) => {
        await collection.updateOne(
            { _id },
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

    const setStep = async (step: string, status: "queued" | "processing" | "ready" | "failed" = "processing") => {
        await collection.updateOne(
            { _id },
            {
                $set: {
                    status,
                    currentStep: step,
                    updatedAt: new Date(),
                },
            },
        );
        await log(step);
    };

    let tempUploadPath: string | null = null;
    let finalPath: string | null = null;

    try {
        const doc = await collection.findOne({ _id });
        if (!doc) {
            throw new Error("Video not found");
        }

        tempUploadPath = typeof doc.tempUploadPath === "string" ? doc.tempUploadPath : null;
        finalPath = typeof doc.filePath === "string" ? doc.filePath : null;
        if (!tempUploadPath || !fs.existsSync(tempUploadPath)) {
            throw new Error("Uploaded source file is missing");
        }
        if (!finalPath) {
            throw new Error("Processed output path is missing");
        }

        await setStep("Prepare upload");
        await setStep("Resize and crop to square");
        await runProcess("ffmpeg", [
            "-y",
            "-i", tempUploadPath,
            "-vf", `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1,fps=${OUTPUT_FPS}`,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-an",
            finalPath,
        ], log);

        const sizeBytes = fs.statSync(finalPath).size;
        const durationSeconds = await ffprobeDuration(finalPath);

        if (tempUploadPath && fs.existsSync(tempUploadPath)) {
            fs.rmSync(tempUploadPath, { force: true });
        }

        await collection.updateOne(
            { _id },
            {
                $set: {
                    status: "ready",
                    currentStep: "Ready",
                    sizeBytes,
                    durationSeconds,
                    mimeType: "video/mp4",
                    tempUploadPath: null,
                    updatedAt: new Date(),
                },
            },
        );
        await log("Video ready");
    } catch (error) {
        if (finalPath && fs.existsSync(finalPath)) {
            fs.rmSync(finalPath, { force: true });
        }
        await collection.updateOne(
            { _id },
            {
                $set: {
                    status: "failed",
                    currentStep: "Failed",
                    error: error instanceof Error ? error.message : String(error),
                    updatedAt: new Date(),
                },
                $push: {
                    logs: {
                        message: error instanceof Error ? error.message : String(error),
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
