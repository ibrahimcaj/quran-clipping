export function getVerseDurationSeconds(
    verse: Record<string, unknown>,
): number | null {
    const audio = verse.audio as { segments?: unknown } | null | undefined;
    if (
        !audio ||
        !Array.isArray(audio.segments) ||
        audio.segments.length === 0
    ) {
        return null;
    }

    const segments = audio.segments;
    let maxEndTime = 0;

    for (const segment of segments) {
        if (!Array.isArray(segment)) continue;

        let endTime: number | null = null;

        // ayah-recitation verse payloads: [segment_index, word_position, from_ms, to_ms]
        if (segment.length >= 4 && typeof segment[3] === "number") {
            endTime = segment[3];
        }

        // chapter-reciter timing payloads: [word_position, from_ms, to_ms]
        if (segment.length === 3 && typeof segment[2] === "number") {
            endTime = segment[2];
        }

        if (endTime !== null && endTime > maxEndTime) {
            maxEndTime = endTime;
        }
    }

    return maxEndTime > 0 ? maxEndTime / 1000 : null;
}
