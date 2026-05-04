"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Bookmark,
    ChevronDown,
    ChevronRight,
    Loader2,
    MoreHorizontal,
    Pin,
    RotateCcw,
    Search,
    Square,
    Trash2,
    Type,
    Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { statusLabel } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { OverlayBlendMode } from "@/lib/ffmpeg-experiments";
import { AYAHS_PER_SURAH } from "@/lib/quran";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Progress } from "@/components/ui/progress";

// Confirmed URL patterns from api.quran.com for each recitation ID.
// IDs 6/11/12 use a separate everyayah mirror; all others use audio.qurancdn.com.
const RECITER_PATHS: Record<string, { cdn: string; path: string }> = {
    "1": { cdn: "https://audio.qurancdn.com", path: "AbdulBaset/Mujawwad/mp3" },
    "2": { cdn: "https://audio.qurancdn.com", path: "AbdulBaset/Murattal/mp3" },
    "3": { cdn: "https://audio.qurancdn.com", path: "Sudais/mp3" },
    "4": { cdn: "https://audio.qurancdn.com", path: "Shatri/mp3" },
    "5": { cdn: "https://audio.qurancdn.com", path: "Rifai/mp3" },
    "6": {
        cdn: "https://mirrors.quranicaudio.com/everyayah",
        path: "Husary_64kbps",
    },
    "7": { cdn: "https://audio.qurancdn.com", path: "Alafasy/mp3" },
    "8": { cdn: "https://audio.qurancdn.com", path: "Minshawi/Mujawwad/mp3" },
    "9": { cdn: "https://audio.qurancdn.com", path: "Minshawi/Murattal/mp3" },
    "10": { cdn: "https://audio.qurancdn.com", path: "Shuraym/mp3" },
    "11": {
        cdn: "https://mirrors.quranicaudio.com/everyayah",
        path: "Mohammad_al_Tablaway_128kbps",
    },
    "12": {
        cdn: "https://mirrors.quranicaudio.com/everyayah",
        path: "Husary_Muallim_128kbps",
    },
};

const RECITERS = [
    { id: "7", label: "Mishari Al-Afasy" },
    { id: "2", label: "Abdul Basit (Murattal)" },
    { id: "1", label: "Abdul Basit (Mujawwad)" },
    { id: "3", label: "Abdur-Rahman As-Sudais" },
    { id: "4", label: "Abu Bakr Al-Shatri" },
    { id: "5", label: "Hani Ar-Rifai" },
    { id: "6", label: "Mahmoud Al-Husary" },
    { id: "12", label: "Mahmoud Al-Husary (Muallim)" },
    { id: "8", label: "Mohamed Al-Minshawi (Mujawwad)" },
    { id: "9", label: "Mohamed Al-Minshawi (Murattal)" },
    { id: "10", label: "Saud Ash-Shuraym" },
    { id: "11", label: "Mohamed Al-Tablawi" },
] as const;

// Build the full audio URL for a verse from its key ("2:255") and recitation ID.
// verse_key is "chapter:verse"; both parts are zero-padded to 3 digits: "002255.mp3"
function verseAudioUrl(verseKey: string, recitationId: string): string | null {
    const entry = RECITER_PATHS[recitationId];
    if (!entry) return null;
    const [ch, v] = verseKey.split(":");
    if (!ch || !v) return null;
    const file = `${ch.padStart(3, "0")}${v.padStart(3, "0")}.mp3`;
    return `${entry.cdn}/${entry.path}/${file}`;
}

interface Word {
    id: number;
    position: number;
    audio_url: string | null;
    char_type_name: string;
    text_uthmani?: string;
    translation?: { text: string; language_name: string };
    transliteration?: { text: string; language_name: string };
    timestamp_from?: number;
    timestamp_to?: number;
}

interface VerseAudio {
    url?: string;
    segments?: number[][];
}

interface Verse {
    id: number;
    verse_key: string;
    verse_number: number;
    chapter_id?: number;
    text_uthmani: string;
    juz_number: number;
    page_number: number;
    words: Word[];
    audio?: VerseAudio;
    translations?: { resource_id: number; text: string }[];
}

interface VersesResponse {
    verses?: Verse[];
    verse?: Verse;
    pagination?: {
        per_page: number;
        current_page: number;
        next_page: number | null;
        total_pages: number;
        total_records: number;
    };
}

interface VideoAsset {
    _id: string;
    originalFilename: string;
    name: string;
}

interface AudioAsset {
    _id: string;
    originalFilename: string;
    name: string;
}

interface TextOverridePreset {
    _id: string;
    name: string;
    title: string;
    subtitle: string;
    titleFontSize: number;
    subtitleFontSize: number;
    scaleX: number;
    scaleY: number;
    lineSpacing: number;
    uploadCaptionOverride?: string;
}

interface Recitation {
    id: number;
    reciter_name: string;
    style: string | null;
}

interface ExperimentAsset {
    _id: string;
    operation: "pipeline" | "mix_random_verse";
    sourceVideoIds?: string[];
    sourceVideoNames: string[];
    sourceVideoCount: number;
    outputName?: string | null;
    overlayId?: string | null;
    overlayName?: string | null;
    overlayBlendMode?: OverlayBlendMode | null;
    recitationId?: string | null;
    reciterName?: string | null;
    verseKey?: string | null;
    verseText?: string | null;
    status: "queued" | "running" | "completed" | "failed" | "cancelled";
    currentStep: string;
    currentStepPercent?: number;
    currentStepFrameCount?: number;
    currentStepTotalFrames?: number;
    logs?: { message: string; createdAt: string }[];
    uploads?: {
        accountId: string;
        platform: "youtube" | "instagram";
        accountName: string;
        status: "uploaded" | "failed";
        uploadedAt: string;
        externalId?: string;
        url?: string;
        error?: string;
    }[];
    hasOutputFile?: boolean;
    customAudioId?: string | null;
    createdAt: string;
}

interface ChapterMeta {
    id: number;
    name_simple: string;
}

interface SavedAyah {
    _id: string;
    verseKey: string;
    verseText: string;
    translation?: string | null;
    preferredRecitationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

type VerseFinderMode = "random" | "specific" | "saved";
type AudioSourceMode = "reciter" | "audio";

async function readJson<T>(res: Response): Promise<T> {
    return JSON.parse(await res.text()) as T;
}

function ensureArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function VerseAudioPlayer({
    verseKey,
    recitationId,
}: {
    verseKey: string;
    recitationId: string;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);

    const src = verseAudioUrl(verseKey, recitationId);
    if (!src) return null;

    function toggle() {
        const el = audioRef.current;
        if (!el) return;
        if (playing) {
            el.pause();
            setPlaying(false);
        } else {
            el.play()
                .then(() => setPlaying(true))
                .catch(() => setPlaying(false));
        }
    }

    return (
        <div className="flex items-center">
            <audio
                ref={audioRef}
                src={src}
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
            />
            <Button
                variant="outline"
                size="icon"
                onClick={toggle}
                title={playing ? "Pause recitation" : "Play recitation"}
                aria-label={playing ? "Pause recitation" : "Play recitation"}
                className="h-9 w-9 rounded-r-none"
            >
                <span className="text-sm leading-none">
                    {playing ? "⏸" : "▶"}
                </span>
            </Button>
        </div>
    );
}

function VerseCard({
    verse,
    recitationId,
    onUseForRender,
    onToggleSaved,
    onGenerate,
    onOpenTextOverride,
    selectedForRender = false,
    saved = false,
    hasTextOverride = false,
}: {
    verse: Verse;
    recitationId: string;
    onUseForRender?: (verse: Verse | null) => void;
    onToggleSaved?: (verse: Verse) => void;
    onGenerate?: (verse: Verse) => void;
    onOpenTextOverride?: () => void;
    selectedForRender?: boolean;
    saved?: boolean;
    hasTextOverride?: boolean;
}) {
    const wordAudioRef = useRef<HTMLAudioElement>(null);
    const stopPlaybackRef = useRef<number | null>(null);
    const translation =
        verse.translations?.[0]?.text?.replace(/<[^>]+>/g, "") ?? "";
    const wordsOnly = [
        ...(verse.words?.filter((w) => w.char_type_name === "word") ?? []),
    ].sort((a, b) => a.position - b.position);
    const recitationSrc = verseAudioUrl(verse.verse_key, recitationId);
    const maxTs = wordsOnly.reduce(
        (m, w) => Math.max(m, w.timestamp_to ?? 0),
        0,
    );
    const durationSeconds = maxTs > 0 ? maxTs / 1000 : null;

    useEffect(() => {
        const audio = wordAudioRef.current;
        return () => {
            if (stopPlaybackRef.current) {
                window.clearTimeout(stopPlaybackRef.current);
            }
            audio?.pause();
        };
    }, []);

    async function ensureWordAudioReady(audio: HTMLAudioElement, src: string) {
        if (audio.src !== src) {
            audio.src = src;
            audio.load();
        }

        if (audio.readyState >= 1) return;

        await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error("Failed to load recitation audio"));
            };
            const cleanup = () => {
                audio.removeEventListener("loadedmetadata", onLoaded);
                audio.removeEventListener("error", onError);
            };

