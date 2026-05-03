export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { getToken, getApiBase, getClientId, clearTokenCache } from "@/lib/qf-token";
import { getDb } from "@/lib/mongodb";
import { getVerseDurationSeconds } from "@/lib/verse-utils";

const DEFAULT_RECITATION = "7"; // Mishary Rashid Alafasy

async function qfFetch(url: string, token: string): Promise<Response> {
    return fetch(url, {
        headers: {
            "x-auth-token": token,
            "x-client-id": getClientId(),
        },
    });
}

async function isInvalidTokenResponse(res: Response): Promise<boolean> {
    if (res.status !== 401 && res.status !== 403) return false;
    const text = await res.clone().text().catch(() => "");
    if (!text) return res.status === 401;
    try {
        const data = JSON.parse(text) as {
            type?: string;
            message?: string;
        };
        return (
            data.type === "invalid_token" ||
            data.message === "The access token is expired or inactive"
        );
    } catch {
        return res.status === 401;
    }
}

async function qfFetchWithRetry(url: string): Promise<Response> {
    let token = await getToken();
    let res = await qfFetch(url, token);
    if (await isInvalidTokenResponse(res)) {
        clearTokenCache();
        token = await getToken();
        res = await qfFetch(url, token);
    }
    return res;
}

async function parseResponse(res: Response): Promise<{ data: unknown; ok: boolean }> {
    const text = await res.text().catch(() => "");
    if (!text) {
        return { data: { error: `QF API returned empty body (HTTP ${res.status})` }, ok: false };
    }
    try {
        return { data: JSON.parse(text), ok: res.ok };
    } catch {
        return {
            data: { error: `QF API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}` },
            ok: false,
        };
    }
}

function normalizeWordSegments(segments: unknown): Map<number, { timestamp_from: number; timestamp_to: number }> {
    const byPosition = new Map<number, { timestamp_from: number; timestamp_to: number }>();
    if (!Array.isArray(segments)) return byPosition;

    for (const segment of segments) {
        if (!Array.isArray(segment)) continue;

        let position: number | null = null;
        let timestampFrom: number | null = null;
        let timestampTo: number | null = null;

        // Ayah-recitation verse payloads currently return `[segment_index, word_position, from_ms, to_ms]`.
        if (segment.length >= 4) {
            position = typeof segment[1] === "number" ? segment[1] : null;
            timestampFrom = typeof segment[2] === "number" ? segment[2] : null;
            timestampTo = typeof segment[3] === "number" ? segment[3] : null;
        }

        // Chapter-reciter timing payloads use `[word_position, from_ms, to_ms]`.
        if (segment.length === 3) {
            position = typeof segment[0] === "number" ? segment[0] : null;
            timestampFrom = typeof segment[1] === "number" ? segment[1] : null;
            timestampTo = typeof segment[2] === "number" ? segment[2] : null;
        }

        if (position && timestampFrom !== null && timestampTo !== null) {
            byPosition.set(position, {
                timestamp_from: timestampFrom,
                timestamp_to: timestampTo,
            });
        }
    }

    return byPosition;
}

