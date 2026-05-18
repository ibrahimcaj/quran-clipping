export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
    getMergedAccountConfig,
    sanitizeAccountConfigPatch,
} from "@/lib/account-config";

export async function GET(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
        }
        const db = await getDb();
        const account = await db.collection("accounts").findOne({
            _id: new ObjectId(id),
        });
        if (!account) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }
        return NextResponse.json(await getMergedAccountConfig(db, id));
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
        }
        const body = (await req.json()) as {
            enabledIds?: number[];
            vignette?: number;
            exposure?: number;
            saturation?: number;
            overlayId?: string | null;
            overlayBlendMode?: string;
            workerUploadIntervalMinutes?: number;
            audioLeadSeconds?: number;
            clipTailSeconds?: number;
            maxVideoClipSeconds?: number;
            randomAyahMinSeconds?: number;
            randomAyahMaxSeconds?: number;
            uploadCaptionTemplate?: string;
            textOpacity?: number;
            textColor?: string;
            textStrokeWidth?: number;
            textStrokeColor?: string;
            textGlowAlpha?: number;
            textGlowSigma?: number;
            textGlowColor?: string;
            textInnerGlowAlpha?: number;
            textInnerGlowSigma?: number;
            videoSelectionMode?: string;
            selectedVideoIds?: string[];
            lutSelectionMode?: string;
            selectedLutIds?: string[];
        };
        const db = await getDb();
        const account = await db.collection("accounts").findOne({
            _id: new ObjectId(id),
        });
        if (!account) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const update = sanitizeAccountConfigPatch(body);
        await db.collection("accountConfigurations").updateOne(
            { accountId: new ObjectId(id) },
            {
                $set: {
                    accountId: new ObjectId(id),
                    ...update,
                    updatedAt: new Date(),
                },
            },
            { upsert: true },
        );

        return NextResponse.json(await getMergedAccountConfig(db, id));
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
