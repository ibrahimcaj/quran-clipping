"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { statusLabel } from "@/lib/status";
import { Loader2, ChevronUp, Download, ExternalLink } from "lucide-react";

interface Log {
    _id: string;
    clipId: string;
    stage: string;
    level: string;
    message: string;
    timestamp: string;
}

interface Clip {
    twitchId: string;
    title: string;
    streamerDisplayName: string;
    status: string;
    thumbnailUrl: string;
    viewCount: number;
    duration: number;
    url: string;
    error?: string;
}

const stageColor: Record<string, string> = {
    system: "text-slate-400",
    download: "text-blue-400",
    process: "text-purple-400",
    crop: "text-yellow-400",
    vertical: "text-green-400",
};

const levelColor: Record<string, string> = {
    info: "text-zinc-300",
    warn: "text-yellow-300",
    error: "text-red-400",
};

// Strip leading [word] prefixes yt-dlp/ffmpeg embed in their own output
function stripToolPrefix(msg: string) {
    return msg.replace(/^\[[\w:/-]+\]\s*/, "");
}

export function ClipDetail({ clip: initial }: { clip: Clip }) {
    const [clip, setClip] = useState(initial);
    const [logs, setLogs] = useState<Log[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    const [hasEarlier, setHasEarlier] = useState(false);
    const [videoType, setVideoType] = useState<
        "vertical" | "cropped" | "original"
    >("vertical");
    const [parentDomain, setParentDomain] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const esRef = useRef<EventSource | null>(null);
    const PAGE = 50;

    // Poll clip status
    useEffect(() => {
        const iv = setInterval(async () => {
            const res = await fetch(`/api/clips/${initial.twitchId}`);
            if (res.ok) setClip(await res.json());
        }, 2000);
        return () => clearInterval(iv);
    }, [initial.twitchId]);

    // Load last PAGE logs on mount
    useEffect(() => {
        async function init() {
            const res = await fetch(
                `/api/clips/${initial.twitchId}/logs?limit=${PAGE}`,
            );
            const recent: Log[] = await res.json();
            setLogs(recent);

            // Check if there are earlier logs
            if (recent.length === PAGE) {
                setHasEarlier(true);
            }

            // Start SSE for live updates only if still processing
            const clipRes = await fetch(`/api/clips/${initial.twitchId}`);
            const clipData = await clipRes.json();
            if (clipData.status !== "done" && clipData.status !== "error") {
                setStreaming(true);
                const es = new EventSource(
                    `/api/clips/${initial.twitchId}/logs/stream`,
                );
                esRef.current = es;
                es.onmessage = (e) => {
                    const data = JSON.parse(e.data);
                    if (data._eof) {
                        setStreaming(false);
                        es.close();
                        return;
                    }
                    setLogs((prev) => [...prev, data]);
                };
                es.onerror = () => {
                    setStreaming(false);
                    es.close();
                };
            }
        }
        init();
        return () => esRef.current?.close();
    }, [initial.twitchId]);

    // Auto-scroll on new logs
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // Set parent domain for Twitch embed
    useEffect(() => {
        if (typeof window !== "undefined") {
            setParentDomain(window.location.hostname);
        }
    }, []);

    async function loadEarlier() {
        if (!logs.length) return;
        setLoadingEarlier(true);
        const oldest = logs[0].timestamp;
        const res = await fetch(
            `/api/clips/${initial.twitchId}/logs?limit=${PAGE}&before=${oldest}`,
        );
        const earlier: Log[] = await res.json();
        setLogs((prev) => [...earlier, ...prev]);
        setHasEarlier(earlier.length === PAGE);
        setLoadingEarlier(false);
    }

    // Show video player once vertical stage is done (vertical file exists)
    const hasVertical = ["vertical", "done", "confirmed", "discarded", "uploading", "uploaded", "manual_upload"].includes(clip.status);
    const videoUrl = hasVertical
        ? `/api/clips/${clip.twitchId}/video?type=${videoType}`
        : null;

    const twitchClipId = clip.twitchId || "";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="font-semibold text-lg leading-tight">
                        {clip.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {clip.streamerDisplayName} ·{" "}
                        {clip.viewCount.toLocaleString()} views ·{" "}
                        {clip.duration}s
                    </p>
                </div>
                <span className="text-sm text-muted-foreground">
                    {statusLabel(clip.status)}
                </span>
            </div>

            {clip.error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-sm text-destructive">
                    {clip.error}
                </div>
            )}

            {/* Video preview — shown once vertical is ready */}
            {hasVertical && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            {(["vertical", "cropped", "original"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setVideoType(t)}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                        videoType === t
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <a
                                href={`/api/clips/${clip.twitchId}/video?type=${videoType}&download=true`}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Download className="size-3" /> Download
                            </a>
                            <a
                                href={clip.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ExternalLink className="size-3" /> Twitch
                            </a>
                        </div>
                    </div>
                    <video
                        key={videoUrl!}
                        controls
                        className="w-full rounded-lg bg-black max-h-[400px]"
                        src={videoUrl!}
                    />
                </div>
            )}

            {/* Twitch embed — shown when vertical not yet available */}
            {!hasVertical && clip.status !== "error" && (
                <>
                    {twitchClipId && parentDomain ? (
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                            <iframe
                                key={`${twitchClipId}-${parentDomain}`}
                                src={`https://clips.twitch.tv/embed?clip=${twitchClipId}&parent=${parentDomain}`}
                                height="480"
                                width="854"
                                allowFullScreen
                                frameBorder="0"
                                className="w-full h-full"
                            />
                        </div>
                    ) : (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                            Loading clip…
                        </div>
                    )}
                </>
            )}

            <Separator />

            {/* Logs */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Pipeline Logs</h3>
                    {streaming && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            live
                        </span>
                    )}
                </div>

                {hasEarlier && (
                    <div className="flex justify-center mb-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 gap-1"
                            onClick={loadEarlier}
                            disabled={loadingEarlier}
                        >
                            {loadingEarlier ? (
                                <Loader2 className="size-3 animate-spin" />
                            ) : (
                                <ChevronUp className="size-3" />
                            )}
                            Load earlier logs
                        </Button>
                    </div>
                )}

                <ScrollArea className="h-72 w-full rounded border bg-zinc-950 p-3 font-mono text-xs">
                    {logs.length === 0 && (
                        <p className="text-zinc-500">No logs yet…</p>
                    )}
                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-2 leading-5 min-w-0">
                            <span className="text-zinc-600 shrink-0 select-none">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span
                                className={`shrink-0 w-16 ${stageColor[log.stage] ?? "text-zinc-400"}`}
                            >
                                [{log.stage}]
                            </span>
                            <span
                                className={`${levelColor[log.level] ?? "text-zinc-300"} break-all min-w-0`}
                            >
                                {stripToolPrefix(log.message)}
                            </span>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </ScrollArea>
            </div>
        </div>
    );
}