function normalizeVerse<T extends Record<string, unknown>>(verse: T): T {
    const words = Array.isArray(verse.words) ? [...verse.words] : [];
    const segmentMap = normalizeWordSegments(
        typeof verse.audio === "object" && verse.audio !== null
            ? (verse.audio as { segments?: unknown }).segments
            : undefined,
    );

    const normalizedWords = words
        .map((word) => {
            if (!word || typeof word !== "object") return word;
            const position = typeof (word as { position?: unknown }).position === "number"
                ? ((word as { position: number }).position)
                : null;
            const timing = position ? segmentMap.get(position) : undefined;
            return {
                ...word,
                ...(timing ?? {}),
            };
        })
        .sort((a, b) => {
            const aPos = typeof (a as { position?: unknown }).position === "number"
                ? (a as { position: number }).position
                : 0;
            const bPos = typeof (b as { position?: unknown }).position === "number"
                ? (b as { position: number }).position
                : 0;
            return aPos - bPos;
        });

    return {
        ...verse,
        words: normalizedWords,
    };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const random = searchParams.get("random") === "true";
        const chapter = searchParams.get("chapter");
        const verseKey = searchParams.get("verse_key");
        const page = searchParams.get("page") ?? "1";
        const perPage = searchParams.get("per_page") ?? "10";
        const translations = searchParams.get("translations") ?? "131"; // Saheeh International
        const recitation = searchParams.get("recitation") ?? DEFAULT_RECITATION;
        const normalizedVerseKey = verseKey
            ? verseKey
                  .split(":")
                  .map((part) => String(Number.parseInt(part, 10)))
                  .join(":")
            : null;
        const normalizedVerseParts = normalizedVerseKey
            ? normalizedVerseKey.split(":")
            : null;
        const verseKeyChapter = normalizedVerseParts?.[0] ?? null;
        const verseKeyAyah = normalizedVerseParts?.[1]
            ? Number.parseInt(normalizedVerseParts[1], 10)
            : null;

        const base = getApiBase();
        const commonParams = new URLSearchParams({
            words: "true",
            translations,
            audio: recitation,
            fields: "text_uthmani,text_imlaei,text_imlaei_simple,verse_key",
            word_fields: "text_uthmani,text_imlaei,text_imlaei_simple,translation,code_v1",
        });
        let path: string;
        let verseLookupConfig:
            | {
                  chapterNumber: string;
                  targetVerseNumber: number;
              }
            | null = null;

        if (random) {
            path = `${base}/content/api/v4/verses/random?${commonParams.toString()}`;
        } else if (
            verseKeyChapter &&
            verseKeyAyah &&
            Number.isFinite(verseKeyAyah) &&
            verseKeyAyah > 0
        ) {
            const chapterParams = new URLSearchParams(commonParams);
            chapterParams.set("page", "1");
            chapterParams.set("per_page", "50");
            path = `${base}/content/api/v4/verses/by_chapter/${verseKeyChapter}?${chapterParams.toString()}`;
            verseLookupConfig = {
                chapterNumber: verseKeyChapter,
                targetVerseNumber: verseKeyAyah,
            };
        } else if (chapter) {
            const chapterParams = new URLSearchParams(commonParams);
            chapterParams.set("page", page);
            chapterParams.set("per_page", perPage);
            path = `${base}/content/api/v4/verses/by_chapter/${chapter}?${chapterParams.toString()}`;
        } else {
            return NextResponse.json(
                { error: "Provide ?random=true, ?verse_key=<chapter:ayah>, or ?chapter=<number>" },
                { status: 400 },
            );
        }

        // fetch random verse with duration filtering
        let res: Response;
        if (random) {
            const db = await getDb();
            const videoCfg = await db.collection("configuration").findOne({ type: "video" }) as {
                ayahMinDuration?: number;
                ayahMaxDuration?: number;
            } | null;
            const minDuration = videoCfg?.ayahMinDuration ?? 3;
            const maxDuration = videoCfg?.ayahMaxDuration ?? 30;

            let attempts = 0;
            const maxAttempts = 11;
            let foundVerse: Record<string, unknown> | null = null;

            while (attempts < maxAttempts && !foundVerse) {
                if (attempts > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                const tempRes = await qfFetchWithRetry(path);
                const { data: tempData, ok: tempOk } = await parseResponse(tempRes);

                if (tempOk && tempData && typeof tempData === "object") {
                    const verse = (tempData as { verse?: Record<string, unknown> }).verse;
                    if (verse) {
                        const duration = getVerseDurationSeconds(verse);
                        if (duration !== null && duration >= minDuration && duration <= maxDuration) {
                            foundVerse = verse;
                            res = tempRes;
                        }
                    }
                }
                attempts += 1;
            }

            if (!foundVerse) {
                return NextResponse.json(
                    { error: `Could not find random verse within ${minDuration}-${maxDuration}s range after ${maxAttempts} attempts` },
                    { status: 404 },
                );
            }
        } else {
            res = await qfFetchWithRetry(path);
        }

        if (verseLookupConfig) {
            const chapterParams = new URLSearchParams(commonParams);
            chapterParams.set("page", "1");
            chapterParams.set("per_page", "50");
            const chapterBasePath =
                `${base}/content/api/v4/verses/by_chapter/${verseLookupConfig.chapterNumber}`;

            let chapterRes = res;

            const firstChapterPage = await parseResponse(chapterRes);
            if (
                firstChapterPage.ok &&
                firstChapterPage.data &&
                typeof firstChapterPage.data === "object" &&
                Array.isArray(
                    (firstChapterPage.data as { verses?: unknown[] }).verses,
                )
            ) {
                let verses = (firstChapterPage.data as {
                    verses: Record<string, unknown>[];
                }).verses;
                let nextPage = (firstChapterPage.data as {
                    pagination?: { next_page?: number | null };
                }).pagination?.next_page;

                while (
                    !verses.some(
                        (item) =>
                            typeof item.verse_number === "number" &&
                            item.verse_number ===
                                verseLookupConfig.targetVerseNumber,
                    ) &&
                    nextPage
                ) {
                    chapterParams.set("page", String(nextPage));
                    chapterRes = await qfFetchWithRetry(
                        `${chapterBasePath}?${chapterParams.toString()}`,
                    );
                    const nextChapterPage = await parseResponse(chapterRes);
                    if (
                        !nextChapterPage.ok ||
                        !nextChapterPage.data ||
                        typeof nextChapterPage.data !== "object" ||
                        !Array.isArray(
                            (nextChapterPage.data as { verses?: unknown[] })
                                .verses,
                        )
                    ) {
                        break;
                    }
                    verses = (nextChapterPage.data as {
                        verses: Record<string, unknown>[];
                    }).verses;
                    nextPage = (nextChapterPage.data as {
                        pagination?: { next_page?: number | null };
                    }).pagination?.next_page;
                }

                const matchedVerse = verses.find(
                    (item) =>
                        typeof item.verse_number === "number" &&
                        item.verse_number ===
                            verseLookupConfig.targetVerseNumber,
                );
                if (matchedVerse) {
                    return NextResponse.json(
                        { verse: normalizeVerse(matchedVerse) },
                        { status: 200 },
                    );
                }
            }

            return NextResponse.json(
                {
                    details:
                        firstChapterPage.data && typeof firstChapterPage.data === "object"
                            ? firstChapterPage.data
                            : undefined,
                    error: "Ayah not found in chapter response",
                },
                { status: firstChapterPage.ok ? 404 : res.status },
            );
        }

        const { data, ok } = await parseResponse(res);
        if (!ok || !data || typeof data !== "object") {
            return NextResponse.json(data, { status: ok ? 200 : res.status });
        }

        const payload = data as {
            verse?: Record<string, unknown>;
            verses?: Record<string, unknown>[];
        };

        if (payload.verse) {
            payload.verse = normalizeVerse(payload.verse);
        }

        if (Array.isArray(payload.verses)) {
            payload.verses = payload.verses.map((verse) => normalizeVerse(verse));
        }

        return NextResponse.json(payload, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
