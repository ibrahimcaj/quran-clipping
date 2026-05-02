export const dynamic = "force-dynamic";

import * as fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
    resolveExperimentOutputState,
    serializeExperiment,
} from "@/lib/ffmpeg-experiment-output";
import {
    DEFAULT_UPLOAD_CAPTION_TEMPLATE,
    formatUploadCaption,
} from "@/lib/upload-caption";

const GRAPH = "https://graph.facebook.com/v21.0";
const INSTAGRAM_STATUS_POLL_INTERVAL_MS = 5000;
const INSTAGRAM_STATUS_MAX_ATTEMPTS = 60;

type UploadResult = {
    accountId: string;
    platform: "youtube" | "instagram";
    accountName: string;
    status: "uploaded" | "failed";
    uploadedAt: string;
    externalId?: string;
    url?: string;
    error?: string;
};

function getBaseUrl() {
    const baseUrl = process.env.BASE_URL?.trim();
    if (!baseUrl) {
        throw new Error("BASE_URL must be set for clip uploads.");
    }
    return baseUrl.replace(/\/+$/, "");
}

function isPrivateHostname(hostname: string) {
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname.endsWith(".local") ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonSafe(res: Response) {
    const text = await res.text();
    try {
        return { text, json: text ? JSON.parse(text) : null };
    } catch {
        return { text, json: null };
    }
}

async function fetchChapterName(chapterId: number) {
    const res = await fetch("https://api.quran.com/api/v4/chapters?language=en", {
        next: { revalidate: 86400 },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as {
        chapters?: { id: number; name_simple: string }[];
    };
    return (
        data.chapters?.find((chapter) => chapter.id === chapterId)?.name_simple ??
        ""
    );
}

async function refreshYouTubeAccessToken(db: Awaited<ReturnType<typeof getDb>>, account: {
    _id: ObjectId;
    tokens?: {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };
}) {
    const refreshToken = account.tokens?.refresh_token;
    if (!refreshToken) {
        throw new Error("This YouTube account is missing a refresh token.");
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
            client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const { json, text } = await readJsonSafe(res);
    if (!res.ok || !json?.access_token) {
        throw new Error(
            `YouTube token refresh failed: ${((json?.error_description as string | undefined) ?? (json?.error as string | undefined) ?? text) || res.status}`,
        );
    }

    const nextTokens = {
        ...account.tokens,
        access_token: json.access_token as string,
        expires_in: json.expires_in as number | undefined,
        token_type: json.token_type as string | undefined,
    };

    await db.collection("accounts").updateOne(
        { _id: account._id },
        { $set: { tokens: nextTokens, updatedAt: new Date() } },
    );

    return nextTokens.access_token;
}

async function uploadToYouTube(args: {
    db: Awaited<ReturnType<typeof getDb>>;
    account: {
        _id: ObjectId;
        name: string;
        tokens?: {
            access_token?: string;
            refresh_token?: string;
        };
    };
    filePath: string;
    title: string;
    description: string;
}) {
    const accessToken = await refreshYouTubeAccessToken(args.db, args.account);
    const metadata = JSON.stringify({
        snippet: {
            title: args.title,
            description: args.description,
            categoryId: "22",
        },
        status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
        },
    });

    const fileBuffer = fs.readFileSync(args.filePath);
    const boundary = `quran-clip-${Date.now().toString(36)}`;
    const prefix = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
    );
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([prefix, fileBuffer, suffix]);

    const res = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
                "Content-Length": String(body.byteLength),
            },
            body,
        },
    );
    const { json, text } = await readJsonSafe(res);
    if (!res.ok || !json?.id) {
        throw new Error(
            `YouTube upload failed: ${((json?.error?.message as string | undefined) ?? text) || res.status}`,
        );
    }

    return {
        externalId: json.id as string,
        url: `https://www.youtube.com/watch?v=${json.id as string}`,
    };
}

