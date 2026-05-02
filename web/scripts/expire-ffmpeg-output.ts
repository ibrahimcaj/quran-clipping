import "dotenv/config";

import * as fs from "fs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
    deleteExperimentOutputDirectory,
    EXPERIMENT_OUTPUT_TTL_MS,
} from "@/lib/ffmpeg-experiment-output";

async function main() {
    const [, , experimentId, expectedOutputPath] = process.argv;
    if (!experimentId || !expectedOutputPath || !ObjectId.isValid(experimentId)) {
        process.exit(1);
    }

    await new Promise((resolve) => setTimeout(resolve, EXPERIMENT_OUTPUT_TTL_MS));

    const db = await getDb();
    const collection = db.collection("ffmpegExperiments");
    const _id = new ObjectId(experimentId);
    const doc = await collection.findOne({ _id });

    if (!doc || doc.outputPath !== expectedOutputPath) {
        return;
    }

    if (typeof doc.outputPath === "string" && fs.existsSync(doc.outputPath)) {
        deleteExperimentOutputDirectory(doc.outputPath);
    }

    const expiredAt = new Date();
    await collection.updateOne(
        { _id },
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
}

void main().catch(() => {
    process.exit(1);
});
