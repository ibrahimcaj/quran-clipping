"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import {
    AudioLines,
    Eye,
    Loader2,
    MoreHorizontal,
    Plus,
    Trash2,
} from "lucide-react";

interface AudioAsset {
    _id: string;
    name: string;
    originalFilename: string;
    sizeBytes: number;
    createdAt: string;
}

function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudiosTab() {
    const [audios, setAudios] = useState<AudioAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [previewing, setPreviewing] = useState<AudioAsset | null>(null);

    async function load() {
        try {
            const res = await fetch("/api/audios");
            const data = JSON.parse(await res.text());
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setAudios(data);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function uploadAudio(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append("audio", file);
            const res = await fetch("/api/audios", {
                method: "POST",
                body: form,
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to upload audio");
            }
            setAudios((current) => [data, ...current]);
            toast.success("Audio uploaded.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setUploading(false);
        }
    }

    async function deleteAudio(id: string) {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/audios/${id}`, { method: "DELETE" });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to delete audio");
            }
            setAudios((current) => current.filter((audio) => audio._id !== id));
            if (previewing?._id === id) {
                setPreviewing(null);
            }
            toast.success("Audio deleted.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    function startRename(audio: AudioAsset) {
        setEditingId(audio._id);
        setEditValue(audio.name);
    }

    async function saveRename(id: string) {
        const name = editValue.trim();
        if (!name) {
            toast.error("Name is required.");
            return;
        }

        try {
            const res = await fetch(`/api/audios/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to rename audio");
            }
            setAudios((current) =>
                current.map((audio) =>
                    audio._id === id ? { ...audio, name: data.name } : audio,
                ),
            );
            setEditingId(null);
            toast.success("Audio renamed.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="grid w-full grid-cols-[1fr_auto] gap-x-5">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-medium">Audio</h1>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {audios.length}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Uploaded audio tracks for custom clip renders and
                        alternate publishing audio.
                    </p>
                </div>
                <label
                    className={cn(
                        buttonVariants({ variant: "default" }),
                        "cursor-pointer gap-1 self-start",
                        uploading && "pointer-events-none opacity-60",
                    )}
                >
                    {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Plus className="size-4" />
                    )}
                    Upload audio
                    <input
                        type="file"
                        accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadAudio(file);
                            e.currentTarget.value = "";
                        }}
                    />
                </label>
            </div>

            <div className="overflow-x-auto">
                <Table style={{ minWidth: 720 }}>
                    <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                            <TableHead>Audio</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Added</TableHead>
                            <TableHead style={{ width: 112 }}>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading &&
                            Array.from({ length: 4 }).map((_, index) => (
                                <TableRow
                                    key={index}
                                    className="border-b hover:bg-transparent"
                                >
                                    <TableCell className="py-2">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 shrink-0 rounded bg-muted animate-pulse" />
                                            <div className="flex flex-col gap-1">
                                                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                                                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-2" />
                                </TableRow>
                            ))}
                        {!loading && audios.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="py-10 text-center text-sm text-muted-foreground"
                                >
                                    No audio yet. Upload one to use it in custom
                                    clips.
                                </TableCell>
                            </TableRow>
                        )}
                        {audios.map((audio) => (
                            <TableRow
                                key={audio._id}
                                className="border-b transition-colors hover:bg-muted/30"
                            >
                                <TableCell className="py-2">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
                                            <AudioLines className="size-4" />
                                        </span>
                                        <div className="min-w-0 max-w-xs">
                                            {editingId === audio._id ? (
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) =>
                                                        setEditValue(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-8 w-full"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            void saveRename(
                                                                audio._id,
                                                            );
                                                        }
                                                        if (e.key === "Escape") {
                                                            setEditingId(null);
                                                        }
                                                    }}
                                                    onBlur={() =>
                                                        void saveRename(
                                                            audio._id,
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <button
                                                    className="truncate text-left text-sm font-medium hover:underline"
                                                    onClick={() =>
                                                        startRename(audio)
                                                    }
                                                    title="Rename audio"
                                                >
                                                    {audio.name}
                                                </button>
                                            )}
                                            <p className="truncate text-xs text-muted-foreground">
                                                {audio.originalFilename}
                                            </p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground">
                                    {formatSize(audio.sizeBytes)}
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground">
                                    {new Date(audio.createdAt).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-2">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-8"
                                            onClick={() => setPreviewing(audio)}
                                            title="Preview audio"
                                        >
                                            <Eye className="size-3.5" />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                render={
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-8"
                                                    >
                                                        <MoreHorizontal className="size-3.5" />
                                                    </Button>
                                                }
                                            />
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        void deleteAudio(
                                                            audio._id,
                                                        )
                                                    }
                                                    disabled={
                                                        deletingId ===
                                                        audio._id
                                                    }
                                                    className="gap-2 text-red-500"
                                                >
                                                    <Trash2 className="size-3.5" />
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

            <Dialog
                open={!!previewing}
                onOpenChange={(open) => !open && setPreviewing(null)}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{previewing?.name ?? "Audio"}</DialogTitle>
                    </DialogHeader>
                    {previewing && (
                        <div className="flex flex-col gap-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {previewing.originalFilename}
                            </p>
                            <audio
                                controls
                                preload="metadata"
                                src={`/api/audios/${previewing._id}/file`}
                                className="w-full"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
