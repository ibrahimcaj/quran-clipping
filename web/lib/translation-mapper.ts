import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

const ai = genkit({ plugins: [googleAI()] });

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
    log?: (msg: string) => Promise<void> | void,
): Promise<MappedSegment[]> {
    const segmentsJson = JSON.stringify(arabicSegments.map((s) => s.text));

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

    const result = await ai.generate({
        model: googleAI.model("gemini-2.5-flash"),
        prompt,
    });

    const responseText = result.text.trim();
    await log?.(`Gemini raw response: ${responseText.substring(0, 200)}`);

    const jsonText = responseText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonText) as Array<{
        arabic: string;
        english: string;
    }>;

    return parsed.map((item, index) => ({
        arabicText: item.arabic,
        englishTranslation: item.english,
        position: index,
    }));
}