            audio.addEventListener("loadedmetadata", onLoaded, { once: true });
            audio.addEventListener("error", onError, { once: true });
        });
    }

    async function playWord(word: Word) {
        const audio = wordAudioRef.current;
        if (!audio || !recitationSrc) return;
        if (word.timestamp_from == null || word.timestamp_to == null) {
            toast.error("No timing data is available for this word yet.");
            return;
        }

        if (stopPlaybackRef.current) {
            window.clearTimeout(stopPlaybackRef.current);
            stopPlaybackRef.current = null;
        }

        const startSeconds = Math.max(word.timestamp_from / 1000 - 0.02, 0);
        const endSeconds = Math.max(
            word.timestamp_to / 1000,
            startSeconds + 0.08,
        );

        await ensureWordAudioReady(audio, recitationSrc);

        audio.pause();
        audio.currentTime = startSeconds;

        try {
            await audio.play();
            stopPlaybackRef.current = window.setTimeout(
                () => {
                    audio.pause();
                    audio.currentTime = startSeconds;
                    stopPlaybackRef.current = null;
                },
                Math.max((endSeconds - startSeconds) * 1000, 80),
            );
        } catch {
            toast.error("Unable to play the selected word.");
        }
    }

    function formatTimestamp(ms?: number) {
        if (ms == null) return "No timing";
        return `${(ms / 1000).toFixed(2)}s`;
    }

    return (
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{verse.verse_key}</span>
                    <span className="text-xs text-muted-foreground">
                        Juz {verse.juz_number} · Page {verse.page_number}
                        {durationSeconds !== null
                            ? ` · ${durationSeconds.toFixed(1)}s`
                            : ""}
                    </span>
                </div>
                <div className="flex items-center">
                    <VerseAudioPlayer
                        verseKey={verse.verse_key}
                        recitationId={recitationId}
                    />
                    {onUseForRender && (
                        <Button
                            variant={selectedForRender ? "default" : "outline"}
                            size="icon"
                            onClick={() =>
                                onUseForRender(selectedForRender ? null : verse)
                            }
                            title={
                                selectedForRender
                                    ? "Pinned for render"
                                    : "Pin for render"
                            }
                            aria-label={
                                selectedForRender
                                    ? "Pinned for render"
                                    : "Pin for render"
                            }
                            className="-ml-px h-9 w-9 rounded-none first:ml-0 first:rounded-l-md"
                        >
                            <Pin
                                className={cn(
                                    "size-4",
                                    selectedForRender && "fill-current",
                                )}
                            />
                        </Button>
                    )}
                    {onToggleSaved && (
                        <Button
                            variant={saved ? "default" : "outline"}
                            size="icon"
                            onClick={() => onToggleSaved(verse)}
                            title={saved ? "Saved ayah" : "Save ayah"}
                            aria-label={saved ? "Saved ayah" : "Save ayah"}
                            className="-ml-px h-9 w-9 rounded-none"
                        >
                            <Bookmark
                                className={cn(
                                    "size-4",
                                    saved && "fill-current",
                                )}
                            />
                        </Button>
                    )}
                    {onOpenTextOverride && (
                        <Button
                            variant={hasTextOverride ? "default" : "outline"}
                            size="icon"
                            onClick={onOpenTextOverride}
                            title={
                                hasTextOverride
                                    ? "Text override active"
                                    : "Set text override"
                            }
                            aria-label={
                                hasTextOverride
                                    ? "Text override active"
                                    : "Set text override"
                            }
                            className="-ml-px h-9 w-9 rounded-none"
                        >
                            <Type className="size-4" />
                        </Button>
                    )}
                    {onGenerate && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onGenerate(verse)}
                            title="Generate clip"
                            aria-label="Generate clip"
                            className="-ml-px h-9 gap-2 rounded-l-none rounded-r-md px-3"
                        >
                            <span>Send to queue</span>
                            <ChevronRight className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            <p
                className="text-2xl leading-loose text-right"
                dir="rtl"
                lang="ar"
                style={{ fontFamily: "serif" }}
            >
                {verse.text_uthmani}
            </p>

            {translation && (
                <p className="text-sm leading-relaxed text-right -mt-4 text-foreground/80 italic">
                    {translation}
                </p>
            )}

            <audio ref={wordAudioRef} preload="none" />

            {wordsOnly.length > 0 && (
                <div className="flex flex-wrap gap-x-1 gap-y-2 border-t pt-3">
                    {wordsOnly.map((w) => {
                        return (
                            <button
                                type="button"
                                key={w.id}
                                className="flex flex-col items-center gap-0 px-0 py-0 text-center transition-opacity hover:opacity-70"
                                onClick={() => void playWord(w)}
                                title={
                                    w.timestamp_from != null &&
                                    w.timestamp_to != null
                                        ? `Play ${formatTimestamp(w.timestamp_from)} to ${formatTimestamp(w.timestamp_to)}`
                                        : "No timing available"
                                }
                            >
                                <span
                                    className="text-lg leading-none"
                                    dir="rtl"
                                    lang="ar"
                                >
                                    {w.text_uthmani ?? "—"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {w.transliteration?.text ?? ""}
                                </span>
                                <span className="text-xs">
                                    {w.translation?.text ?? ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {formatTimestamp(w.timestamp_from)} -{" "}
                                    {formatTimestamp(w.timestamp_to)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function ClipsTab() {
    const [chapter, setChapter] = useState("1");
    const [ayah, setAyah] = useState("1");
    const [finderMode, setFinderMode] = useState<VerseFinderMode>("random");
    const [candidateVerse, setCandidateVerse] = useState<Verse | null>(null);
    const [finderLoading, setFinderLoading] = useState(false);
    const [randomAyahMinSeconds, setRandomAyahMinSeconds] = useState(0);
    const [randomAyahMaxSeconds, setRandomAyahMaxSeconds] = useState(30);
    const [recitations, setRecitations] = useState<Recitation[]>([]);
    const [enabledReciterIds, setEnabledReciterIds] = useState<string[]>(
        RECITERS.map((r) => r.id),
    );
    const [experimentReciterMode, setExperimentReciterMode] =
        useState<string>("random");
    const [finderAudioSourceMode, setFinderAudioSourceMode] =
        useState<AudioSourceMode>("reciter");
    const [candidateRecitationId, setCandidateRecitationId] =
        useState<string>("7");
    const [videos, setVideos] = useState<VideoAsset[]>([]);
    const [audios, setAudios] = useState<AudioAsset[]>([]);
    const [textPresets, setTextPresets] = useState<TextOverridePreset[]>([]);
    const [experiments, setExperiments] = useState<ExperimentAsset[]>([]);
    const [chapters, setChapters] = useState<Record<number, string>>({});
    const [, setExperimentLoading] = useState<string | null>(null);
    const [selectedExperiment, setSelectedExperiment] =
        useState<ExperimentAsset | null>(null);
    const [rowActionId, setRowActionId] = useState<string | null>(null);
    const [logLimit, setLogLimit] = useState<5 | 15 | 50 | 100 | "all">(5);
    const [selectedVerseForRender, setSelectedVerseForRender] =
        useState<Verse | null>(null);
    const [savedAyaat, setSavedAyaat] = useState<SavedAyah[]>([]);
    const [selectedSavedAyahId, setSelectedSavedAyahId] = useState("");
    const [savingAyah, setSavingAyah] = useState(false);
    const [loading, setLoading] = useState(true);
    const [runningWorker, setRunningWorker] = useState(false);
    const [textOverride, setTextOverride] = useState<{
        title: string;
        subtitle: string;
        titleFontSize: number;
        subtitleFontSize: number;
        scaleX: number;
        scaleY: number;
        lineSpacing: number;
        uploadCaptionOverride: string;
    } | null>(null);
    const [textOverrideOpen, setTextOverrideOpen] = useState(false);
    const [selectedTextPresetId, setSelectedTextPresetId] = useState("");
    const [textPresetName, setTextPresetName] = useState("");
    const [textOverrideDraftTitle, setTextOverrideDraftTitle] = useState("");
    const [textOverrideDraftSubtitle, setTextOverrideDraftSubtitle] =
        useState("");
    const [textOverrideDraftTitleFontSize, setTextOverrideDraftTitleFontSize] =
        useState(36);
    const [
        textOverrideDraftSubtitleFontSize,
        setTextOverrideDraftSubtitleFontSize,
    ] = useState(11);
    const [textOverrideDraftScaleX, setTextOverrideDraftScaleX] = useState(80);
    const [textOverrideDraftScaleY, setTextOverrideDraftScaleY] = useState(125);
    const [textOverrideDraftLineSpacing, setTextOverrideDraftLineSpacing] =
        useState(-6);
    const [
        textOverrideDraftUploadCaptionOverride,
        setTextOverrideDraftUploadCaptionOverride,
    ] = useState("");
    const [savingTextPreset, setSavingTextPreset] = useState(false);
    const [deletingTextPreset, setDeletingTextPreset] = useState(false);
    const [selectedCustomAudioId, setSelectedCustomAudioId] = useState("");
    const [customAudioStartSeconds, setCustomAudioStartSeconds] = useState(0);
    const [customAudioEndSeconds, setCustomAudioEndSeconds] = useState("");
    const [finderAudioId, setFinderAudioId] = useState("");
    const [finderAudioStartSeconds, setFinderAudioStartSeconds] = useState(0);
    const [finderAudioEndSeconds, setFinderAudioEndSeconds] = useState("");

    useEffect(() => {
        async function loadAssets() {
            setLoading(true);
            try {
                const [
                    videosRes,
                    audiosRes,
                    textPresetsRes,
                    experimentsRes,
                    chaptersRes,
                    reciterCfgRes,
                    recitersRes,
                    videoCfgRes,
                    savedAyaatRes,
                ] = await Promise.all([
                    fetch("/api/videos"),
                    fetch("/api/audios"),
                    fetch("/api/text-overrides"),
                    fetch("/api/ffmpeg/experiments"),
                    fetch("/api/qf/chapters"),
                    fetch("/api/configuration/reciters"),
                    fetch("/api/qf/reciters"),
                    fetch("/api/configuration/video"),
                    fetch("/api/saved-ayaat"),
                ]);
                const videosData = await readJson<VideoAsset[] | { error?: string }>(
                    videosRes,
                );
                const audiosData = await readJson<
                    AudioAsset[] | { error?: string }
                >(audiosRes);
                const textPresetsData = await readJson<
                    TextOverridePreset[] | { error?: string }
                >(textPresetsRes);
                const experimentsData = await readJson<
                    ExperimentAsset[] | { error?: string }
                >(experimentsRes);
                const chapterData = await readJson<{
                    chapters?: ChapterMeta[];
                }>(chaptersRes);
                setChapters(
                    Object.fromEntries(
                        (chapterData.chapters ?? []).map((chapter) => [
                            chapter.id,
                            chapter.name_simple,
                        ]),
                    ),
                );
                const reciterCfg = await readJson<{
                    enabledIds?: number[];
                    error?: string;
                }>(reciterCfgRes);
                const reciterData = await readJson<{
                    recitations?: Recitation[];
                    error?: string;
                }>(recitersRes);
                const videoCfg = await readJson<{
                    randomAyahMinSeconds?: number;
                    randomAyahMaxSeconds?: number;
                    error?: string;
                }>(videoCfgRes);
                const savedAyahData = await readJson<
                    SavedAyah[] | { error?: string }
                >(savedAyaatRes);

                if ("error" in videosData && videosData.error) {
                    throw new Error(videosData.error);
                }
                if ("error" in audiosData && audiosData.error) {
                    throw new Error(audiosData.error);
                }
                if ("error" in textPresetsData && textPresetsData.error) {
                    throw new Error(textPresetsData.error);
                }
                if ("error" in experimentsData && experimentsData.error) {
                    throw new Error(experimentsData.error);
                }
                if (reciterCfg.error) throw new Error(reciterCfg.error);
                if (reciterData.error) throw new Error(reciterData.error);
                if (videoCfg.error) throw new Error(videoCfg.error);
                if ("error" in savedAyahData && savedAyahData.error) {
                    throw new Error(savedAyahData.error);
                }

                setVideos(ensureArray<VideoAsset>(videosData));
                setAudios(ensureArray<AudioAsset>(audiosData));
                setTextPresets(
                    ensureArray<TextOverridePreset>(textPresetsData),
                );
                setExperiments(ensureArray<ExperimentAsset>(experimentsData));
                setRecitations(
                    [...(reciterData.recitations ?? [])].sort((a, b) =>
                        a.reciter_name.localeCompare(b.reciter_name),
                    ),
                );
                const enabled =
                    Array.isArray(reciterCfg.enabledIds) &&
                    reciterCfg.enabledIds.length > 0
                        ? reciterCfg.enabledIds.map(String)
                        : RECITERS.map((r) => r.id);
                setEnabledReciterIds(enabled);
                setCandidateRecitationId((current) =>
                    enabled.includes(current) ? current : (enabled[0] ?? "7"),
                );
                if (typeof videoCfg.randomAyahMinSeconds === "number")
                    setRandomAyahMinSeconds(videoCfg.randomAyahMinSeconds);
                if (typeof videoCfg.randomAyahMaxSeconds === "number")
                    setRandomAyahMaxSeconds(videoCfg.randomAyahMaxSeconds);
                setSavedAyaat(ensureArray<SavedAyah>(savedAyahData));
            } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        }

        void loadAssets();
    }, []);

    useEffect(() => {
        const hasActive = experiments.some(
            (experiment) =>
                experiment.status === "queued" ||
                experiment.status === "running",
        );
        if (!hasActive && !selectedExperiment) return;

        const interval = window.setInterval(async () => {
            try {
                const experimentsRes = await fetch("/api/ffmpeg/experiments");
                const nextExperiments = await readJson<
                    ExperimentAsset[] | { error?: string }
                >(experimentsRes);
                setExperiments(ensureArray<ExperimentAsset>(nextExperiments));

                if (selectedExperiment) {
                    const detailRes = await fetch(
                        `/api/ffmpeg/experiments/${selectedExperiment._id}`,
                    );
                    const detail = await readJson<
                        ExperimentAsset | { error?: string }
                    >(detailRes);
                    if (!Array.isArray(detail) && !("error" in detail)) {
                        setSelectedExperiment(detail as ExperimentAsset);
                    }
                }
            } catch {
                // Keep polling silent while a job is running.
            }
        }, 1500);

        return () => window.clearInterval(interval);
    }, [experiments, selectedExperiment]);

    function chooseFinderRecitationId() {
        if (experimentReciterMode !== "random") return experimentReciterMode;
        if (enabledReciterIds.length === 0) return "7";
        return enabledReciterIds[
            Math.floor(Math.random() * enabledReciterIds.length)
        ];
    }

    async function fetchRandom() {
        const nextRecitationId = chooseFinderRecitationId();
        setFinderLoading(true);
        setCandidateVerse(null);
        const maxAttempts = 10;
        try {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const res = await fetch(
                    `/api/qf/verses?random=true&recitation=${nextRecitationId}`,
                );
                const data = JSON.parse(await res.text());
                if (data.error) {
                    toast.error(data.error);
                    return;
                }
                const verse = data.verse ?? data.verses?.[0] ?? null;
                if (!verse) continue;
                const words = (verse.words ?? []) as Word[];
                const maxTs = words.reduce(
                    (m: number, w: Word) => Math.max(m, w.timestamp_to ?? 0),
                    0,
                );
                const durationS = maxTs / 1000;
                // skip duration check when no timing data is available
                if (durationS > 0) {
                    if (
                        randomAyahMinSeconds > 0 &&
                        durationS < randomAyahMinSeconds
                    )
                        continue;
                    if (
                        randomAyahMaxSeconds > 0 &&
                        durationS > randomAyahMaxSeconds
                    )
                        continue;
                }
                setCandidateVerse(verse);
                setCandidateRecitationId(nextRecitationId);
                return;
            }
            toast.error(
                `No verse found between ${randomAyahMinSeconds}–${randomAyahMaxSeconds}s after ${maxAttempts} tries.`,
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setFinderLoading(false);
        }
    }

    async function fetchSpecificVerse(e: React.FormEvent) {
        e.preventDefault();
        const nextRecitationId = chooseFinderRecitationId();
        setFinderLoading(true);
        setCandidateVerse(null);
        try {
            const verseKey = `${Number.parseInt(chapter, 10)}:${Number.parseInt(ayah, 10)}`;
            const params = new URLSearchParams({
                verse_key: verseKey,
                recitation: nextRecitationId,
                translations: "20",
            });
            const res = await fetch(`/api/qf/verses?${params}`);
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) {
                toast.error(data.error);
                return;
            }
            const nextVerse = data.verse ?? data.verses?.[0] ?? null;
            setCandidateVerse(nextVerse);
            setCandidateRecitationId(nextRecitationId);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setFinderLoading(false);
        }
    }

    async function fetchSavedVerse(savedAyahId: string) {
        const savedAyah = savedAyaat.find((item) => item._id === savedAyahId);
        if (!savedAyah) return;
        const forcedRecitationId = savedAyah.preferredRecitationId ?? null;
        if (savedAyah.preferredRecitationId) {
            setExperimentReciterMode(savedAyah.preferredRecitationId);
            setCandidateRecitationId(savedAyah.preferredRecitationId);
        }
        const nextRecitationId =
            forcedRecitationId || chooseFinderRecitationId();
        setFinderLoading(true);
        setCandidateVerse(null);
        try {
            const params = new URLSearchParams({
                verse_key: savedAyah.verseKey,
                recitation: nextRecitationId,
            });
            const res = await fetch(`/api/qf/verses?${params}`);
            const data = JSON.parse(await res.text()) as VersesResponse & {
                error?: string;
            };
            if (data.error) {
                throw new Error(data.error);
            }
            const nextVerse = data.verse ?? data.verses?.[0] ?? null;
            setCandidateVerse(nextVerse);
            setCandidateRecitationId(nextRecitationId);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setFinderLoading(false);
        }
    }

    async function toggleSavedAyah(verse: Verse) {
        if (savingAyah) return;
        const existing = savedAyaat.find(
            (item) => item.verseKey === verse.verse_key,
        );
        setSavingAyah(true);
        try {
            if (existing) {
                const res = await fetch(`/api/saved-ayaat?id=${existing._id}`, {
                    method: "DELETE",
                });
                const data = JSON.parse(await res.text()) as { error?: string };
                if (!res.ok) {
                    throw new Error(data.error ?? "Failed to remove ayah");
                }
                setSavedAyaat((current) =>
                    current.filter((item) => item._id !== existing._id),
                );
                if (selectedSavedAyahId === existing._id) {
                    setSelectedSavedAyahId("");
                }
                toast.success(`Removed ${verse.verse_key} from saved ayaat.`);
                return;
            }

            const translation =
                verse.translations?.[0]?.text?.replace(/<[^>]+>/g, "") ?? null;
            const res = await fetch("/api/saved-ayaat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    verseKey: verse.verse_key,
                    verseText: verse.text_uthmani,
                    translation,
                    preferredRecitationId:
                        experimentReciterMode !== "random"
                            ? candidateRecitationId
                            : null,
                }),
            });
            const data = JSON.parse(await res.text()) as SavedAyah & {
                error?: string;
            };
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to save ayah");
            }
            setSavedAyaat((current) => [data, ...current]);
            setSelectedSavedAyahId(data._id);
            toast.success(`Saved ${verse.verse_key}.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setSavingAyah(false);
        }
    }

    async function updateSavedAyahPreferredRecitation(
        savedAyahId: string,
        preferredRecitationId: string | null,
    ) {
        try {
            const res = await fetch("/api/saved-ayaat", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: savedAyahId,
                    preferredRecitationId,
                }),
            });
            const data = (await readJson<SavedAyah | { error?: string }>(res));
            if (!res.ok || ("error" in data && data.error)) {
                throw new Error(
                    "error" in data
                        ? data.error ?? "Failed to update saved ayah"
                        : "Failed to update saved ayah",
                );
            }
            setSavedAyaat((current) =>
                current.map((item) =>
                    item._id === savedAyahId ? (data as SavedAyah) : item,
                ),
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        }
    }

    function openTextOverrideDialog() {
        setSelectedTextPresetId("");
        setTextPresetName("");
        setTextOverrideDraftTitle(textOverride?.title ?? "");
        setTextOverrideDraftSubtitle(textOverride?.subtitle ?? "");
        setTextOverrideDraftTitleFontSize(textOverride?.titleFontSize ?? 36);
        setTextOverrideDraftSubtitleFontSize(
            textOverride?.subtitleFontSize ?? 11,
        );
        setTextOverrideDraftScaleX(textOverride?.scaleX ?? 80);
        setTextOverrideDraftScaleY(textOverride?.scaleY ?? 125);
        setTextOverrideDraftLineSpacing(textOverride?.lineSpacing ?? -6);
        setTextOverrideDraftUploadCaptionOverride(
            textOverride?.uploadCaptionOverride ?? "",
        );
        setTextOverrideOpen(true);
    }

    function applyTextPreset(presetId: string) {
        const preset = textPresets.find((item) => item._id === presetId);
        if (!preset) return;
        setSelectedTextPresetId(presetId);
        setTextPresetName(preset.name);
        setTextOverrideDraftTitle(preset.title);
        setTextOverrideDraftSubtitle(preset.subtitle);
        setTextOverrideDraftTitleFontSize(preset.titleFontSize);
        setTextOverrideDraftSubtitleFontSize(preset.subtitleFontSize);
        setTextOverrideDraftScaleX(preset.scaleX);
        setTextOverrideDraftScaleY(preset.scaleY);
        setTextOverrideDraftLineSpacing(preset.lineSpacing);
        setTextOverrideDraftUploadCaptionOverride(
            preset.uploadCaptionOverride ?? "",
        );
    }

    async function saveTextPreset() {
        const title = textOverrideDraftTitle.trim();
        const name = textPresetName.trim();
        if (!name || !title) {
            toast.error("Preset name and title are required.");
            return;
        }

        setSavingTextPreset(true);
        try {
            const res = await fetch("/api/text-overrides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    title,
                    subtitle: textOverrideDraftSubtitle.trim(),
                    titleFontSize: textOverrideDraftTitleFontSize,
                    subtitleFontSize: textOverrideDraftSubtitleFontSize,
                    scaleX: textOverrideDraftScaleX,
                    scaleY: textOverrideDraftScaleY,
                    lineSpacing: textOverrideDraftLineSpacing,
                    uploadCaptionOverride:
                        textOverrideDraftUploadCaptionOverride.trim(),
                }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to save text preset");
            }
            setTextPresets((current) => [data, ...current]);
            setSelectedTextPresetId(data._id);
            toast.success("Text preset saved.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setSavingTextPreset(false);
        }
    }

    async function deleteTextPreset() {
        if (!selectedTextPresetId) return;
        setDeletingTextPreset(true);
        try {
            const res = await fetch(
                `/api/text-overrides/${selectedTextPresetId}`,
                {
                    method: "DELETE",
                },
            );
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to delete text preset");
            }
            setTextPresets((current) =>
                current.filter((item) => item._id !== selectedTextPresetId),
            );
            setSelectedTextPresetId("");
            setTextPresetName("");
            toast.success("Text preset deleted.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingTextPreset(false);
        }
    }

    function applyTextOverride() {
        const title = textOverrideDraftTitle.trim();
        setTextOverride(
            title
                ? {
                      title,
                      subtitle: textOverrideDraftSubtitle.trim(),
                      titleFontSize: textOverrideDraftTitleFontSize,
                      subtitleFontSize: textOverrideDraftSubtitleFontSize,
                      scaleX: textOverrideDraftScaleX,
                      scaleY: textOverrideDraftScaleY,
                      lineSpacing: textOverrideDraftLineSpacing,
                      uploadCaptionOverride:
                          textOverrideDraftUploadCaptionOverride.trim(),
                  }
                : null,
        );
        setTextOverrideOpen(false);
    }

    function clearTextOverride() {
        setTextOverride(null);
        setTextOverrideOpen(false);
    }

    async function runExperiment(
        operation: "pipeline" | "mix_random_verse",
        options?: {
            verse?: Verse | null;
            recitationId?: string | null;
        },
    ) {
        if (videos.length === 0) {
            toast.error("Upload at least one video first.");
            return;
        }

        const verseForRun = options?.verse ?? selectedVerseForRender;
        const recitationIdForRun =
            options?.recitationId ?? candidateRecitationId;
        if (
            verseForRun &&
            finderAudioSourceMode === "audio" &&
            !finderAudioId
        ) {
            toast.error("Select an uploaded audio source first.");
            return;
        }
        if (
            verseForRun &&
            finderAudioSourceMode === "audio" &&
            !textOverride?.title
        ) {
            toast.error(
                "Set a text override before using uploaded audio on an ayah clip.",
            );
            return;
        }
        const customAudioIdForRun = verseForRun
            ? finderAudioSourceMode === "audio"
                ? finderAudioId
                : null
            : selectedCustomAudioId;
        const customAudioStartForRun = verseForRun
            ? finderAudioSourceMode === "audio"
                ? finderAudioStartSeconds
                : null
            : customAudioIdForRun
              ? customAudioStartSeconds
              : null;
        const parsedCustomAudioEnd =
            (
                verseForRun && finderAudioSourceMode === "audio"
                    ? finderAudioEndSeconds
                    : customAudioEndSeconds
            ).trim().length > 0
                ? Number(
                      verseForRun && finderAudioSourceMode === "audio"
                          ? finderAudioEndSeconds
                          : customAudioEndSeconds,
                  )
                : null;
        const customAudioEndForRun =
            typeof parsedCustomAudioEnd === "number" &&
            Number.isFinite(parsedCustomAudioEnd)
                ? parsedCustomAudioEnd
                : null;

        setExperimentLoading(operation);
        try {
            const res = await fetch("/api/ffmpeg/experiments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    operation,
                    verseKey: verseForRun?.verse_key ?? null,
                    recitationId: verseForRun ? recitationIdForRun : null,
                    textOverride: textOverride ?? null,
                    customAudioId: customAudioIdForRun || null,
                    customAudioStartSeconds: customAudioStartForRun,
                    customAudioEndSeconds: customAudioIdForRun
                        ? customAudioEndForRun
                        : null,
                }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(
                    data.error ?? "Failed to run ffmpeg experiment",
                );
            }
            setExperiments((current) => [data, ...current].slice(0, 20));
            setTextOverride(null);
            setSelectedCustomAudioId("");
            setCustomAudioStartSeconds(0);
            setCustomAudioEndSeconds("");
            setFinderAudioId("");
            setFinderAudioStartSeconds(0);
            setFinderAudioEndSeconds("");
            toast.success(
                customAudioIdForRun
                    ? verseForRun
                        ? `Clip started for ${verseForRun.verse_key} with uploaded audio.`
                        : "Custom clip started."
                    : verseForRun
                    ? `Pipeline started for ${verseForRun.verse_key}.`
                    : "Pipeline started.",
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setExperimentLoading(null);
        }
    }

    async function openExperiment(experiment: ExperimentAsset) {
        setSelectedExperiment(experiment);
        setLogLimit(5);
        try {
            const detailRes = await fetch(
                `/api/ffmpeg/experiments/${experiment._id}`,
            );
            const detail = JSON.parse(
                await detailRes.text(),
            ) as ExperimentAsset;
            setSelectedExperiment(detail);
        } catch {
            // Fall back to the list row data if detail fetch fails.
        }
    }

    async function restartExperiment(id: string) {
        setRowActionId(id);
        try {
            const res = await fetch(`/api/ffmpeg/experiments/${id}/restart`, {
                method: "POST",
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to restart experiment");
            }
            setExperiments((current) => [data, ...current].slice(0, 20));
            toast.success("Experiment restarted.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setRowActionId(null);
        }
    }

    async function deleteExperiment(id: string) {
        setRowActionId(id);
        try {
            const res = await fetch(`/api/ffmpeg/experiments/${id}`, {
                method: "DELETE",
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : { ok: res.ok };
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to delete experiment");
            }
            setExperiments((current) =>
                current.filter((experiment) => experiment._id !== id),
            );
            if (selectedExperiment?._id === id) {
                setSelectedExperiment(null);
            }
            toast.success("Experiment deleted.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setRowActionId(null);
        }
    }

    async function cancelExperiment(id: string) {
        setRowActionId(id);
        try {
            const res = await fetch(`/api/ffmpeg/experiments/${id}/cancel`, {
                method: "POST",
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to cancel experiment");
            }
            setExperiments((current) =>
                current.map((experiment) =>
                    experiment._id === id
                        ? { ...experiment, ...data }
                        : experiment,
                ),
            );
            if (selectedExperiment?._id === id) {
                setSelectedExperiment((current) =>
                    current ? { ...current, ...data } : current,
                );
            }
            if (data.cancelSignalSent) {
                toast.success("Cancellation signal sent.");
            } else {
                toast.success("Experiment marked cancelled.");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setRowActionId(null);
        }
    }

    async function uploadExperiment(id: string) {
        setRowActionId(id);
        try {
            const res = await fetch(`/api/ffmpeg/experiments/${id}/upload`, {
                method: "POST",
            });
            const data = JSON.parse(await res.text()) as {
                error?: string;
                results?: ExperimentAsset["uploads"];
                experiment?: ExperimentAsset | null;
            };
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to upload clip");
            }

            if (data.experiment) {
                setExperiments((current) =>
                    current.map((experiment) =>
                        experiment._id === id ? data.experiment! : experiment,
                    ),
                );
                if (selectedExperiment?._id === id) {
                    setSelectedExperiment(data.experiment);
                }
            }

            const uploadedCount =
                data.results?.filter((item) => item.status === "uploaded")
                    .length ?? 0;
            const failedCount =
                data.results?.filter((item) => item.status === "failed")
                    .length ?? 0;

            if (uploadedCount > 0 && failedCount === 0) {
                toast.success(
                    `Uploaded clip to ${uploadedCount} account${uploadedCount === 1 ? "" : "s"}.`,
                );
            } else if (uploadedCount > 0) {
                toast.success(
                    `Uploaded to ${uploadedCount} account${uploadedCount === 1 ? "" : "s"} with ${failedCount} failure${failedCount === 1 ? "" : "s"}.`,
                );
            } else {
                throw new Error(
                    data.results?.[0]?.error ??
                        "Upload failed for all accounts",
                );
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setRowActionId(null);
        }
    }

    function formatVerseLabel(experiment: ExperimentAsset) {
        if (!experiment.verseKey) {
            return "Selecting verse...";
        }
        const [chapterRaw] = experiment.verseKey.split(":");
        const chapterId = Number.parseInt(chapterRaw ?? "", 10);
        const chapterName = Number.isFinite(chapterId)
            ? chapters[chapterId]
            : undefined;
        return `${experiment.verseKey}${chapterName ? ` (${chapterName})` : ""}`;
    }

    const ayahOptions = useMemo(() => {
        const max = AYAHS_PER_SURAH[Number(chapter)] ?? 7;
        return Array.from({ length: max }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
        }));
    }, [chapter]);

    const chapterOptions = useMemo(
        () =>
            Object.entries(chapters)
                .map(([id, name]) => ({
                    value: id,
                    label: `${id}. ${name}`,
                }))
                .sort((a, b) => Number(a.value) - Number(b.value)),
        [chapters],
    );

    const experimentReciterOptions = useMemo(
        () => [
            {
                value: "random",
                label: "Random from enabled reciters",
                subtitle: "Uses the enabled set from Settings",
            },
            ...(recitations.length > 0
                ? recitations.map((reciter) => ({
                      value: String(reciter.id),
                      label: reciter.reciter_name,
                      subtitle: reciter.style ?? undefined,
                  }))
                : RECITERS.map((reciter) => ({
                      value: reciter.id,
                      label: reciter.label,
                  }))),
        ],
        [recitations],
    );

    const savedAyahOptions = useMemo(() => {
        return savedAyaat.map((item) => {
            const [chapterRaw] = item.verseKey.split(":");
            const chapterId = Number.parseInt(chapterRaw ?? "", 10);
            const chapterName = Number.isFinite(chapterId)
                ? chapters[chapterId]
                : undefined;
            const preferredReciter = item.preferredRecitationId
                ? recitations.find(
                      (recitation) =>
                          String(recitation.id) === item.preferredRecitationId,
                  )?.reciter_name ??
                  RECITERS.find(
                      (reciter) => reciter.id === item.preferredRecitationId,
                  )?.label
                : null;

            return {
                value: item._id,
                label: item.verseKey,
                subtitle: preferredReciter
                    ? `${chapterName ?? "Unknown surah"} · ${preferredReciter}`
                    : (chapterName ?? "Unknown surah"),
            };
        });
    }, [chapters, recitations, savedAyaat]);

    const textPresetOptions = useMemo(
        () =>
            textPresets.map((preset) => ({
                value: preset._id,
                label: preset.name,
                subtitle: preset.title,
            })),
        [textPresets],
    );

    const customAudioOptions = useMemo(
        () =>
            audios.map((audio) => ({
                value: audio._id,
                label: audio.name,
                subtitle: audio.originalFilename,
            })),
        [audios],
    );

    const selectedCustomAudio = useMemo(
        () => audios.find((audio) => audio._id === selectedCustomAudioId) ?? null,
        [audios, selectedCustomAudioId],
    );

    const audioSourceOptions = useMemo(
        () => [
            {
                value: "reciter",
                label: "Reciter audio",
                subtitle: "Use Quran recitation audio",
            },
            {
                value: "audio",
                label: "Uploaded audio",
                subtitle: "Use one of your uploaded audio files",
            },
        ],
        [],
    );

    const candidateVerseIsSaved = useMemo(
        () =>
            !!candidateVerse &&
            savedAyaat.some(
                (item) => item.verseKey === candidateVerse.verse_key,
            ),
        [candidateVerse, savedAyaat],
    );

    const visibleLogs = selectedExperiment?.logs
        ? logLimit === "all"
            ? selectedExperiment.logs
            : selectedExperiment.logs.slice(-logLimit)
        : [];

    async function runWorkerNow() {
        setRunningWorker(true);
        try {
            const res = await fetch("/api/worker/run", {
                method: "POST",
            });
            const data = await readJson<
                | {
                      status: "started";
                      jobId: string;
                      experimentId: string;
                      verseKey: string;
                      recitationId: string;
                  }
                | {
                      status: "busy" | "skipped";
                      reason: string;
                      jobId?: string;
                  }
                | { error?: string }
            >(res);
            if (!res.ok) {
                throw new Error(
                    "error" in data ? data.error ?? "Failed to run worker" : "Failed to run worker",
                );
            }
            if ("status" in data && data.status === "started") {
                toast.success(
                    `Worker started: ${data.verseKey} (${data.recitationId})`,
                );
                return;
            }
            if ("status" in data && data.status === "busy") {
                toast.message(data.reason);
                return;
            }
            if ("status" in data && data.status === "skipped") {
                toast.message(data.reason);
                return;
            }
            toast.success("Worker run requested.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setRunningWorker(false);
        }
    }

    return (
        <div className="flex flex-col gap-8 w-full">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-medium">Clips</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Find verses, preview timings, and generate rendered
                        Quran clips.
                    </p>
                </div>
                <Button
                    onClick={runWorkerNow}
                    disabled={runningWorker}
                    className="shrink-0"
                >
                    {runningWorker && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Run Worker
                </Button>
            </div>

            <div className="flex flex-col gap-4 w-full">
                {loading ? (
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-4">
                            <Skeleton className="h-9 w-full rounded-md" />
                            <div className="flex gap-3">
                                <Skeleton className="h-16 flex-1 rounded-md" />
                                <Skeleton className="h-16 flex-1 rounded-md" />
                                <Skeleton className="h-11 w-32 rounded-md" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-4">
                            <div className="flex w-full rounded-md border border-input overflow-hidden bg-background">
                                <button
                                    type="button"
                                    onClick={() => setFinderMode("random")}
                                    className={cn(
                                        "h-9 flex-1 px-3 text-sm",
                                        finderMode === "random"
                                            ? "bg-accent text-foreground"
                                            : "bg-background text-muted-foreground",
                                    )}
                                >
                                    Random
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFinderMode("specific")}
                                    className={cn(
                                        "h-9 flex-1 border-l px-3 text-sm",
                                        finderMode === "specific"
                                            ? "bg-accent text-foreground"
                                            : "bg-background text-muted-foreground",
                                    )}
                                >
                                    Specific ayah
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFinderMode("saved")}
                                    className={cn(
                                        "h-9 flex-1 border-l px-3 text-sm",
                                        finderMode === "saved"
                                            ? "bg-accent text-foreground"
                                            : "bg-background text-muted-foreground",
                                    )}
                                >
                                    Saved
                                </button>
                            </div>
                            <div className="flex w-full flex-row items-end gap-3">
                                {finderMode === "saved" ? (
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Saved ayah
                                        </Label>
                                        <SearchableSelect
                                            items={savedAyahOptions}
                                            value={selectedSavedAyahId}
                                            onChange={setSelectedSavedAyahId}
                                            placeholder="Choose a saved ayah"
                                            searchPlaceholder="Search saved ayaat…"
                                            emptyLabel="No saved ayaat yet."
                                            className="w-full min-w-0"
                                            disabled={savedAyaat.length === 0}
                                        />
                                    </div>
                                ) : null}
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Audio source
                                    </Label>
                                    <SearchableSelect
                                        items={audioSourceOptions}
                                        value={finderAudioSourceMode}
                                        onChange={(value) =>
                                            setFinderAudioSourceMode(
                                                value as AudioSourceMode,
                                            )
                                        }
                                        placeholder="Select audio source"
                                        searchPlaceholder="Search audio sources…"
                                        emptyLabel="No audio sources found."
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                        {finderAudioSourceMode === "audio"
                                            ? "Uploaded audio"
                                            : "Reciter"}
                                    </Label>
                                    {finderAudioSourceMode === "audio" ? (
                                        <SearchableSelect
                                            items={customAudioOptions}
                                            value={finderAudioId}
                                            onChange={setFinderAudioId}
                                            placeholder="Choose uploaded audio"
                                            searchPlaceholder="Search audio…"
                                            emptyLabel="No audio uploaded yet."
                                            className="w-full min-w-0"
                                            disabled={
                                                customAudioOptions.length === 0
                                            }
                                        />
                                    ) : (
                                        <SearchableSelect
                                            items={experimentReciterOptions}
                                            value={experimentReciterMode}
                                            onChange={(value) => {
                                                setExperimentReciterMode(value);
                                                if (finderMode === "saved" && selectedSavedAyahId) {
                                                    void updateSavedAyahPreferredRecitation(
                                                        selectedSavedAyahId,
                                                        value === "random"
                                                            ? null
                                                            : value,
                                                    );
                                                }
                                            }}
                                            placeholder="Select reciter"
                                            searchPlaceholder="Search reciters…"
                                            emptyLabel="No reciters found."
                                            className="w-full min-w-0"
                                        />
                                    )}
                                </div>
                                {finderAudioSourceMode === "audio" && (
                                    <>
                                        <div className="flex w-28 shrink-0 flex-col gap-1.5">
                                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Trim start
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={finderAudioStartSeconds}
                                                onChange={(e) =>
                                                    setFinderAudioStartSeconds(
                                                        Math.max(
                                                            0,
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                        ),
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="flex w-28 shrink-0 flex-col gap-1.5">
                                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Trim end
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={finderAudioEndSeconds}
                                                onChange={(e) =>
                                                    setFinderAudioEndSeconds(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Full"
                                            />
                                        </div>
                                    </>
                                )}
                                {finderMode === "specific" && (
                                    <>
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Surah
                                            </Label>
                                            <SearchableSelect
                                                items={chapterOptions}
                                                value={chapter}
                                                onChange={(id) => {
                                                    setChapter(id);
                                                    const max =
                                                        AYAHS_PER_SURAH[
                                                            Number(id)
                                                        ];
                                                    if (
                                                        max &&
                                                        Number(ayah) > max
                                                    )
                                                        setAyah(String(max));
                                                }}
                                                placeholder="Select surah"
                                                searchPlaceholder="Search surahs…"
                                                emptyLabel="No surahs found."
                                                className="w-full min-w-0"
                                            />
                                        </div>
                                        <div className="flex w-28 shrink-0 flex-col gap-1.5">
                                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Ayah
                                            </Label>
                                            <SearchableSelect
                                                items={ayahOptions}
                                                value={ayah}
                                                onChange={setAyah}
                                                placeholder="Ayah"
                                                searchPlaceholder="Search…"
                                                emptyLabel="No ayah found."
                                                className="w-full min-w-0"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="flex shrink-0 items-end">
                                    <Button
                                        onClick={
                                            finderMode === "random"
                                                ? fetchRandom
                                                : finderMode === "saved"
                                                  ? () =>
                                                        void fetchSavedVerse(
                                                            selectedSavedAyahId,
                                                        )
                                                  : undefined
                                        }
                                        size={"lg"}
                                        type={
                                            finderMode === "specific"
                                                ? "submit"
                                                : "button"
                                        }
                                        form={
                                            finderMode === "specific"
                                                ? "specific-ayah-form"
                                                : undefined
                                        }
                                        disabled={
                                            finderLoading ||
                                            (finderMode === "saved" &&
                                                !selectedSavedAyahId)
                                        }
                                        className="w-full"
                                        title={
                                            finderLoading
                                                ? "Finding ayah"
                                                : finderMode === "random"
                                                  ? "Find random ayah"
                                                  : "Find ayah"
                                        }
                                        aria-label={
                                            finderLoading
                                                ? "Finding ayah"
                                                : finderMode === "random"
                                                  ? "Find random ayah"
                                                  : "Find ayah"
                                        }
                                    >
                                        <Search className="size-4" />
                                        <span>Find Ayah</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <form
                            id="specific-ayah-form"
                            onSubmit={fetchSpecificVerse}
                            className="hidden"
                        />

                        {finderLoading && (
                            <div className="flex flex-col gap-4 border-t pt-5">
                                <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-16" />
                                            <Skeleton className="h-4 w-36" />
                                        </div>
                                        <Skeleton className="h-9 w-28" />
                                    </div>
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </div>
                        )}
                        {!finderLoading && candidateVerse && (
                            <div className="flex flex-col gap-4 border-t pt-5">
                                <VerseCard
                                    verse={candidateVerse}
                                    recitationId={candidateRecitationId}
                                    onUseForRender={setSelectedVerseForRender}
                                    onToggleSaved={(verse) => {
                                        void toggleSavedAyah(verse);
                                    }}
                                    onOpenTextOverride={openTextOverrideDialog}
                                    hasTextOverride={!!textOverride}
                                    onGenerate={(verse) => {
                                        setSelectedVerseForRender(verse);
                                        void runExperiment("mix_random_verse", {
                                            verse,
                                            recitationId: candidateRecitationId,
                                        });
                                    }}
                                    selectedForRender={
                                        selectedVerseForRender?.verse_key ===
                                        candidateVerse.verse_key
                                    }
                                    saved={candidateVerseIsSaved}
                                />
                            </div>
                        )}

                        <div className="flex flex-col gap-4 border-t pt-5">
                            <div className="rounded-lg border bg-card p-4">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-sm font-medium">
                                                Custom clip
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                Render uploaded audio with saved
                                                custom text instead of a Quran
                                                verse.
                                            </p>
                                        </div>
                                        <Button
                                            variant={
                                                textOverride
                                                    ? "default"
                                                    : "outline"
                                            }
                                            onClick={openTextOverrideDialog}
                                            className="shrink-0"
                                        >
                                            <Type className="mr-2 size-4" />
                                            {textOverride
                                                ? "Edit text"
                                                : "Set text"}
                                        </Button>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_120px_120px_auto] md:items-end">
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <Label>Custom audio</Label>
                                            <SearchableSelect
                                                items={customAudioOptions}
                                                value={selectedCustomAudioId}
                                                onChange={(value) => {
                                                    setSelectedCustomAudioId(
                                                        value,
                                                    );
                                                    setCustomAudioStartSeconds(
                                                        0,
                                                    );
                                                    setCustomAudioEndSeconds(
                                                        "",
                                                    );
                                                }}
                                                placeholder="Choose uploaded audio"
                                                searchPlaceholder="Search audio…"
                                                emptyLabel="No audio uploaded yet."
                                                className="w-full"
                                                disabled={
                                                    customAudioOptions.length ===
                                                    0
                                                }
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Trim start</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={customAudioStartSeconds}
                                                onChange={(e) =>
                                                    setCustomAudioStartSeconds(
                                                        Math.max(
                                                            0,
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                        ),
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Trim end</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={customAudioEndSeconds}
                                                onChange={(e) =>
                                                    setCustomAudioEndSeconds(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Full length"
                                            />
                                        </div>
                                        <Button
                                            onClick={() =>
                                                void runExperiment("pipeline", {
                                                    verse: null,
                                                    recitationId: null,
                                                })
                                            }
                                            disabled={
                                                !selectedCustomAudioId ||
                                                !textOverride?.title
                                            }
                                            className="w-full md:w-auto"
                                        >
                                            Generate custom clip
                                        </Button>
                                    </div>

                                    {selectedCustomAudio && (
                                        <div className="rounded-md border bg-background/60 p-3">
                                            <p className="truncate text-sm font-medium">
                                                {selectedCustomAudio.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {
                                                    selectedCustomAudio.originalFilename
                                                }
                                            </p>
                                            <audio
                                                controls
                                                preload="metadata"
                                                src={`/api/audios/${selectedCustomAudio._id}/file`}
                                                className="mt-3 w-full"
                                            />
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        {textOverride?.title
                                            ? `Using title: ${textOverride.title}`
                                            : "Set a text override title before generating a custom clip."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto w-full">
                    {loading ? (
                        <Table style={{ minWidth: 860 }}>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-b">
                                    <TableHead style={{ width: 260 }}>
                                        Output
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead style={{ width: 132 }}>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <TableRow key={index} className="border-b">
                                        <TableCell className="py-3">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="mt-2 h-3 w-28" />
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Skeleton className="h-4 w-36" />
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Skeleton className="h-4 w-48" />
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Skeleton className="h-8 w-16" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table style={{ minWidth: 860 }}>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-b">
                                    <TableHead style={{ width: 260 }}>
                                        Output
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead style={{ width: 132 }}>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {experiments.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="py-8 text-center text-sm text-muted-foreground"
                                        >
                                            No experiments run yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {experiments.map((experiment) => {
                                    const isCancellable =
                                        experiment.status === "queued" ||
                                        experiment.status === "running";
                                    const canUpload =
                                        experiment.status === "completed" &&
                                        !!experiment.hasOutputFile;
                                    return (
                                        <TableRow
                                            key={experiment._id}
                                            className="border-b cursor-pointer hover:bg-muted/30"
                                            onClick={() =>
                                                void openExperiment(experiment)
                                            }
                                        >
                                            <TableCell className="py-3 w-[260px] max-w-[260px]">
                                                <p
                                                    className="font-medium text-sm leading-tight truncate"
                                                    title={formatVerseLabel(
                                                        experiment,
                                                    )}
                                                >
                                                    {formatVerseLabel(
                                                        experiment,
                                                    )}
                                                </p>
                                                <p
                                                    className="text-xs text-muted-foreground truncate"
                                                    title={new Date(
                                                        experiment.createdAt,
                                                    ).toLocaleString()}
                                                >
                                                    {new Date(
                                                        experiment.createdAt,
                                                    ).toLocaleString()}
                                                </p>
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    "py-3 text-sm text-muted-foreground",
                                                    isCancellable &&
                                                        "animate-pulse",
                                                )}
                                            >
                                                {experiment.currentStep}
                                                {isCancellable &&
                                                    experiment.currentStepPercent !=
                                                        null &&
                                                    experiment.currentStepPercent >
                                                        0 && (
                                                        <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                                                            <Progress
                                                                value={
                                                                    experiment.currentStepPercent
                                                                }
                                                                className="h-0.5 flex-1"
                                                            />
                                                            <span className="text-[10px] tabular-nums shrink-0">
                                                                {
                                                                    experiment.currentStepPercent
                                                                }
                                                                %
                                                            </span>
                                                        </div>
                                                    )}
                                            </TableCell>
                                            <TableCell className="py-3 text-sm text-muted-foreground">
                                                <div className="min-w-0">
                                                    <p>
                                                        {experiment.reciterName ??
                                                            "Picking reciter..."}
                                                    </p>
                                                    <p className="truncate text-xs">
                                                        {experiment.sourceVideoCount >
                                                        0
                                                            ? `${experiment.sourceVideoCount} clip${experiment.sourceVideoCount === 1 ? "" : "s"}`
                                                            : "Picking clips..."}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className="py-3"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <div className="flex items-center gap-1">
                                                    {isCancellable && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8"
                                                            disabled={
                                                                rowActionId ===
                                                                experiment._id
                                                            }
                                                            onClick={() =>
                                                                void cancelExperiment(
                                                                    experiment._id,
                                                                )
                                                            }
                                                            title="Cancel experiment"
                                                        >
                                                            <Square className="size-3.5" />
                                                        </Button>
                                                    )}
                                                    {canUpload && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8"
                                                            disabled={
                                                                rowActionId ===
                                                                experiment._id
                                                            }
                                                            onClick={() =>
                                                                void uploadExperiment(
                                                                    experiment._id,
                                                                )
                                                            }
                                                            title="Upload clip"
                                                        >
                                                            <Upload className="size-3.5" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-8"
                                                        disabled={
                                                            rowActionId ===
                                                            experiment._id
                                                        }
                                                        onClick={() =>
                                                            void restartExperiment(
                                                                experiment._id,
                                                            )
                                                        }
                                                        title="Restart experiment"
                                                    >
                                                        <RotateCcw className="size-3.5" />
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
                                                                    void deleteExperiment(
                                                                        experiment._id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    rowActionId ===
                                                                    experiment._id
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
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            <Dialog open={textOverrideOpen} onOpenChange={setTextOverrideOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Text override</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-2">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <div className="flex flex-col gap-1.5">
                                <Label>Saved preset</Label>
                                <SearchableSelect
                                    items={textPresetOptions}
                                    value={selectedTextPresetId}
                                    onChange={applyTextPreset}
                                    placeholder="Load a saved text preset"
                                    searchPlaceholder="Search presets…"
                                    emptyLabel="No text presets yet."
                                    className="w-full"
                                    disabled={textPresetOptions.length === 0}
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => void deleteTextPreset()}
                                disabled={
                                    !selectedTextPresetId || deletingTextPreset
                                }
                            >
                                Delete preset
                            </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_80px]">
                            <div className="flex flex-col gap-1.5">
                                <Label>Title</Label>
                                <Textarea
                                    value={textOverrideDraftTitle}
                                    onChange={(e) =>
                                        setTextOverrideDraftTitle(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Big text…"
                                    rows={3}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Font size</Label>
                                <Input
                                    type="number"
                                    min={8}
                                    max={200}
                                    step={1}
                                    value={textOverrideDraftTitleFontSize}
                                    onChange={(e) =>
                                        setTextOverrideDraftTitleFontSize(
                                            Number(e.target.value) || 36,
                                        )
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_80px]">
                            <div className="flex flex-col gap-1.5">
                                <Label>Subtitle</Label>
                                <Textarea
                                    value={textOverrideDraftSubtitle}
                                    onChange={(e) =>
                                        setTextOverrideDraftSubtitle(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Small text…"
                                    rows={2}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Font size</Label>
                                <Input
                                    type="number"
                                    min={8}
                                    max={200}
                                    step={1}
                                    value={textOverrideDraftSubtitleFontSize}
                                    onChange={(e) =>
                                        setTextOverrideDraftSubtitleFontSize(
                                            Number(e.target.value) || 11,
                                        )
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="flex flex-col gap-1.5">
                                <Label>Scale X (%)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={500}
                                    step={1}
                                    value={textOverrideDraftScaleX}
                                    onChange={(e) =>
                                        setTextOverrideDraftScaleX(
                                            Number(e.target.value) || 100,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Scale Y (%)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={500}
                                    step={1}
                                    value={textOverrideDraftScaleY}
                                    onChange={(e) =>
                                        setTextOverrideDraftScaleY(
                                            Number(e.target.value) || 100,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Line spacing</Label>
                                <Input
                                    type="number"
                                    min={-100}
                                    max={200}
                                    step={1}
                                    value={textOverrideDraftLineSpacing}
                                    onChange={(e) =>
                                        setTextOverrideDraftLineSpacing(
                                            Number(e.target.value),
                                        )
                                    }
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Upload caption override</Label>
                            <Textarea
                                value={textOverrideDraftUploadCaptionOverride}
                                onChange={(e) =>
                                    setTextOverrideDraftUploadCaptionOverride(
                                        e.target.value,
                                    )
                                }
                                placeholder="Optional caption used when uploading this clip…"
                                rows={3}
                            />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <div className="flex flex-col gap-1.5">
                                <Label>Save as preset</Label>
                                <Input
                                    value={textPresetName}
                                    onChange={(e) =>
                                        setTextPresetName(e.target.value)
                                    }
                                    placeholder="Preset name"
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => void saveTextPreset()}
                                disabled={savingTextPreset}
                            >
                                Save preset
                            </Button>
                        </div>
                        <div className="flex justify-end gap-2">
                            {textOverride && (
                                <Button
                                    variant="outline"
                                    onClick={clearTextOverride}
                                >
                                    Clear
                                </Button>
                            )}
                            <Button onClick={applyTextOverride}>Apply</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!selectedExperiment}
                onOpenChange={(open) => !open && setSelectedExperiment(null)}
            >
                <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="truncate">
                            {selectedExperiment
                                ? formatVerseLabel(selectedExperiment)
                                : "Experiment"}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedExperiment && (
                        <div className="min-h-0 overflow-y-auto px-5 py-4">
                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                                <div className="min-w-0 flex flex-col gap-3">
                                    {selectedExperiment.status ===
                                        "completed" &&
                                    selectedExperiment.hasOutputFile &&
                                    selectedExperiment.outputName ? (
                                        <div className="overflow-hidden rounded-xl border bg-black">
                                            <video
                                                controls
                                                preload="metadata"
                                                src={`/api/ffmpeg/experiments/${selectedExperiment._id}/file`}
                                                className="max-h-[60vh] w-full object-contain"
                                            />
                                        </div>
                                    ) : selectedExperiment.status ===
                                      "completed" ? (
                                        <div className="flex min-h-64 items-center justify-center rounded-lg border bg-muted/30 px-6 text-center text-sm text-muted-foreground">
                                            Output expired and was removed from
                                            disk after one hour.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col min-h-64 items-center justify-center rounded-lg border bg-muted/30 px-6 text-center">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                {selectedExperiment.currentStep}
                                            </p>
                                            {selectedExperiment.currentStepPercent !==
                                                undefined &&
                                                selectedExperiment.currentStepPercent >
                                                    0 && (
                                                    <div className="w-full max-w-xs">
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary transition-all"
                                                                style={{
                                                                    width: `${selectedExperiment.currentStepPercent}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-2">
                                                            {
                                                                selectedExperiment.currentStepPercent
                                                            }
                                                            %
                                                            {selectedExperiment.currentStepFrameCount && (
                                                                <>
                                                                    {" "}
                                                                    - Frame{" "}
                                                                    {
                                                                        selectedExperiment.currentStepFrameCount
                                                                    }
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                    <div className="overflow-hidden rounded-lg border">
                                        <table className="w-full text-sm">
                                            <tbody>
                                                <tr className="border-b">
                                                    <td className="w-32 px-4 py-2 font-medium">
                                                        Status
                                                    </td>
                                                    <td className="px-4 py-2 text-muted-foreground">
                                                        {statusLabel(
                                                            selectedExperiment.status,
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="w-32 px-4 py-2 font-medium">
                                                        Current step
                                                    </td>
                                                    <td className="px-4 py-2 text-muted-foreground">
                                                        {
                                                            selectedExperiment.currentStep
                                                        }
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="w-32 px-4 py-2 font-medium">
                                                        Reciter
                                                    </td>
                                                    <td className="px-4 py-2 text-muted-foreground">
                                                        {selectedExperiment.reciterName ??
                                                            "Pending"}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="w-32 px-4 py-2 font-medium">
                                                        Verse
                                                    </td>
                                                    <td className="px-4 py-2 text-muted-foreground">
                                                        {formatVerseLabel(
                                                            selectedExperiment,
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="w-32 px-4 py-2 font-medium">
                                                        Uploads
                                                    </td>
                                                    <td className="px-4 py-2 text-muted-foreground">
                                                        {selectedExperiment
                                                            .uploads?.length
                                                            ? `${selectedExperiment.uploads.filter((item) => item.status === "uploaded").length} uploaded · ${selectedExperiment.uploads.filter((item) => item.status === "failed").length} failed`
                                                            : "None"}
                                                    </td>
                                                </tr>
                                                {selectedExperiment.outputName && (
                                                    <tr>
                                                        <td className="w-32 px-4 py-2 font-medium">
                                                            File
                                                        </td>
                                                        <td className="px-4 py-2 text-muted-foreground break-all">
                                                            {
                                                                selectedExperiment.outputName
                                                            }
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="min-w-0 flex min-h-64 flex-col rounded-lg border">
                                    <div className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm">
                                        <span>Live logs</span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                render={
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 gap-1 px-2 text-xs"
                                                    >
                                                        {logLimit === "all"
                                                            ? "All"
                                                            : `Last ${logLimit}`}
                                                        <ChevronDown className="size-3" />
                                                    </Button>
                                                }
                                            />
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuRadioGroup
                                                    value={String(logLimit)}
                                                    onValueChange={(value) =>
                                                        setLogLimit(
                                                            value === "all"
                                                                ? "all"
                                                                : (Number(
                                                                      value,
                                                                  ) as
                                                                      | 5
                                                                      | 15
                                                                      | 50
                                                                      | 100),
                                                        )
                                                    }
                                                >
                                                    <DropdownMenuRadioItem value="5">
                                                        Last 5
                                                    </DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="15">
                                                        Last 15
                                                    </DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="50">
                                                        Last 50
                                                    </DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="100">
                                                        Last 100
                                                    </DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="all">
                                                        All
                                                    </DropdownMenuRadioItem>
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
                                        {visibleLogs.length === 0 && (
                                            <p className="text-muted-foreground">
                                                No logs yet.
                                            </p>
                                        )}
                                        {visibleLogs.map((entry, index) => (
                                            <div
                                                key={`${entry.createdAt}-${index}`}
                                                className="space-y-1"
                                            >
                                                <p className="text-[10px] text-muted-foreground">
                                                    {new Date(
                                                        entry.createdAt,
                                                    ).toLocaleTimeString()}
                                                </p>
                                                <p className="break-words">
                                                    {entry.message}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
