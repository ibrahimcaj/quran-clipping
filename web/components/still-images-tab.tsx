"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
    OVERLAY_BLEND_MODES,
    type OverlayBlendMode,
} from "@/lib/ffmpeg-experiments";

interface Asset {
    _id: string;
    name: string;
    originalFilename: string;
}
interface VideoConfig {
    vignette?: number;
    exposure?: number;
    saturation?: number;
    overlayId?: string | null;
    overlayBlendMode?: OverlayBlendMode;
}

export function StillImagesTab() {
    const [videos, setVideos] = useState<Asset[]>([]);
    const [luts, setLuts] = useState<Asset[]>([]);
    const [overlays, setOverlays] = useState<Asset[]>([]);
    const [videoId, setVideoId] = useState("");
    const [lutId, setLutId] = useState("none");
    const [overlayId, setOverlayId] = useState("none");
    const [overlayBlendMode, setOverlayBlendMode] =
        useState<OverlayBlendMode>("normal");
    const [title, setTitle] = useState("");
    const [subtitle, setSubtitle] = useState("");
    const [titleFontSize, setTitleFontSize] = useState(32);
    const [subtitleFontSize, setSubtitleFontSize] = useState(14);
    const [scaleX, setScaleX] = useState(80);
    const [scaleY, setScaleY] = useState(125);
    const [lineSpacing, setLineSpacing] = useState(0);
    const [vignette, setVignette] = useState(0);
    const [exposure, setExposure] = useState(0);
    const [saturation, setSaturation] = useState(1);
    const [loading, setLoading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [vRes, lRes, oRes, cfgRes] = await Promise.all([
                    fetch("/api/videos"),
                    fetch("/api/luts"),
                    fetch("/api/overlays"),
                    fetch("/api/configuration/video"),
                ]);
                const vData = JSON.parse(await vRes.text()) as Asset[];
                const lData = JSON.parse(await lRes.text()) as Asset[];
                const oData = JSON.parse(await oRes.text()) as Asset[];
                const cfg = JSON.parse(await cfgRes.text()) as VideoConfig;
                setVideos(vData);
                setLuts(lData);
                setOverlays(oData);
                if (vData.length > 0) setVideoId(vData[0]._id);
                setVignette(
                    typeof cfg.vignette === "number" ? cfg.vignette : 0,
                );
                setExposure(
                    typeof cfg.exposure === "number" ? cfg.exposure : 0,
                );
                setSaturation(
                    typeof cfg.saturation === "number" ? cfg.saturation : 1,
                );
                setOverlayId(
                    typeof cfg.overlayId === "string" ? cfg.overlayId : "none",
                );
                setOverlayBlendMode(
                    typeof cfg.overlayBlendMode === "string"
                        ? cfg.overlayBlendMode
                        : "normal",
                );
            } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
            }
        }
        void load();
    }, []);

    async function generate() {
        if (!videoId) {
            toast.error("Select a video first.");
            return;
        }
        setLoading(true);
        if (imageUrl) {
            URL.revokeObjectURL(imageUrl);
            setImageUrl(null);
        }
        try {
            const res = await fetch("/api/still-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoId,
                    lutId: lutId === "none" ? null : lutId,
                    title,
                    subtitle,
                    titleFontSize,
                    subtitleFontSize,
                    scaleX,
                    scaleY,
                    lineSpacing,
                    vignette,
                    exposure,
                    saturation,
                    overlayId: overlayId === "none" ? null : overlayId,
                    overlayBlendMode,
                }),
            });
            if (!res.ok) {
                const data = JSON.parse(await res.text()) as { error?: string };
                throw new Error(data.error ?? "Failed to generate");
            }
            setImageUrl(URL.createObjectURL(await res.blob()));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-2xl font-medium">Still Images</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Generate a still from a random video frame with text
                    overlay.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
                <div className="flex min-w-0 w-full flex-col gap-4">
                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                        <Label>Video</Label>
                        <SearchableSelect
                            items={videos.map((v) => ({
                                value: v._id,
                                label: v.name || v.originalFilename,
                                image: `/api/videos/${v._id}/frame`,
                            }))}
                            value={videoId}
                            onChange={setVideoId}
                            placeholder="Select video"
                            searchPlaceholder="Search videos…"
                            emptyLabel="No videos found."
                            className="w-full"
                        />
                    </div>
                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                        <Label>LUT</Label>
                        <SearchableSelect
                            items={[
                                { value: "none", label: "None" },
                                ...luts.map((l) => ({
                                    value: l._id,
                                    label: l.name || l.originalFilename,
                                })),
                            ]}
                            value={lutId}
                            onChange={setLutId}
                            placeholder="Select LUT"
                            searchPlaceholder="Search LUTs…"
                            emptyLabel="No LUTs found."
                            className="w-full"
                        />
                    </div>
                    <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Overlay</Label>
                            <SearchableSelect
                                items={[
                                    { value: "none", label: "None" },
                                    ...overlays.map((o) => ({
                                        value: o._id,
                                        label: o.name || o.originalFilename,
                                    })),
                                ]}
                                value={overlayId}
                                onChange={setOverlayId}
                                placeholder="Select overlay"
                                searchPlaceholder="Search overlays…"
                                emptyLabel="No overlays found."
                                className="w-full"
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Overlay blend</Label>
                            <SearchableSelect
                                items={OVERLAY_BLEND_MODES.map((mode) => ({
                                    value: mode,
                                    label: mode,
                                }))}
                                value={overlayBlendMode}
                                onChange={(value) =>
                                    setOverlayBlendMode(
                                        value as OverlayBlendMode,
                                    )
                                }
                                placeholder="Select blend"
                                searchPlaceholder="Search blend modes…"
                                emptyLabel="No blend modes found."
                                disabled={overlayId === "none"}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="grid w-full min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_112px]">
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Title</Label>
                            <Textarea
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Big text…"
                                rows={3}
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Font size</Label>
                            <Input
                                type="number"
                                min={8}
                                max={200}
                                step={1}
                                value={titleFontSize}
                                onChange={(e) =>
                                    setTitleFontSize(
                                        Number(e.target.value) || 32,
                                    )
                                }
                            />
                        </div>
                    </div>
                    <div className="grid w-full min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_112px]">
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Subtitle</Label>
                            <Textarea
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                placeholder="Small text…"
                                rows={2}
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Font size</Label>
                            <Input
                                type="number"
                                min={8}
                                max={200}
                                step={1}
                                value={subtitleFontSize}
                                onChange={(e) =>
                                    setSubtitleFontSize(
                                        Number(e.target.value) || 14,
                                    )
                                }
                            />
                        </div>
                    </div>
                    <div className="grid w-full min-w-0 gap-4 sm:grid-cols-3">
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Scale X (%)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={500}
                                step={1}
                                value={scaleX}
                                onChange={(e) =>
                                    setScaleX(Number(e.target.value) || 100)
                                }
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Scale Y (%)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={500}
                                step={1}
                                value={scaleY}
                                onChange={(e) =>
                                    setScaleY(Number(e.target.value) || 100)
                                }
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-1.5">
                            <Label>Line spacing</Label>
                            <Input
                                type="number"
                                min={-100}
                                max={200}
                                step={1}
                                value={lineSpacing}
                                onChange={(e) =>
                                    setLineSpacing(Number(e.target.value))
                                }
                            />
                        </div>
                    </div>
                    <div className="grid w-full min-w-0 gap-4 sm:grid-cols-3">
                        <div className="flex w-full min-w-0 flex-col gap-2">
                            <Label>Exposure</Label>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {exposure >= 0 ? "+" : ""}
                                {exposure.toFixed(1)} EV
                            </span>
                            <Slider
                                min={-3}
                                max={3}
                                step={0.1}
                                value={[exposure]}
                                onValueChange={(v) =>
                                    setExposure(
                                        Array.isArray(v) ? (v[0] ?? 0) : v,
                                    )
                                }
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-2">
                            <Label>Saturation</Label>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {saturation.toFixed(2)}x
                            </span>
                            <Slider
                                min={0}
                                max={3}
                                step={0.01}
                                value={[saturation]}
                                onValueChange={(v) =>
                                    setSaturation(
                                        Array.isArray(v) ? (v[0] ?? 1) : v,
                                    )
                                }
                            />
                        </div>
                        <div className="flex w-full min-w-0 flex-col gap-2">
                            <Label>Vignette</Label>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {vignette.toFixed(2)}
                            </span>
                            <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[vignette]}
                                onValueChange={(v) =>
                                    setVignette(
                                        Array.isArray(v) ? (v[0] ?? 0) : v,
                                    )
                                }
                            />
                        </div>
                    </div>
                    <Button
                        className="w-full"
                        onClick={generate}
                        disabled={loading || !videoId}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Generating…
                            </>
                        ) : (
                            "Generate"
                        )}
                    </Button>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="overflow-hidden rounded-2xl border bg-muted/20">
                        <div className="relative aspect-square w-full">
                            {loading ? (
                                <div className="absolute inset-0">
                                    <Skeleton className="size-full" />
                                </div>
                            ) : imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={imageUrl}
                                    alt="Generated still"
                                    className="absolute inset-0 size-full object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                                    Generate a still to preview it here.
                                </div>
                            )}
                        </div>
                    </div>
                    {imageUrl && !loading && (
                        <a
                            href={imageUrl}
                            download="still.png"
                            className="text-xs text-center text-muted-foreground hover:text-foreground"
                        >
                            Download
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
