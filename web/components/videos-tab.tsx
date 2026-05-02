"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Eye, Loader2, MoreHorizontal, Plus, Trash2, Video } from "lucide-react";
import { statusLabel } from "@/lib/status";

interface VideoAsset {
    _id: string;
    name: string;
    originalFilename: string;
    sizeBytes: number;
    status?: "queued" | "processing" | "ready" | "failed";
    currentStep?: string;
    logs?: { message: string; createdAt: string }[];
    createdAt: string;
}

function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function VideoThumbnail({ videoId, status }: { videoId: string; status?: string }) {
    const [failed, setFailed] = useState(false);
    const isProcessing = status === "queued" || status === "processing";
    if (failed || isProcessing) {
        return (
            <span className={cn("flex size-8 items-center justify-center rounded bg-muted shrink-0", isProcessing && "animate-pulse")}>
                <Video className="size-4" />
            </span>
        );
    }
    return (
        <img
            src={`/api/videos/${videoId}/frame`}
            alt=""
            className="size-8 rounded object-cover shrink-0"
            onError={() => setFailed(true)}
        />
    );
}

export function VideosTab() {
    const [videos, setVideos] = useState<VideoAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [previewing, setPreviewing] = useState<VideoAsset | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    async function load() {
        try {
            const res = await fetch("/api/videos");
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setVideos(data);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    useEffect(() => {
        const hasActive = videos.some((video) => video.status === "queued" || video.status === "processing");
        if (!hasActive) return;

        const interval = window.setInterval(() => {
            void load();
        }, 1500);

        return () => window.clearInterval(interval);
    }, [videos]);

    async function uploadVideo(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append("video", file);
            const res = await fetch("/api/videos", { method: "POST", body: form });
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setVideos((current) => [data, ...current]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setUploading(false);
        }
    }

    async function deleteVideo(id: string) {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setVideos((current) => current.filter((video) => video._id !== id));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    function startRename(video: VideoAsset) {
        if (video.status === "queued" || video.status === "processing") return;
        setEditingId(video._id);
        setEditValue(video.name);
    }

    async function saveRename(id: string) {
        const name = editValue.trim();
        if (!name) {
            toast.error("Name is required.");
            return;
        }

        try {
            const res = await fetch(`/api/videos/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to rename video");
            }
            setVideos((current) =>
                current.map((video) => (video._id === id ? { ...video, name: data.name } : video)),
            );
            setEditingId(null);
            toast.success("Video renamed.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-[1fr_auto] gap-x-5 w-full">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-medium">Videos</h1>
                        <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground text-xs font-medium">
                            {videos.length}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Local source footage for the square verse pipeline.
                    </p>
                </div>
                <label
                    className={cn(
                        buttonVariants({ variant: "default" }),
                        "cursor-pointer gap-1 self-start",
                        uploading && "pointer-events-none opacity-60",
                    )}
                >
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Upload video
                    <input
                        type="file"
                        accept=".mp4,.mov,.mkv,.avi,.webm,video/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadVideo(file);
                            e.currentTarget.value = "";
                        }}
                    />
                </label>
            </div>

            <div className="overflow-x-auto">
                <Table style={{ minWidth: 720 }}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            <TableHead>Video</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Added</TableHead>
                            <TableHead style={{ width: 112 }}>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 4 }).map((_, i) => (
                            <TableRow key={i} className="border-b hover:bg-transparent">
                                <TableCell className="py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded bg-muted animate-pulse shrink-0" />
                                        <div className="flex flex-col gap-1">
                                            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                                            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2"><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2"><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2" />
                            </TableRow>
                        ))}
                        {!loading && videos.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                    No videos yet. Upload a file to start building the pool.
                                </TableCell>
                            </TableRow>
                        )}
                        {videos.map((video) => (
                            <TableRow key={video._id} className="border-b hover:bg-muted/30 transition-colors">
                                <TableCell className="py-2">
                                    <div className="flex items-center gap-3">
                                        <VideoThumbnail videoId={video._id} status={video.status} />
                                        <div className="min-w-0 max-w-xs">
                                            {editingId === video._id ? (
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-8 w-full"
                                                    autoFocus
                                                    onBlur={() => setEditingId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") void saveRename(video._id);
                                                        if (e.key === "Escape") setEditingId(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={cn("block w-full text-left", video.status !== "queued" && video.status !== "processing" ? "cursor-pointer" : "cursor-default")}
                                                    onClick={() => startRename(video)}
                                                    title={video.status === "queued" || video.status === "processing" ? undefined : "Rename video"}
                                                >
                                                    <p className="font-medium text-sm leading-tight truncate">{video.name}</p>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className={cn("py-2 text-sm", (video.status === "queued" || video.status === "processing") && "animate-pulse")}>
                                    <p>{statusLabel(video.status ?? "ready")}</p>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                    {video.sizeBytes > 0 ? formatSize(video.sizeBytes) : "Processing..."}
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                    {new Date(video.createdAt).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-8"
                                            disabled={(video.status ?? "ready") !== "ready"}
                                            title="Preview video"
                                            onClick={() => setPreviewing(video)}
                                        >
                                            <Eye className="size-3.5" />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost" className="size-8">
                                                    <MoreHorizontal className="size-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => void deleteVideo(video._id)}
                                                    disabled={deletingId === video._id}
                                                    className="gap-2 text-red-500"
                                                >
                                                    {deletingId === video._id ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="size-3.5" />
                                                    )}
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="truncate">{previewing?.name}</DialogTitle>
                    </DialogHeader>
                    {previewing && (
                        <div className="min-h-0 overflow-y-auto p-5">
                            <video
                                controls
                                preload="metadata"
                                src={`/api/videos/${previewing._id}/file`}
                                className="max-h-[72vh] w-full rounded-lg bg-black"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
