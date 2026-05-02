"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, ExternalLink } from "lucide-react";

interface Clip {
  twitchId: string;
  title: string;
  streamerDisplayName: string;
  viewCount: number;
  duration: number;
  status: string;
  caption?: string;
  youtubeUrl?: string;
}

function ClipSlide({ clip, onAction }: { clip: Clip; onAction: (id: string, action: "confirmed" | "discarded", caption: string) => Promise<void> }) {
  const [caption, setCaption] = useState(clip.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [ytUrl, setYtUrl] = useState(clip.youtubeUrl ?? "");
  const [done, setDone] = useState(clip.status === "confirmed" || clip.status === "discarded" || clip.status === "uploaded" || clip.status === "uploading");
  const [currentStatus, setCurrentStatus] = useState(clip.status);
  const [visible, setVisible] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = slideRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.5), { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) { v.play().catch(() => {}); }
    else { v.pause(); }
  }, [visible]);

  async function act(action: "confirmed" | "discarded") {
    setBusy(true);
    await onAction(clip.twitchId, action, caption);
    setCurrentStatus(action);
    setDone(true);
    setBusy(false);
  }

  const isConfirmed = currentStatus === "confirmed" || currentStatus === "uploading" || currentStatus === "uploaded";
  const isDiscarded = currentStatus === "discarded";
  const isUploaded = currentStatus === "uploaded";
  const isUploading = currentStatus === "uploading";

  return (
    <div ref={slideRef} className="h-full flex flex-col items-center justify-center gap-4 px-4 py-6">
      {/* Video */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <video
          ref={videoRef}
          src={`/api/clips/${clip.twitchId}/video?type=vertical`}
          controls
          loop
          playsInline
          className="h-full max-h-full w-auto max-w-full rounded-xl object-contain"
          style={{ aspectRatio: "9/16" }}
        />
      </div>

      {/* Info + actions */}
      <div className="w-full max-w-sm space-y-3 shrink-0">
        <div>
          <p className="font-semibold text-sm line-clamp-2">{clip.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{clip.streamerDisplayName} · {clip.viewCount.toLocaleString()} views · {clip.duration}s</p>
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption…"
          disabled={done}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />

        {!done ? (
          <div className="flex gap-2">
            <Button className="flex-1 gap-1.5" onClick={() => act("confirmed")} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Confirm
            </Button>
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => act("discarded")} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Discard
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <div className={`flex-1 text-center text-sm font-medium rounded-lg py-2 flex items-center justify-center gap-2 ${
              isDiscarded ? "bg-zinc-500/20 text-zinc-400" : "bg-emerald-500/20 text-emerald-400"
            }`}>
              {isUploading && <Loader2 className="size-3.5 animate-spin" />}
              {isUploaded ? "Uploaded to YouTube" : isUploading ? "Uploading…" : isConfirmed ? "Confirmed" : "Discarded"}
            </div>
            {ytUrl && (
              <a href={ytUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <ExternalLink className="size-3.5" /> YouTube
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/clips?status=done");
      const done: Clip[] = await res.json();
      const res2 = await fetch("/api/clips?status=confirmed");
      const confirmed: Clip[] = await res2.json();
      const res3 = await fetch("/api/clips?status=uploaded");
      const uploaded: Clip[] = await res3.json();
      const res4 = await fetch("/api/clips?status=uploading");
      const uploading: Clip[] = await res4.json();
      setClips([...done, ...confirmed, ...uploading, ...uploaded]);
      setLoading(false);
    }
    load();
  }, []);

  async function handleAction(id: string, action: "confirmed" | "discarded", caption: string) {
    await fetch(`/api/clips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action, caption }),
    });
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (clips.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-sm">No clips ready for review.</p>
      <p className="text-xs">Process some clips first. They'll appear here when done.</p>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-scroll"
      style={{ scrollSnapType: "y mandatory", scrollBehavior: "smooth" }}
    >
      {clips.map((clip) => (
        <div
          key={clip.twitchId}
          style={{ scrollSnapAlign: "start", height: "calc(100dvh - var(--header-height, 48px))" }}
          className="shrink-0"
        >
          <ClipSlide clip={clip} onAction={handleAction} />
        </div>
      ))}
    </div>
  );
}
