"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
    OVERLAY_BLEND_MODES,
    type OverlayBlendMode,
} from "@/lib/ffmpeg-experiments";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_UPLOAD_CAPTION_TEMPLATE } from "@/lib/upload-caption";

interface Recitation {
    id: number;
    reciter_name: string;
    style: string | null;
}

interface OverlayAsset {
    _id: string;
    name: string;
    originalFilename: string;
}

function ReciterMultiSelect({
    recitations,
    value,
    onChange,
}: {
    recitations: Recitation[];
    value: number[];
    onChange: (next: number[]) => void;
}) {
    const [open, setOpen] = useState(false);

    function toggle(id: number) {
        if (value.includes(id) && value.length === 1) {
            toast.error("At least one reciter must remain enabled.");
            return;
        }
        onChange(
            value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <button className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring">
                        <span className="truncate text-left">
                            {value.length === 0
                                ? "Select reciters"
                                : value.length === 1
                                  ? (recitations.find(
                                        (recitation) =>
                                            recitation.id === value[0],
                                    )?.reciter_name ?? "1 reciter")
                                  : `${value.length} reciters selected`}
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                    </button>
                }
            />
            <PopoverContent className="w-[min(320px,var(--radix-popover-trigger-width))] p-0">
                <Command>
                    <CommandInput placeholder="Search reciters…" />
                    <CommandList>
                        <CommandEmpty>No reciters found.</CommandEmpty>
                        <CommandGroup>
                            {recitations.map((recitation) => {
                                const checked = value.includes(recitation.id);
                                return (
                                    <CommandItem
                                        key={recitation.id}
                                        value={`${recitation.reciter_name} ${recitation.style ?? ""}`}
                                        onSelect={() => toggle(recitation.id)}
                                    >
                                        <span className="mr-2 h-4 w-4 flex items-center justify-center shrink-0">
                                            {checked ? (
                                                <Check className="h-4 w-4" />
                                            ) : null}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate">
                                                {recitation.reciter_name}
                                            </p>
                                            {recitation.style && (
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {recitation.style}
                                                </p>
                                            )}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function SettingsTab() {
    const [recitations, setRecitations] = useState<Recitation[]>([]);
    const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());
    const [overlays, setOverlays] = useState<OverlayAsset[]>([]);
    const [vignette, setVignette] = useState(0);
    const [exposure, setExposure] = useState(0);
    const [saturation, setSaturation] = useState(1);
    const [audioLeadSeconds, setAudioLeadSeconds] = useState(1.5);
    const [clipTailSeconds, setClipTailSeconds] = useState(0);
    const [randomAyahMinSeconds, setRandomAyahMinSeconds] = useState(0);
    const [randomAyahMaxSeconds, setRandomAyahMaxSeconds] = useState(30);
    const [uploadCaptionTemplate, setUploadCaptionTemplate] = useState(
        DEFAULT_UPLOAD_CAPTION_TEMPLATE,
    );
    const [overlayId, setOverlayId] = useState("none");
    const [overlayBlendMode, setOverlayBlendMode] =
        useState<OverlayBlendMode>("normal");
    const [savingReciters, setSavingReciters] = useState(false);
    const [loading, setLoading] = useState(true);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [recRes, cfgRecRes, videoCfgRes, overlaysRes] =
                    await Promise.all([
                        fetch("/api/qf/reciters"),
                        fetch("/api/configuration/reciters"),
                        fetch("/api/configuration/video"),
                        fetch("/api/overlays"),
                    ]);
                const recData = JSON.parse(await recRes.text());
                const cfgRecData = JSON.parse(await cfgRecRes.text());
                const videoCfg = JSON.parse(await videoCfgRes.text());
                const overlayData = JSON.parse(await overlaysRes.text());

                if (recData.error) throw new Error(recData.error);
                if (cfgRecData.error) throw new Error(cfgRecData.error);
                if (videoCfg.error) throw new Error(videoCfg.error);
                if (overlayData.error) throw new Error(overlayData.error);

                const sortedRecitations = [
                    ...(recData.recitations as Recitation[]),
                ].sort((a, b) => a.reciter_name.localeCompare(b.reciter_name));
                setRecitations(sortedRecitations);
                const nextEnabledIds = new Set<number>(
                    cfgRecData.enabledIds ?? [],
                );
                if (sortedRecitations.length > 0 && nextEnabledIds.size === 0) {
                    nextEnabledIds.add(sortedRecitations[0].id);
                }
                setEnabledIds(nextEnabledIds);

                setOverlays(overlayData as OverlayAsset[]);
                setVignette(
                    typeof videoCfg.vignette === "number"
                        ? videoCfg.vignette
                        : 0,
                );
                setExposure(
                    typeof videoCfg.exposure === "number"
                        ? videoCfg.exposure
                        : 0,
                );
                setSaturation(
                    typeof videoCfg.saturation === "number"
                        ? videoCfg.saturation
                        : 1,
                );
                setAudioLeadSeconds(
                    typeof videoCfg.audioLeadSeconds === "number"
                        ? videoCfg.audioLeadSeconds
                        : 1.5,
                );
                setClipTailSeconds(
                    typeof videoCfg.clipTailSeconds === "number"
                        ? videoCfg.clipTailSeconds
                        : 0,
                );
                setRandomAyahMinSeconds(
                    typeof videoCfg.randomAyahMinSeconds === "number"
                        ? videoCfg.randomAyahMinSeconds
                        : 0,
                );
                setRandomAyahMaxSeconds(
                    typeof videoCfg.randomAyahMaxSeconds === "number"
                        ? videoCfg.randomAyahMaxSeconds
                        : 30,
                );
                setUploadCaptionTemplate(
                    typeof videoCfg.uploadCaptionTemplate === "string" &&
                        videoCfg.uploadCaptionTemplate.trim().length > 0
                        ? videoCfg.uploadCaptionTemplate
                        : DEFAULT_UPLOAD_CAPTION_TEMPLATE,
                );
                setOverlayId(
                    typeof videoCfg.overlayId === "string"
                        ? videoCfg.overlayId
                        : "none",
                );
                setOverlayBlendMode(
                    typeof videoCfg.overlayBlendMode === "string" &&
                        OVERLAY_BLEND_MODES.includes(videoCfg.overlayBlendMode)
                        ? videoCfg.overlayBlendMode
                        : "normal",
                );
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : String(error),
                );
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, []);

    const saveVideoConfig = useCallback(
        (next: {
            vignette?: number;
            exposure?: number;
            saturation?: number;
            audioLeadSeconds?: number;
            clipTailSeconds?: number;
            randomAyahMinSeconds?: number;
            randomAyahMaxSeconds?: number;
            overlayId?: string | null;
            overlayBlendMode?: OverlayBlendMode;
            uploadCaptionTemplate?: string;
        }) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                fetch("/api/configuration/video", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(next),
                }).catch(() => {});
            }, 250);
        },
        [],
    );

    async function saveReciters(next: Set<number>) {
        setSavingReciters(true);
        try {
            const res = await fetch("/api/configuration/reciters", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledIds: [...next] }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok)
                throw new Error(data.error ?? "Failed to save reciters");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setSavingReciters(false);
        }
    }

    return (
        <div className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-2xl font-medium">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Central configuration for reciters, video treatment, audio
                    lead, and default overlay behavior.
                </p>
            </div>
            <div className="w-full min-w-0">
                {loading ? (
                    <Table className="w-full table-fixed">
                        <TableBody>
                            {Array.from({ length: 9 }).map((_, index) => (
                                <TableRow key={index} className="border-b">
                                    <TableCell className="w-[42%] whitespace-normal align-top md:w-[42%]">
                                        <div className="flex flex-col gap-2">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-4 w-60" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-normal align-middle">
                                        <div className="flex flex-col gap-2">
                                            <Skeleton className="h-4 w-16" />
                                            <Skeleton className="h-9 w-full" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                <Table className="w-full table-fixed">
                    <TableBody>
                        <TableRow className="border-b">
                            <TableCell className="w-[42%] whitespace-normal align-top md:w-[42%]">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Enabled reciters
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Choose which reciters random experiments
                                        can use.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-middle">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <ReciterMultiSelect
                                        recitations={recitations}
                                        value={[...enabledIds]}
                                        onChange={(next) => {
                                            const set = new Set(next);
                                            setEnabledIds(set);
                                            void saveReciters(set);
                                        }}
                                    />
                                    {savingReciters && (
                                        <p className="text-xs text-muted-foreground">
                                            Saving…
                                        </p>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Vignette
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Darken the frame edges slightly.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {vignette.toFixed(2)}
                                    </span>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[vignette]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v)
                                                ? (v[0] ?? 0)
                                                : v;
                                            setVignette(next);
                                            saveVideoConfig({ vignette: next });
                                        }}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Saturation
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Increase or soften color intensity.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {saturation.toFixed(2)}x
                                    </span>
                                    <Slider
                                        min={0}
                                        max={3}
                                        step={0.01}
                                        value={[saturation]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v)
                                                ? (v[0] ?? 1)
                                                : v;
                                            setSaturation(next);
                                            saveVideoConfig({ saturation: next });
                                        }}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Exposure
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Brighten or darken the base footage.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {exposure >= 0 ? "+" : ""}
                                        {exposure.toFixed(1)} EV
                                    </span>
                                    <Slider
                                        min={-3}
                                        max={3}
                                        step={0.1}
                                        value={[exposure]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v)
                                                ? (v[0] ?? 0)
                                                : v;
                                            setExposure(next);
                                            saveVideoConfig({ exposure: next });
                                        }}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Audio lead
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Start the recitation this many seconds
                                        earlier.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {audioLeadSeconds.toFixed(1)}s
                                    </span>
                                    <Slider
                                        min={0}
                                        max={5}
                                        step={0.1}
                                        value={[audioLeadSeconds]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v)
                                                ? (v[0] ?? 0)
                                                : v;
                                            setAudioLeadSeconds(next);
                                            saveVideoConfig({
                                                audioLeadSeconds: next,
                                            });
                                        }}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Clip tail
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Silence added after the recitation ends, extending the clip.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {clipTailSeconds.toFixed(1)}s
                                    </span>
                                    <Slider
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={[clipTailSeconds]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v) ? (v[0] ?? 0) : v;
                                            setClipTailSeconds(next);
                                            saveVideoConfig({ clipTailSeconds: next });
                                        }}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Random ayah length range
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Set the shortest and longest verse
                                        durations allowed for random ayah
                                        search.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="flex w-full min-w-0 flex-col gap-1.5 sm:max-w-28">
                                        <Label
                                            htmlFor="random-ayah-min"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Min
                                        </Label>
                                        <Input
                                            id="random-ayah-min"
                                            type="number"
                                            min={0}
                                            max={300}
                                            step={0.1}
                                            value={randomAyahMinSeconds}
                                            onChange={(e) => {
                                                const next = Number(
                                                    e.target.value,
                                                );
                                                setRandomAyahMinSeconds(next);
                                                saveVideoConfig({
                                                    randomAyahMinSeconds:
                                                        Number.isFinite(next)
                                                            ? next
                                                            : 0,
                                                });
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="hidden h-9 items-center pb-2 text-muted-foreground sm:flex">
                                        <ArrowRight className="size-4" />
                                    </div>
                                    <div className="flex w-full min-w-0 flex-col gap-1.5 sm:max-w-28">
                                        <Label
                                            htmlFor="random-ayah-max"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Max
                                        </Label>
                                        <Input
                                            id="random-ayah-max"
                                            type="number"
                                            min={0}
                                            max={300}
                                            step={0.1}
                                            value={randomAyahMaxSeconds}
                                            onChange={(e) => {
                                                const next = Number(
                                                    e.target.value,
                                                );
                                                setRandomAyahMaxSeconds(next);
                                                saveVideoConfig({
                                                    randomAyahMaxSeconds:
                                                        Number.isFinite(next)
                                                            ? next
                                                            : 30,
                                                });
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground sm:pb-2">
                                        seconds
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Upload caption template
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Used when you upload a generated clip.
                                        Available variables:{" "}
                                        <code>{"{{verseKey}}"}</code>,{" "}
                                        <code>{"{{surahName}}"}</code>,{" "}
                                        <code>{"{{reciterName}}"}</code>.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <Textarea
                                        value={uploadCaptionTemplate}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setUploadCaptionTemplate(next);
                                            saveVideoConfig({
                                                uploadCaptionTemplate: next,
                                            });
                                        }}
                                        className="min-h-28 w-full"
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Default overlay
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Optional final image overlay applied on
                                        top of the finished video.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <SearchableSelect
                                    items={[
                                        { value: "none", label: "None" },
                                        ...overlays.map((overlay) => ({
                                            value: overlay._id,
                                            label: overlay.name,
                                            subtitle: overlay.originalFilename,
                                        })),
                                    ]}
                                    value={overlayId}
                                    onChange={(next) => {
                                        setOverlayId(next);
                                        saveVideoConfig({
                                            overlayId:
                                                next === "none" ? null : next,
                                        });
                                    }}
                                    placeholder="Select overlay"
                                    searchPlaceholder="Search overlays…"
                                    emptyLabel="No overlays found."
                                    className="w-full"
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="whitespace-normal align-middle">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Default overlay blend
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Blend mode used when an overlay is
                                        selected.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-middle">
                                <SearchableSelect
                                    items={OVERLAY_BLEND_MODES.map((mode) => ({
                                        value: mode,
                                        label: mode,
                                    }))}
                                    value={overlayBlendMode}
                                    onChange={(value) => {
                                        const next = value as OverlayBlendMode;
                                        setOverlayBlendMode(next);
                                        saveVideoConfig({
                                            overlayBlendMode: next,
                                        });
                                    }}
                                    disabled={overlayId === "none"}
                                    placeholder="Select blend mode"
                                    searchPlaceholder="Search blend modes…"
                                    emptyLabel="No blend modes found."
                                    className="w-full"
                                />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                )}
            </div>
        </div>
    );
}
