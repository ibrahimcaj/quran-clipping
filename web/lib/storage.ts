import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(process.cwd(), "..", "storage");

export const VIDEOS_DIR = path.join(ROOT, "videos");
export const VIDEO_UPLOADS_DIR = path.join(ROOT, "video-uploads");
export const LUTS_DIR = path.join(ROOT, "luts");
export const OVERLAYS_DIR = path.join(ROOT, "overlays");
export const EXPERIMENTS_DIR = path.join(ROOT, "experiments");
export const PREPARED_VIDEOS_DIR = path.join(ROOT, "prepared-videos");
export const LUT_PREVIEWS_DIR = path.join(ROOT, "lut-previews");
export const FRAMES_DIR = path.join(ROOT, "frames");

export function ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
}

const VIDEO_EXTS: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
};

const LUT_EXTS = new Set([".cube", ".3dl", ".look", ".lut"]);
const IMAGE_EXTS: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
};

export function getSafeVideoExtension(filename: string): string | null {
    const ext = path.extname(filename).toLowerCase();
    return VIDEO_EXTS[ext] ? ext : null;
}

export function getVideoMimeType(filePath: string): string {
    return VIDEO_EXTS[path.extname(filePath).toLowerCase()] ?? "video/mp4";
}

export function getSafeLutExtension(filename: string): string | null {
    const ext = path.extname(filename).toLowerCase();
    return LUT_EXTS.has(ext) ? ext : null;
}

export function getSafeImageExtension(filename: string): string | null {
    const ext = path.extname(filename).toLowerCase();
    return IMAGE_EXTS[ext] ? ext : null;
}

export function getImageMimeType(filePath: string): string {
    return IMAGE_EXTS[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function safeStem(filename: string): string {
    return path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9-_]+/g, "-");
}

export function safeSlug(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "asset";
}

export function buildVideoFilename(id: string, name: string) {
    return `${safeSlug(name)}-${id}.mp4`;
}

export function buildVideoFilePath(id: string, name: string) {
    return path.join(VIDEOS_DIR, buildVideoFilename(id, name));
}

export function buildVideoFramesDir(id: string, name: string) {
    return path.join(FRAMES_DIR, `${safeSlug(name)}-${id}`);
}
