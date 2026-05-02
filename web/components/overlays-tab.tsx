"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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

interface OverlayAsset {
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

export function OverlaysTab() {
    const [overlays, setOverlays] = useState<OverlayAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    async function load() {
        try {
            const res = await fetch("/api/overlays");
            const data = JSON.parse(await res.text());
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setOverlays(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function uploadOverlay(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append("overlay", file);
            const res = await fetch("/api/overlays", { method: "POST", body: form });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to upload overlay");
            }
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setUploading(false);
        }
    }

    async function deleteOverlay(id: string) {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/overlays/${id}`, { method: "DELETE" });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to delete overlay");
            }
            setOverlays((current) => current.filter((overlay) => overlay._id !== id));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setDeletingId(null);
        }
    }

    function startRename(overlay: OverlayAsset) {
        setEditingId(overlay._id);
        setEditValue(overlay.name);
    }

    async function saveRename(id: string) {
        const name = editValue.trim();
        if (!name) {
            toast.error("Name is required.");
            return;
        }

        try {
            const res = await fetch(`/api/overlays/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to rename overlay");
            }
            setOverlays((current) => current.map((overlay) => (overlay._id === id ? { ...overlay, name: data.name } : overlay)));
            setEditingId(null);
            toast.success("Overlay renamed.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-[1fr_auto] gap-x-5 w-full">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-medium">Overlays</h1>
                        <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground text-xs font-medium">
                            {overlays.length}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Full-frame image overlays stored in `/storage/overlays` for verse renders.
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
                    Upload overlay
                    <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadOverlay(file);
                            e.currentTarget.value = "";
                        }}
                    />
                </label>
            </div>

            <div className="overflow-x-auto">
                <Table style={{ minWidth: 820 }}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            <TableHead>Overlay</TableHead>
                            <TableHead>Preview</TableHead>
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
                                <TableCell className="py-2"><div className="h-12 w-20 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2"><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2" />
                            </TableRow>
                        ))}
                        {!loading && overlays.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                    No overlays yet. Upload a PNG, JPG, or WEBP texture to start layering renders.
                                </TableCell>
                            </TableRow>
                        )}
                        {overlays.map((overlay) => (
                            <TableRow key={overlay._id} className="border-b hover:bg-muted/30 transition-colors">
                                <TableCell className="py-2">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-8 items-center justify-center rounded bg-muted shrink-0">
                                            <ImageIcon className="size-4" />
                                        </span>
                                        <div className="min-w-0 max-w-xs">
                                            {editingId === overlay._id ? (
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-8 w-full"
                                                    autoFocus
                                                    onBlur={() => setEditingId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") void saveRename(overlay._id);
                                                        if (e.key === "Escape") setEditingId(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="block w-full cursor-pointer text-left"
                                                    onClick={() => startRename(overlay)}
                                                    title="Rename overlay"
                                                >
                                                    <p className="font-medium text-sm leading-tight truncate">{overlay.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{overlay.originalFilename}</p>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`/api/overlays/${overlay._id}/file`}
                                        alt={overlay.name}
                                        className="h-12 w-20 rounded object-cover border bg-muted"
                                    />
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                    {formatSize(overlay.sizeBytes)}
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                    {new Date(overlay.createdAt).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            render={<Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button>}
                                        />
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => startRename(overlay)}
                                                className="gap-2"
                                            >
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => void deleteOverlay(overlay._id)}
                                                disabled={deletingId === overlay._id}
                                                className="gap-2 text-red-500"
                                            >
                                                {deletingId === overlay._id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
