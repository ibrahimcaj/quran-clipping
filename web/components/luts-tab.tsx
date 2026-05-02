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
import { Eye, Loader2, MoreHorizontal, Plus, Sliders, Trash2 } from "lucide-react";

interface LutAsset {
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

export function LutsTab() {
    const [luts, setLuts] = useState<LutAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [previewing, setPreviewing] = useState<LutAsset | null>(null);
    const [previewNonce, setPreviewNonce] = useState(0);
    const [previewLoading, setPreviewLoading] = useState(false);

    async function load() {
        try {
            const res = await fetch("/api/luts");
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setLuts(data);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function uploadLut(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append("lut", file);
            const res = await fetch("/api/luts", { method: "POST", body: form });
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setUploading(false);
        }
    }

    async function deleteLut(id: string) {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/luts/${id}`, { method: "DELETE" });
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setLuts((current) => current.filter((lut) => lut._id !== id));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    function startRename(lut: LutAsset) {
        setEditingId(lut._id);
        setEditValue(lut.name);
    }

    async function saveRename(id: string) {
        const name = editValue.trim();
        if (!name) {
            toast.error("Name is required.");
            return;
        }

        try {
            const res = await fetch(`/api/luts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to rename LUT");
            }
            setLuts((current) => current.map((lut) => (lut._id === id ? { ...lut, name: data.name } : lut)));
            setEditingId(null);
            toast.success("LUT renamed.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        }
    }

    async function openPreview(lut: LutAsset) {
        setPreviewing(lut);
        setPreviewLoading(true);
        setPreviewNonce(Date.now());
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-[1fr_auto] gap-x-5 w-full">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-medium">LUTs</h1>
                        <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground text-xs font-medium">
                            {luts.length}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Saved color looks for random grading during verse renders.
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
                    Upload LUT
                    <input
                        type="file"
                        accept=".cube,.3dl,.look,.lut"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadLut(file);
                            e.currentTarget.value = "";
                        }}
                    />
                </label>
            </div>

            <div className="overflow-x-auto">
                <Table style={{ minWidth: 720 }}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            <TableHead>LUT</TableHead>
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
                                <TableCell className="py-2"><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                                <TableCell className="py-2" />
                            </TableRow>
                        ))}
                        {!loading && luts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                                    No LUTs yet. Upload one to preview it on random footage.
                                </TableCell>
                            </TableRow>
                        )}
                        {luts.map((lut) => (
                            <TableRow key={lut._id} className="border-b hover:bg-muted/30 transition-colors">
                                <TableCell className="py-2">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-8 items-center justify-center rounded bg-muted shrink-0">
                                            <Sliders className="size-4" />
                                        </span>
                                        <div className="min-w-0 max-w-xs">
                                            {editingId === lut._id ? (
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-8 w-full"
                                                    autoFocus
                                                    onBlur={() => setEditingId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") void saveRename(lut._id);
                                                        if (e.key === "Escape") setEditingId(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="block w-full cursor-pointer text-left"
                                                    onClick={() => startRename(lut)}
                                                    title="Rename LUT"
                                                >
                                                    <p className="font-medium text-sm leading-tight truncate">{lut.name}</p>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                    {formatSize(lut.sizeBytes)}
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                    {new Date(lut.createdAt).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-8"
                                            title="Preview LUT"
                                            onClick={() => void openPreview(lut)}
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
                                                    onClick={() => void deleteLut(lut._id)}
                                                    disabled={deletingId === lut._id}
                                                    className="gap-2 text-red-500"
                                                >
                                                    {deletingId === lut._id ? (
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

            <Dialog
                open={!!previewing}
                onOpenChange={(open) => {
                    if (!open) {
                        setPreviewing(null);
                        setPreviewLoading(false);
                    }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="truncate">{previewing?.name}</DialogTitle>
                    </DialogHeader>
                    {previewing && (
                        <div className="min-h-0 overflow-y-auto p-5">
                            <div className="mb-3 flex items-center justify-end">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setPreviewLoading(true);
                                        setPreviewNonce(Date.now());
                                    }}
                                >
                                    New random frame
                                </Button>
                            </div>
                            <div className="overflow-hidden rounded-lg border bg-muted/20">
                                {previewLoading && (
                                    <div className="flex h-[60vh] items-center justify-center">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`/api/luts/${previewing._id}/preview?nonce=${previewNonce}`}
                                    alt={`${previewing.name} preview`}
                                    className={cn("w-full bg-black", previewLoading && "hidden")}
                                    onLoad={() => setPreviewLoading(false)}
                                    onError={() => {
                                        setPreviewLoading(false);
                                        toast.error("Failed to preview LUT.");
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
