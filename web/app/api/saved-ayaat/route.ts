export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

type SavedAyahDoc = {
    _id: ObjectId;
    verseKey: string;
    verseText: string;
    translation?: string | null;
    preferredRecitationId?: string | null;
    createdAt: Date;
    updatedAt: Date;
};

function normalizeSavedAyah(doc: SavedAyahDoc) {
    return {
        _id: doc._id.toString(),
        verseKey: doc.verseKey,
        verseText: doc.verseText,
        translation: doc.translation ?? null,
        preferredRecitationId: doc.preferredRecitationId ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

export async function GET() {
    try {
        const db = await getDb();
        const docs = (await db
            .collection("savedAyaat")
            .find()
            .sort({ createdAt: -1 })
            .toArray()) as SavedAyahDoc[];
        return NextResponse.json(docs.map(normalizeSavedAyah));
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
            verseKey?: string;
            verseText?: string;
            translation?: string | null;
            preferredRecitationId?: string | null;
        };

        if (!body.verseKey) {
            return NextResponse.json(
                { error: "verseKey is required" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const now = new Date();
        const existing = (await db.collection("savedAyaat").findOne({
            verseKey: body.verseKey,
        })) as SavedAyahDoc | null;

        if (existing) {
            await db.collection("savedAyaat").updateOne(
                { _id: existing._id },
                {
                    $set: {
                        verseText: body.verseText ?? existing.verseText ?? "",
                        translation: body.translation ?? existing.translation ?? null,
                        preferredRecitationId:
                            body.preferredRecitationId ??
                            existing.preferredRecitationId ??
                            null,
                        updatedAt: now,
                    },
                },
            );
            const updated = (await db.collection("savedAyaat").findOne({
                _id: existing._id,
            })) as SavedAyahDoc | null;
            return NextResponse.json(updated ? normalizeSavedAyah(updated) : null);
        }

        const doc = {
            verseKey: body.verseKey,
            verseText: body.verseText ?? "",
            translation: body.translation ?? null,
            preferredRecitationId: body.preferredRecitationId ?? null,
            createdAt: now,
            updatedAt: now,
        };
        const result = await db.collection("savedAyaat").insertOne(doc);
        return NextResponse.json(
            normalizeSavedAyah({
                _id: result.insertedId,
                ...doc,
            } as SavedAyahDoc),
            { status: 201 },
        );
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = (await req.json()) as {
            id?: string;
            preferredRecitationId?: string | null;
        };
        if (!body.id || !ObjectId.isValid(body.id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const db = await getDb();
        await db.collection("savedAyaat").updateOne(
            { _id: new ObjectId(body.id) },
            {
                $set: {
                    preferredRecitationId: body.preferredRecitationId ?? null,
                    updatedAt: new Date(),
                },
            },
        );
        const updated = (await db.collection("savedAyaat").findOne({
            _id: new ObjectId(body.id),
        })) as SavedAyahDoc | null;
        return NextResponse.json(updated ? normalizeSavedAyah(updated) : null);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const db = await getDb();
        await db.collection("savedAyaat").deleteOne({ _id: new ObjectId(id) });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
