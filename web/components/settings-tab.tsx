"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface VideoAsset {
    _id: string;
    name: string;
    originalFilename: string;
}

interface LutAsset {
    _id: string;
    name: string;
    originalFilename: string;
}

interface AccountSummary {
    _id: string;
    type: string;
    name: string;
    icon: string;
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

function AssetMultiSelect({
    items,
    value,
    onChange,
    placeholder,
}: {
    items: { id: string; label: string; subtitle?: string }[];
    value: string[];
    onChange: (next: string[]) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);

    function toggle(id: string) {
        onChange(
            value.includes(id)
                ? value.filter((item) => item !== id)
                : [...value, id],
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <button className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring">
                        <span className="truncate text-left">
                            {value.length === 0
                                ? placeholder
                                : `${value.length} selected`}
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                    </button>
                }
            />
            <PopoverContent className="w-[min(360px,var(--radix-popover-trigger-width))] p-0">
                <Command>
                    <CommandInput placeholder={`Search ${placeholder.toLowerCase()}…`} />
                    <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => {
                                const checked = value.includes(item.id);
                                return (
                                    <CommandItem
                                        key={item.id}
                                        value={`${item.label} ${item.subtitle ?? ""}`}
                                        onSelect={() => toggle(item.id)}
                                    >
                                        <span className="mr-2 h-4 w-4 flex items-center justify-center shrink-0">
                                            {checked ? (
                                                <Check className="h-4 w-4" />
                                            ) : null}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate">{item.label}</p>
                                            {item.subtitle ? (
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {item.subtitle}
                                                </p>
                                            ) : null}
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
    const [accounts, setAccounts] = useState<AccountSummary[]>([]);
    const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());
    const [overlays, setOverlays] = useState<OverlayAsset[]>([]);
    const [videos, setVideos] = useState<VideoAsset[]>([]);
    const [luts, setLuts] = useState<LutAsset[]>([]);
    const [vignette, setVignette] = useState(0);
    const [exposure, setExposure] = useState(0);
    const [saturation, setSaturation] = useState(1);
    const [workerUploadIntervalMinutes, setWorkerUploadIntervalMinutes] =
        useState(60);
    const [audioLeadSeconds, setAudioLeadSeconds] = useState(1.5);
    const [clipTailSeconds, setClipTailSeconds] = useState(0);
    const [maxVideoClipSeconds, setMaxVideoClipSeconds] = useState(5);
    const [randomAyahMinSeconds, setRandomAyahMinSeconds] = useState(0);
    const [randomAyahMaxSeconds, setRandomAyahMaxSeconds] = useState(30);
    const [uploadCaptionTemplate, setUploadCaptionTemplate] = useState(
        DEFAULT_UPLOAD_CAPTION_TEMPLATE,
    );
    const [textOpacity, setTextOpacity] = useState(1);
    const [textColor, setTextColor] = useState("#FFFFFF");
    const [textStrokeWidth, setTextStrokeWidth] = useState(0);
    const [textStrokeColor, setTextStrokeColor] = useState("#000000");
    const [textGlowAlpha, setTextGlowAlpha] = useState(1);
    const [textGlowSigma, setTextGlowSigma] = useState(100);
    const [textGlowColor, setTextGlowColor] = useState("#0E3A72");
    const [textInnerGlowAlpha, setTextInnerGlowAlpha] = useState(0.7);
    const [textInnerGlowSigma, setTextInnerGlowSigma] = useState(6);
    const [videoSelectionMode, setVideoSelectionMode] = useState("all");
    const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
    const [lutSelectionMode, setLutSelectionMode] = useState("all");
    const [selectedLutIds, setSelectedLutIds] = useState<string[]>([]);
    const [overlayId, setOverlayId] = useState("none");
    const [overlayBlendMode, setOverlayBlendMode] =
        useState<OverlayBlendMode>("normal");
    const [selectedConfigAccountId, setSelectedConfigAccountId] =
        useState("__global__");
    const [copySourceAccountId, setCopySourceAccountId] = useState("");
    const [savingReciters, setSavingReciters] = useState(false);
    const [copyingConfig, setCopyingConfig] = useState(false);
    const [loading, setLoading] = useState(true);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveRequestIdRef = useRef(0);

    function applyConfig(config: {
        enabledIds?: number[];
        vignette?: number;
        exposure?: number;
        saturation?: number;
        audioLeadSeconds?: number;
        clipTailSeconds?: number;
        maxVideoClipSeconds?: number;
        randomAyahMinSeconds?: number;
        randomAyahMaxSeconds?: number;
        uploadCaptionTemplate?: string;
        workerUploadIntervalMinutes?: number;
        textOpacity?: number;
        textColor?: string;
        textStrokeWidth?: number;
        textStrokeColor?: string;
        textGlowAlpha?: number;
        textGlowSigma?: number;
        textGlowColor?: string;
        textInnerGlowAlpha?: number;
        textInnerGlowSigma?: number;
        videoSelectionMode?: string;
        selectedVideoIds?: string[];
        lutSelectionMode?: string;
        selectedLutIds?: string[];
        overlayId?: string | null;
        overlayBlendMode?: string;
    }) {
        setEnabledIds(new Set(config.enabledIds ?? []));
        setVignette(
            typeof config.vignette === "number" ? config.vignette : 0,
        );
        setExposure(
            typeof config.exposure === "number" ? config.exposure : 0,
        );
        setSaturation(
            typeof config.saturation === "number" ? config.saturation : 1,
        );
        setAudioLeadSeconds(
            typeof config.audioLeadSeconds === "number"
                ? config.audioLeadSeconds
                : 1.5,
        );
        setWorkerUploadIntervalMinutes(
            typeof config.workerUploadIntervalMinutes === "number"
                ? config.workerUploadIntervalMinutes
                : 60,
        );
        setClipTailSeconds(
            typeof config.clipTailSeconds === "number"
                ? config.clipTailSeconds
                : 0,
        );
        setMaxVideoClipSeconds(
            typeof config.maxVideoClipSeconds === "number"
                ? config.maxVideoClipSeconds
                : 5,
        );
        setRandomAyahMinSeconds(
            typeof config.randomAyahMinSeconds === "number"
                ? config.randomAyahMinSeconds
                : 0,
        );
        setRandomAyahMaxSeconds(
            typeof config.randomAyahMaxSeconds === "number"
                ? config.randomAyahMaxSeconds
                : 30,
        );
        setUploadCaptionTemplate(
            typeof config.uploadCaptionTemplate === "string" &&
                config.uploadCaptionTemplate.trim().length > 0
                ? config.uploadCaptionTemplate
                : DEFAULT_UPLOAD_CAPTION_TEMPLATE,
        );
        setTextOpacity(
            typeof config.textOpacity === "number" ? config.textOpacity : 1,
        );
        setTextColor(
            typeof config.textColor === "string"
                ? config.textColor
                : "#FFFFFF",
        );
        setTextStrokeWidth(
            typeof config.textStrokeWidth === "number"
                ? config.textStrokeWidth
                : 0,
        );
        setTextStrokeColor(
            typeof config.textStrokeColor === "string"
                ? config.textStrokeColor
                : "#000000",
        );
        setTextGlowAlpha(
            typeof config.textGlowAlpha === "number"
                ? config.textGlowAlpha
                : 1,
        );
        setTextGlowSigma(
            typeof config.textGlowSigma === "number"
                ? config.textGlowSigma
                : 100,
        );
        setTextGlowColor(
            typeof config.textGlowColor === "string"
                ? config.textGlowColor
                : "#0E3A72",
        );
        setTextInnerGlowAlpha(
            typeof config.textInnerGlowAlpha === "number"
                ? config.textInnerGlowAlpha
                : 0.7,
        );
        setTextInnerGlowSigma(
            typeof config.textInnerGlowSigma === "number"
                ? config.textInnerGlowSigma
                : 6,
        );
        setVideoSelectionMode(
            config.videoSelectionMode === "specific" ? "specific" : "all",
        );
        setSelectedVideoIds(
            Array.isArray(config.selectedVideoIds) ? config.selectedVideoIds : [],
        );
        setLutSelectionMode(
            config.lutSelectionMode === "specific" ? "specific" : "all",
        );
        setSelectedLutIds(
            Array.isArray(config.selectedLutIds) ? config.selectedLutIds : [],
        );
        setOverlayId(
            typeof config.overlayId === "string" ? config.overlayId : "none",
        );
        setOverlayBlendMode(
            typeof config.overlayBlendMode === "string" &&
                OVERLAY_BLEND_MODES.includes(
                    config.overlayBlendMode as OverlayBlendMode,
                )
                ? (config.overlayBlendMode as OverlayBlendMode)
                : "normal",
        );
    }

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [recRes, cfgRecRes, videoCfgRes, overlaysRes, accountsRes, videosRes, lutsRes] =
                    await Promise.all([
                        fetch("/api/qf/reciters"),
                        fetch("/api/configuration/reciters"),
                        fetch("/api/configuration/video"),
                        fetch("/api/overlays"),
                        fetch("/api/accounts"),
                        fetch("/api/videos"),
                        fetch("/api/luts"),
                    ]);
                const recData = JSON.parse(await recRes.text());
                const cfgRecData = JSON.parse(await cfgRecRes.text());
                const videoCfg = JSON.parse(await videoCfgRes.text());
                const overlayData = JSON.parse(await overlaysRes.text());
                const accountsData = JSON.parse(await accountsRes.text());
                const videosData = JSON.parse(await videosRes.text());
                const lutsData = JSON.parse(await lutsRes.text());

                if (recData.error) throw new Error(recData.error);
                if (cfgRecData.error) throw new Error(cfgRecData.error);
                if (videoCfg.error) throw new Error(videoCfg.error);
                if (overlayData.error) throw new Error(overlayData.error);
                if (accountsData.error) throw new Error(accountsData.error);
                if (videosData.error) throw new Error(videosData.error);
                if (lutsData.error) throw new Error(lutsData.error);

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
                setAccounts(accountsData as AccountSummary[]);
                setOverlays(overlayData as OverlayAsset[]);
                setVideos(videosData as VideoAsset[]);
                setLuts(lutsData as LutAsset[]);
                applyConfig({
                    ...videoCfg,
                    enabledIds: [...nextEnabledIds],
                });
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

    useEffect(() => {
        async function loadScopedConfig() {
            if (loading) return;
            try {
                const endpoint =
                    selectedConfigAccountId === "__global__"
                        ? null
                        : `/api/accounts/${selectedConfigAccountId}/config`;
                if (!endpoint) {
                    const [cfgRecRes, videoCfgRes] = await Promise.all([
                        fetch("/api/configuration/reciters"),
                        fetch("/api/configuration/video"),
                    ]);
                    const cfgRecData = JSON.parse(await cfgRecRes.text());
                    const videoCfg = JSON.parse(await videoCfgRes.text());
                    if (cfgRecData.error) throw new Error(cfgRecData.error);
                    if (videoCfg.error) throw new Error(videoCfg.error);
                    applyConfig({
                        ...videoCfg,
                        enabledIds: cfgRecData.enabledIds ?? [],
                    });
                    return;
                }

                const res = await fetch(endpoint);
                const data = JSON.parse(await res.text());
                if (data.error) throw new Error(data.error);
                applyConfig(data);
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : String(error),
                );
            }
        }

        void loadScopedConfig();
    }, [selectedConfigAccountId, loading]);

    const saveVideoConfig = useCallback(
        (next: {
            vignette?: number;
            exposure?: number;
            saturation?: number;
            audioLeadSeconds?: number;
            clipTailSeconds?: number;
            maxVideoClipSeconds?: number;
            randomAyahMinSeconds?: number;
            randomAyahMaxSeconds?: number;
            overlayId?: string | null;
            overlayBlendMode?: OverlayBlendMode;
            uploadCaptionTemplate?: string;
            workerUploadIntervalMinutes?: number;
            textOpacity?: number;
            textColor?: string;
            textStrokeWidth?: number;
            textStrokeColor?: string;
            textGlowAlpha?: number;
            textGlowSigma?: number;
            textGlowColor?: string;
            textInnerGlowAlpha?: number;
            textInnerGlowSigma?: number;
            videoSelectionMode?: string;
            selectedVideoIds?: string[];
            lutSelectionMode?: string;
            selectedLutIds?: string[];
        }) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                const requestId = ++saveRequestIdRef.current;
                const url =
                    selectedConfigAccountId === "__global__"
                        ? "/api/configuration/video"
                        : `/api/accounts/${selectedConfigAccountId}/config`;
                fetch(url, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(next),
                })
                    .then(async (res) => {
                        const data = JSON.parse(await res.text()).catch(
                            () => null,
                        ) as { error?: string } | null;
                        if (!res.ok) {
                            throw new Error(
                                data?.error ??
                                    "Failed to update configuration",
                            );
                        }
                        if (requestId === saveRequestIdRef.current) {
                            toast.success("Configuration updated.", {
                                id: "settings-config-updated",
                            });
                        }
                    })
                    .catch((error: unknown) => {
                        toast.error(
                            error instanceof Error
                                ? error.message
                                : String(error),
                        );
                    });
            }, 250);
        },
        [selectedConfigAccountId],
    );

    async function saveReciters(next: Set<number>) {
        setSavingReciters(true);
        try {
            const url =
                selectedConfigAccountId === "__global__"
                    ? "/api/configuration/reciters"
                    : `/api/accounts/${selectedConfigAccountId}/config`;
            const res = await fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledIds: [...next] }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok)
                throw new Error(data.error ?? "Failed to save reciters");
            toast.success("Configuration updated.", {
                id: "settings-config-updated",
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setSavingReciters(false);
        }
    }

    async function copyConfigFromAccount() {
        if (
            selectedConfigAccountId === "__global__" ||
            !copySourceAccountId ||
            copyingConfig
        ) {
            return;
        }
        setCopyingConfig(true);
        try {
            const res = await fetch(
                `/api/accounts/${selectedConfigAccountId}/config/copy`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourceAccountId: copySourceAccountId,
                    }),
                },
            );
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to copy config");
            }
            applyConfig(data);
            toast.success("Copied configuration from the selected account.");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : String(error),
            );
        } finally {
            setCopyingConfig(false);
        }
    }

    const configScopeItems = [
        { value: "__global__", label: "Global defaults" },
        ...accounts.map((account) => ({
            value: account._id,
            label: account.name,
            subtitle: account.type,
            image: account.icon,
        })),
    ];
    const copySourceItems = accounts
        .filter((account) => account._id !== selectedConfigAccountId)
        .map((account) => ({
            value: account._id,
            label: account.name,
            subtitle: account.type,
            image: account.icon,
        }));
    const copyConfigSourceItems = [
        {
            value: "__global__",
            label: "Global defaults",
            subtitle: "Shared base configuration",
        },
        ...copySourceItems,
    ];

    return (
        <div className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-2xl font-medium">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Global defaults stay intact. Select a linked account to add
                    account-specific overrides on top of them.
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
                                        Configuration target
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Choose whether you are editing the
                                        shared global defaults or one linked
                                        account&apos;s override config.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <SearchableSelect
                                        items={configScopeItems}
                                        value={selectedConfigAccountId}
                                        onChange={(value) => {
                                            setSelectedConfigAccountId(value);
                                            setCopySourceAccountId("");
                                        }}
                                        placeholder="Select config target"
                                        searchPlaceholder="Search config targets…"
                                        emptyLabel="No config targets found."
                                        className="w-full"
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        {selectedConfigAccountId !== "__global__" && (
                            <TableRow className="border-b">
                                <TableCell className="w-[42%] whitespace-normal align-top md:w-[42%]">
                                    <div className="flex flex-col gap-1">
                                        <p className="font-medium text-sm">
                                            Copy from another account
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Clone another linked account&apos;s
                                            merged config into this account
                                            without touching the global
                                            defaults.
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-normal align-top">
                                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
                                        <SearchableSelect
                                            items={copyConfigSourceItems}
                                            value={copySourceAccountId}
                                            onChange={setCopySourceAccountId}
                                            placeholder="Select source config"
                                            searchPlaceholder="Search source configs…"
                                            emptyLabel="No other configs found."
                                            className="w-full"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={copyConfigFromAccount}
                                            disabled={
                                                !copySourceAccountId ||
                                                copyingConfig
                                            }
                                        >
                                            Copy Config
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
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
                                        Worker upload interval
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Minutes between automatic worker runs.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        max={1440}
                                        step={1}
                                        value={workerUploadIntervalMinutes}
                                        onChange={(e) => {
                                            const next = Number(e.target.value) || 60;
                                            setWorkerUploadIntervalMinutes(next);
                                            saveVideoConfig({
                                                workerUploadIntervalMinutes: next,
                                            });
                                        }}
                                        className="w-full"
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
                                        Extends the clip after the recitation ends. Negative values trim the clip early.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {clipTailSeconds.toFixed(1)}s
                                    </span>
                                    <Slider
                                        min={-5}
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
                                        Max background clip length
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Maximum seconds each background video segment can run before cutting to the next.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {maxVideoClipSeconds.toFixed(0)}s
                                    </span>
                                    <Slider
                                        min={1}
                                        max={60}
                                        step={1}
                                        value={[maxVideoClipSeconds]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v) ? (v[0] ?? 5) : v;
                                            setMaxVideoClipSeconds(next);
                                            saveVideoConfig({ maxVideoClipSeconds: next });
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
                                <div className="flex w-full min-w-0 flex-col gap-3">
                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-end">
                                        <div className="flex w-full min-w-0 flex-col gap-1.5">
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
                                        <div className="hidden h-9 items-center text-muted-foreground sm:flex">
                                            <ArrowRight className="size-4" />
                                        </div>
                                        <div className="flex w-full min-w-0 flex-col gap-1.5">
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
                                        <div className="hidden h-9 items-center text-xs text-muted-foreground sm:flex">
                                            seconds
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground sm:hidden">
                                        seconds
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Text color and stroke
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Configure the main text color and optional stroke.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-color"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Text color
                                        </Label>
                                        <Input
                                            id="text-color"
                                            value={textColor}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                setTextColor(next);
                                                saveVideoConfig({ textColor: next });
                                            }}
                                            placeholder="#FFFFFF"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-stroke-width"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Stroke width
                                        </Label>
                                        <Input
                                            id="text-stroke-width"
                                            type="number"
                                            min={0}
                                            max={20}
                                            step={0.5}
                                            value={textStrokeWidth}
                                            onChange={(e) => {
                                                const next = Number(e.target.value) || 0;
                                                setTextStrokeWidth(next);
                                                saveVideoConfig({ textStrokeWidth: next });
                                            }}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-stroke-color"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Stroke color
                                        </Label>
                                        <Input
                                            id="text-stroke-color"
                                            value={textStrokeColor}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                setTextStrokeColor(next);
                                                saveVideoConfig({ textStrokeColor: next });
                                            }}
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Text color and stroke
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Configure the main text color and optional stroke.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex w-full min-w-0 flex-col gap-2">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {textOpacity.toFixed(2)}
                                    </span>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[textOpacity]}
                                        onValueChange={(v) => {
                                            const next = Array.isArray(v) ? (v[0] ?? 1) : v;
                                            setTextOpacity(next);
                                            saveVideoConfig({ textOpacity: next });
                                        }}
                                        className="w-full"
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                        Outer glow
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Configure glow color, strength, and blur.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-glow-color"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Glow color
                                        </Label>
                                        <Input
                                            id="text-glow-color"
                                            value={textGlowColor}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                setTextGlowColor(next);
                                                saveVideoConfig({ textGlowColor: next });
                                            }}
                                            placeholder="#0E3A72"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-glow-alpha"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Glow alpha
                                        </Label>
                                        <Input
                                            id="text-glow-alpha"
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={textGlowAlpha}
                                            onChange={(e) => {
                                                const next = Number(e.target.value) || 0;
                                                setTextGlowAlpha(next);
                                                saveVideoConfig({ textGlowAlpha: next });
                                            }}
                                            placeholder="1"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-glow-sigma"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Glow blur
                                        </Label>
                                        <Input
                                            id="text-glow-sigma"
                                            type="number"
                                            min={0}
                                            max={300}
                                            step={1}
                                            value={textGlowSigma}
                                            onChange={(e) => {
                                                const next = Number(e.target.value) || 0;
                                                setTextGlowSigma(next);
                                                saveVideoConfig({ textGlowSigma: next });
                                            }}
                                            placeholder="100"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-inner-glow-alpha"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Inner glow alpha
                                        </Label>
                                        <Input
                                            id="text-inner-glow-alpha"
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={textInnerGlowAlpha}
                                            onChange={(e) => {
                                                const next = Number(e.target.value) || 0;
                                                setTextInnerGlowAlpha(next);
                                                saveVideoConfig({ textInnerGlowAlpha: next });
                                            }}
                                            placeholder="0.7"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor="text-inner-glow-sigma"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Inner glow blur
                                        </Label>
                                        <Input
                                            id="text-inner-glow-sigma"
                                            type="number"
                                            min={0}
                                            max={300}
                                            step={1}
                                            value={textInnerGlowSigma}
                                            onChange={(e) => {
                                                const next = Number(e.target.value) || 0;
                                                setTextInnerGlowSigma(next);
                                                saveVideoConfig({ textInnerGlowSigma: next });
                                            }}
                                            placeholder="6"
                                        />
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow className="border-b">
                            <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium">
                                        Allowed assets
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Choose whether this config can use all
                                        uploaded videos and LUTs or only a
                                        specific selection.
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">
                                <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
                                    <div className="flex min-w-0 flex-col gap-3">
                                        <Label className="text-xs text-muted-foreground">
                                            Videos
                                        </Label>
                                        <SearchableSelect
                                            items={[
                                                {
                                                    value: "all",
                                                    label: "All videos",
                                                },
                                                {
                                                    value: "specific",
                                                    label: "Specific videos only",
                                                },
                                            ]}
                                            value={videoSelectionMode}
                                            onChange={(value) => {
                                                setVideoSelectionMode(value);
                                                saveVideoConfig({
                                                    videoSelectionMode: value,
                                                });
                                            }}
                                            placeholder="Select video mode"
                                            searchPlaceholder="Search modes…"
                                            emptyLabel="No modes found."
                                            className="w-full"
                                        />
                                        {videoSelectionMode === "specific" && (
                                            <AssetMultiSelect
                                                items={videos.map((video) => ({
                                                    id: video._id,
                                                    label: video.name,
                                                    subtitle:
                                                        video.originalFilename,
                                                }))}
                                                value={selectedVideoIds}
                                                onChange={(next) => {
                                                    setSelectedVideoIds(next);
                                                    saveVideoConfig({
                                                        selectedVideoIds: next,
                                                    });
                                                }}
                                                placeholder="Select videos"
                                            />
                                        )}
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-3">
                                        <Label className="text-xs text-muted-foreground">
                                            LUTs
                                        </Label>
                                        <SearchableSelect
                                            items={[
                                                {
                                                    value: "all",
                                                    label: "All LUTs",
                                                },
                                                {
                                                    value: "specific",
                                                    label: "Specific LUTs only",
                                                },
                                            ]}
                                            value={lutSelectionMode}
                                            onChange={(value) => {
                                                setLutSelectionMode(value);
                                                saveVideoConfig({
                                                    lutSelectionMode: value,
                                                });
                                            }}
                                            placeholder="Select LUT mode"
                                            searchPlaceholder="Search modes…"
                                            emptyLabel="No modes found."
                                            className="w-full"
                                        />
                                        {lutSelectionMode === "specific" && (
                                            <AssetMultiSelect
                                                items={luts.map((lut) => ({
                                                    id: lut._id,
                                                    label: lut.name,
                                                    subtitle:
                                                        lut.originalFilename,
                                                }))}
                                                value={selectedLutIds}
                                                onChange={(next) => {
                                                    setSelectedLutIds(next);
                                                    saveVideoConfig({
                                                        selectedLutIds: next,
                                                    });
                                                }}
                                                placeholder="Select LUTs"
                                            />
                                        )}
                                    </div>
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