async function uploadToInstagram(args: {
    account: {
        igUserId?: string;
        accessToken?: string;
    };
    fileUrl: string;
    caption: string;
    onStatus?: (message: string) => void | Promise<void>;
}) {
    if (!args.account.igUserId || !args.account.accessToken) {
        throw new Error("This Instagram account is missing publishing credentials.");
    }

    const createRes = await fetch(`${GRAPH}/${args.account.igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            media_type: "REELS",
            video_url: args.fileUrl,
            caption: args.caption,
            share_to_feed: "true",
            access_token: args.account.accessToken,
        }),
    });
    const created = await createRes.json();
    if (!createRes.ok || !created?.id) {
        throw new Error(
            `Instagram container failed: ${created?.error?.message ?? JSON.stringify(created)}`,
        );
    }
    await args.onStatus?.(
        `Instagram container created: ${created.id as string}`,
    );

    let lastStatusCode: string | null = null;
    for (let attempt = 0; attempt < INSTAGRAM_STATUS_MAX_ATTEMPTS; attempt++) {
        await sleep(INSTAGRAM_STATUS_POLL_INTERVAL_MS);
        const statusRes = await fetch(
            `${GRAPH}/${created.id}?fields=status,status_code,error_message&access_token=${args.account.accessToken}`,
            { cache: "no-store" },
        );
        const statusData = await statusRes.json();
        const statusCode = String(
            statusData.status_code ?? statusData.status ?? "UNKNOWN",
        );

        if (statusCode !== lastStatusCode) {
            lastStatusCode = statusCode;
            await args.onStatus?.(
                `Instagram processing status: ${statusCode}${statusData.error_message ? ` (${statusData.error_message as string})` : ""}`,
            );
        }

        if (statusCode === "FINISHED") {
            break;
        }
        if (statusCode === "ERROR" || statusCode === "EXPIRED") {
            throw new Error(
                `Instagram processing failed: ${statusData.error_message ?? statusCode}`,
            );
        }
        if (attempt === INSTAGRAM_STATUS_MAX_ATTEMPTS - 1) {
            throw new Error(
                `Instagram processing did not finish in time after ${Math.round((INSTAGRAM_STATUS_POLL_INTERVAL_MS * INSTAGRAM_STATUS_MAX_ATTEMPTS) / 1000)}s.`,
            );
        }
    }

    const publishRes = await fetch(`${GRAPH}/${args.account.igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            creation_id: created.id as string,
            access_token: args.account.accessToken,
        }),
    });
    const published = await publishRes.json();
    if (!publishRes.ok || !published?.id) {
        throw new Error(
            `Instagram publish failed: ${published?.error?.message ?? JSON.stringify(published)}`,
        );
    }
    await args.onStatus?.(
        `Instagram publish complete: ${published.id as string}`,
    );

    const mediaRes = await fetch(
        `${GRAPH}/${published.id}?fields=permalink&access_token=${args.account.accessToken}`,
        { cache: "no-store" },
    );
    const media = await mediaRes.json();

    return {
        externalId: published.id as string,
        url: (media?.permalink as string | undefined) ?? undefined,
    };
}

