export const DEFAULT_QURAN_HASHTAGS = [
    "#quran",
    "#ayah",
    "#surah",
    "#tilawah",
    "#recitation",
    "#quranrecitation",
    "#quranquotes",
    "#qurantilawah",
    "#islam",
    "#deen",
    "#allah",
    "#muslim",
    "#islamic",
    "#reminder",
    "#quranvideo",
].join(" ");

export const DEFAULT_UPLOAD_CAPTION_TEMPLATE =
    "{{verseKey}} {{surahName}} {{reciterName}}\n\n{{hashtags}}";

export function formatUploadCaption(
    template: string,
    values: Record<string, string>,
) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
        return values[key] ?? "";
    }).trim();
}
