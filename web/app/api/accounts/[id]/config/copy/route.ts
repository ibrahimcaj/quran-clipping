export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getMergedAccountConfig } from "@/lib/account-config";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const { sourceAccountId } = (await req.json()) as {
            sourceAccountId?: string;
        };

        if (!ObjectId.isValid(id) || !sourceAccountId || !ObjectId.isValid(sourceAccountId)) {
            return NextResponse.json(
                { error: "Invalid account id" },
                { status: 400 },
            );
        }
        if (id === sourceAccountId) {
            return NextResponse.json(
                { error: "Choose a different source account" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const [targetAccount, sourceAccount] = await Promise.all([
            db.collection("accounts").findOne({ _id: new ObjectId(id) }),
            db.collection("accounts").findOne({ _id: new ObjectId(sourceAccountId) }),
        ]);
        if (!targetAccount || !sourceAccount) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const sourceConfig = await getMergedAccountConfig(db, sourceAccountId);
        await db.collection("accountConfigurations").updateOne(
            { accountId: new ObjectId(id) },
            {
                $set: {
                    accountId: new ObjectId(id),
                    ...sourceConfig,
                    overlayId: sourceConfig.overlayId
                        ? new ObjectId(sourceConfig.overlayId)
                        : null,
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