export async function POST(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    try {
        const db = await getDb();
        const collection = db.collection("ffmpegExperiments");
        const _id = new ObjectId(id);
        const appendLog = async (message: string) => {
            await collection.updateOne(
                { _id },
                {
                    $push: {
                        logs: {
                            message,
                            createdAt: new Date().toISOString(),
                        },
                    } as never,
                    $set: {
                        updatedAt: new Date(),
                    },
                },
            );
        };
        const experiment = await collection.findOne({ _id });
        const resolved = await resolveExperimentOutputState(collection, experiment);

        if (!resolved.doc) {
            return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
        }
        if (!resolved.hasOutputFile || typeof resolved.doc.outputPath !== "string") {
            return NextResponse.json(
                { error: "Generated video is missing or expired." },
                { status: 400 },
            );
        }

        const accounts = await db.collection("accounts")
            .find({ type: { $in: ["youtube", "instagram"] } })
            .sort({ connectedAt: 1 })
            .toArray();
        if (accounts.length === 0) {
            return NextResponse.json(
                { error: "Connect at least one account first." },
                { status: 400 },
            );
        }

        const verseKey =
            typeof resolved.doc.verseKey === "string" ? resolved.doc.verseKey : "";
        const reciterName =
            typeof resolved.doc.reciterName === "string"
                ? resolved.doc.reciterName
                : "Unknown reciter";
        const [chapterRaw] = verseKey.split(":");
        const chapterId = Number.parseInt(chapterRaw ?? "", 10);
        const surahName = Number.isFinite(chapterId)
            ? await fetchChapterName(chapterId)
            : "";

        const videoConfig = await db
            .collection("configuration")
            .findOne({ type: "video" });
        const captionTemplate =
            typeof videoConfig?.uploadCaptionTemplate === "string" &&
            videoConfig.uploadCaptionTemplate.trim().length > 0
                ? videoConfig.uploadCaptionTemplate
                : DEFAULT_UPLOAD_CAPTION_TEMPLATE;
        const caption = formatUploadCaption(captionTemplate, {
            verseKey,
            surahName,
            reciterName,
        });
        const title = [verseKey, surahName, reciterName].filter(Boolean).join(" ");

        const baseUrl = getBaseUrl();
        const hostname = new URL(baseUrl).hostname;
        const canUsePublicFileUrl = !isPrivateHostname(hostname);
        const fileUrl = `${baseUrl}/api/ffmpeg/experiments/${id}/file`;

        const results: UploadResult[] = [];
        await appendLog(
            `Upload started for ${accounts.length} account${accounts.length === 1 ? "" : "s"}`,
        );

        for (const account of accounts) {
            const uploadedAt = new Date().toISOString();
            try {
                if (account.type === "youtube") {
                    const uploaded = await uploadToYouTube({
                        db,
                        account: {
                            _id: account._id as ObjectId,
                            name: (account.name as string | undefined) ?? "YouTube",
                            tokens: account.tokens as
                                | { access_token?: string; refresh_token?: string }
                                | undefined,
                        },
                        filePath: resolved.doc.outputPath,
                        title,
                        description: caption,
                    });
                    results.push({
                        accountId: account._id.toString(),
                        platform: "youtube",
                        accountName: (account.name as string | undefined) ?? "YouTube",
                        status: "uploaded",
                        uploadedAt,
                        externalId: uploaded.externalId,
                        url: uploaded.url,
                    });
                    await appendLog(
                        `Uploaded to YouTube: ${(account.name as string | undefined) ?? "YouTube"}`,
                    );
                    continue;
                }

                if (!canUsePublicFileUrl) {
                    throw new Error(
                        "Instagram publishing needs a public app URL. localhost/private hosts cannot be fetched by Meta.",
                    );
                }

                const uploaded = await uploadToInstagram({
                    account: {
                        igUserId: account.igUserId as string | undefined,
                        accessToken: account.accessToken as string | undefined,
                    },
                    fileUrl,
                    caption,
                    onStatus: (message) =>
                        appendLog(
                            `${(account.name as string | undefined) ?? "Instagram"}: ${message}`,
                        ),
                });
                results.push({
                    accountId: account._id.toString(),
                    platform: "instagram",
                    accountName: (account.name as string | undefined) ?? "Instagram",
                    status: "uploaded",
                    uploadedAt,
                    externalId: uploaded.externalId,
                    url: uploaded.url,
                });
                await appendLog(
                    `Uploaded to Instagram: ${(account.name as string | undefined) ?? "Instagram"}`,
                );
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                results.push({
                    accountId: account._id.toString(),
                    platform: account.type as "youtube" | "instagram",
                    accountName: (account.name as string | undefined) ?? account.type,
                    status: "failed",
                    uploadedAt,
                    error: errorMessage,
                });
                await appendLog(
                    `Upload failed for ${(account.name as string | undefined) ?? account.type}: ${errorMessage}`,
                );
            }
        }

        const uploadedCount = results.filter(
            (result) => result.status === "uploaded",
        ).length;
        const failedCount = results.length - uploadedCount;
        await appendLog(
            `Upload finished: ${uploadedCount} uploaded, ${failedCount} failed`,
        );

        const existingUploads = Array.isArray(resolved.doc.uploads)
            ? resolved.doc.uploads
            : [];
        await collection.updateOne(
            { _id },
            {
                $set: {
                    uploads: [...existingUploads, ...results],
                    updatedAt: new Date(),
                },
            },
        );

        const updated = await collection.findOne({ _id });
        const nextResolved = await resolveExperimentOutputState(collection, updated);

        return NextResponse.json({
            results,
            experiment: nextResolved.doc
                ? serializeExperiment(nextResolved.doc, nextResolved.hasOutputFile)
                : null,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
