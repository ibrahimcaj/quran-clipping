import { generate } from "@genkit-ai/google-genai";
import { googleAI } from "@genkit-ai/google-genai";

export interface ArabicSegment {
    text: string;
    position: number;
}

export interface MappedSegment {
    arabicText: string;
    englishTranslation: string;
    position: number;
}

export async function mapTranslationsToSegments(
    arabicSegments: ArabicSegment[],
    fullEnglishTranslation: string,
): Promise<MappedSegment[]> {
    const arabicText = arabicSegments.map((s) => s.text).join(" ");
    const segmentsJson = JSON.stringify(arabicSegments.map((s) => s.text));

    console.log(
        "[Gemini Translation Mapper] Starting intelligent translation mapping",
    );
    console.log("[Gemini Translation Mapper] Arabic segments:", segmentsJson);
    console.log(
        "[Gemini Translation Mapper] Full translation:",
        fullEnglishTranslation,
    );

    const prompt = `I am creating a video with a maximum of 2 Arabic words on screen at a time. I have the original Arabic segments and the full idiomatic English translation.

Arabic segments (in order, each is what appears on screen):
${segmentsJson}

Full English translation of the complete verse:
"${fullEnglishTranslation}"

Your Task: Redistribute the full English translation into the provided Arabic segments.

Rules:
- Keep the Arabic segments exactly as they are (do not regroup them).
- Do NOT use literal word-for-word dictionary meanings. Instead, take the "full translation" and map its flow to the Arabic segments so it sounds natural when read sequence-by-sequence.
- Every Arabic segment must have a corresponding English translation.
- Ensure the English remains grammatically coherent as it builds up across the segments.

Respond ONLY with a valid JSON array (no markdown, no explanation). Each element has {"arabic": "segment text", "english": "translation"}:`;

    try {
        console.log("[Gemini Translation Mapper] Sending prompt to Gemini...");
        const result = await generate({
            model: googleAI.models.gemini15Flash,
            prompt,
        });

        console.log(
            "[Gemini Translation Mapper] Received response from Gemini",
        );
        const responseText = result.text.trim();
        console.log(
            "[Gemini Translation Mapper] Raw response:",
            responseText.substring(0, 200),
            "...",
        );

        // Remove markdown code blocks if present
        const jsonText = responseText.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(jsonText) as Array<{
            arabic: string;
            english: string;
        }>;

        console.log(
            "[Gemini Translation Mapper] Successfully parsed",
            parsed.length,
            "mapped segments",
        );
        parsed.forEach((item, index) => {
            console.log(
                `[Gemini Translation Mapper] Segment ${index}: "${item.arabic}" → "${item.english}"`,
            );
        });

        return parsed.map((item, index) => ({
            arabicText: item.arabic,
            englishTranslation: item.english,
            position: index,
        }));
    } catch (error) {
        console.error(
            "[Gemini Translation Mapper] Error during translation mapping:",
            error instanceof Error ? error.message : String(error),
        );
        throw error;
    }
}
