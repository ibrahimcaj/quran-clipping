import * as fs from "fs";
import * as path from "path";
import type { Collection, Document } from "mongodb";

export const EXPERIMENT_OUTPUT_TTL_MS = 60 * 60 * 1000;

function asDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string" || typeof value === "number") {
        const next = new Date(value);
        return Number.isNaN(next.getTime()) ? null : next;
    }
    return null;
}

export function deleteExperimentOutputDirectory(outputPath: string) {
    const workDir = path.dirname(outputPath);
    if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

export async function resolveExperimentOutputState(
    collection: Collection<Document>,
    doc: Document | null,
) {
    if (!doc) {
        return { doc: null, hasOutputFile: false };
    }

    const outputPath =
        typeof doc.outputPath === "string" && doc.outputPath.length > 0
            ? doc.outputPath
            : null;
    if (!outputPath) {
        return { doc, hasOutputFile: false };
    }

    const fileExists = fs.existsSync(outputPath);
    const outputCreatedAt =
        asDate(doc.outputCreatedAt) ??
        (fileExists ? new Date(fs.statSync(outputPath).mtimeMs) : null);

    const expired =
        !!outputCreatedAt &&
        Date.now() - outputCreatedAt.getTime() > EXPERIMENT_OUTPUT_TTL_MS;

    if (!fileExists || expired) {
        if (fileExists) {
            deleteExperimentOutputDirectory(outputPath);
        }

        const expiredAt = new Date();
        await collection.updateOne(
            { _id: doc._id },
            {
                $set: {
                    outputPath: null,
                    outputName: null,
                    outputCreatedAt: null,
                    outputExpiredAt: expiredAt,
                    updatedAt: expiredAt,
                },
            },
        );

        return {
            doc: {
                ...doc,
                outputPath: null,
                outputName: null,
                outputCreatedAt: null,
                outputExpiredAt: expiredAt,
                updatedAt: expiredAt,
            },
            hasOutputFile: false,
        };
    }

    return { doc, hasOutputFile: true };
}

export function serializeExperiment(doc: Document, hasOutputFile: boolean) {
    return {
        ...doc,
        _id: doc._id.toString(),
        lutId: doc.lutId?.toString?.() ?? doc.lutId,
        overlayId: doc.overlayId?.toString?.() ?? doc.overlayId,
        hasOutputFile,
    };
}
