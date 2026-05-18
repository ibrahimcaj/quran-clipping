export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET() {
    try {
        const db = await getDb();
        const presets = await db
            .collection("textOverridePresets")
            .find()
            .sort({ updatedAt: -1, createdAt: -1 })
            .toArray();
        return NextResponse.json(
            presets.map((preset) => ({ ...preset, _id: preset._id.toString() })),
        );
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as {
            name?: string;
            title?: string;
            subtitle?: string;
            titleFontSize?: number;
            subtitleFontSize?: number;
            scaleX?: number;
            scaleY?: number;
            lineSpacing?: number;
            uploadCaptionOverride?: string;
        };
        const name = body.name?.trim();
        const title = body.title?.trim();
        if (!name || !title) {
            return NextResponse.json(
                { error: "Preset name and title are required" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const doc = {
            _id: new ObjectId(),
            name,
            title,
            subtitle: body.subtitle?.trim() ?? "",
            titleFontSize:
                typeof body.titleFontSize === "number" ? body.titleFontSize : 36,
            subtitleFontSize:
                typeof body.subtitleFontSize === "number"
                    ? body.subtitleFontSize
                    : 11,
            scaleX: typeof body.scaleX === "number" ? body.scaleX : 80,
            scaleY: typeof body.scaleY === "number" ? body.scaleY : 125,
            lineSpacing:
                typeof body.lineSpacing === "number" ? body.lineSpacing : -6,
            uploadCaptionOverride: body.uploadCaptionOverride?.trim() ?? "",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection("textOverridePresets").insertOne(doc);
        return NextResponse.json({ ...doc, _id: doc._id.toString() }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
