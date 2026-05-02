"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Recitation {
    id: number;
    reciter_name: string;
    style: string | null;
}

export function RecitersTab() {
    const [recitations, setRecitations] = useState<Recitation[]>([]);
    const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const [recRes, cfgRes] = await Promise.all([
                    fetch("/api/qf/reciters"),
                    fetch("/api/configuration/reciters"),
                ]);
                const recData = JSON.parse(await recRes.text());
                const cfgData = JSON.parse(await cfgRes.text());

                if (recData.error) throw new Error(recData.error);
                if (cfgData.error) throw new Error(cfgData.error);

                setRecitations(
                    [...(recData.recitations as Recitation[])].sort((a, b) =>
                        a.reciter_name.localeCompare(b.reciter_name),
                    ),
                );
                const availableReciters = [...(recData.recitations as Recitation[])].sort((a, b) =>
                    a.reciter_name.localeCompare(b.reciter_name),
                );
                const nextEnabledIds = new Set<number>(cfgData.enabledIds ?? []);

                if (availableReciters.length > 0 && nextEnabledIds.size === 0) {
                    nextEnabledIds.add(availableReciters[0].id);
                    void save(nextEnabledIds);
                }

                setEnabledIds(nextEnabledIds);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function save(next: Set<number>) {
        setSaving(true);
        try {
            const res = await fetch("/api/configuration/reciters", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledIds: [...next] }),
            });
            const data = JSON.parse(await res.text());
            if (!res.ok) {
                throw new Error(data.error ?? "Failed to save reciter settings");
            }
        } finally {
            setSaving(false);
        }
    }

    function toggle(id: number) {
        const isOn = enabledIds.has(id);
        if (isOn && enabledIds.size === 1) {
            toast.error("At least one reciter must be enabled.");
            return;
        }
        const next = new Set(enabledIds);
        if (isOn) next.delete(id);
        else next.add(id);
        setEnabledIds(next);
        save(next);
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-[1fr_auto] gap-x-5 w-full">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-medium">Reciters</h1>
                    <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground text-xs font-medium">
                        {recitations.length}
                    </span>
                </div>
                <div className="flex items-center justify-end pt-1">
                    {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
                </div>
                <p className="text-sm text-muted-foreground col-span-2 mt-1">
                    Choose which reciters are available for playback. At least one must remain enabled.
                    {recitations.length > 0 && <> {enabledIds.size} of {recitations.length} enabled.</>}
                </p>
            </div>

            <div className="overflow-x-auto">
                <Table style={{ minWidth: 360 }}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="text-xs font-semibold text-muted-foreground">Reciter</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Style</TableHead>
                            <TableHead style={{ width: 60 }} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 8 }).map((_, i) => (
                            <TableRow key={i} className="border-b hover:bg-transparent">
                                <TableCell className="py-2">
                                    <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                                </TableCell>
                                <TableCell className="py-2">
                                    <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                                </TableCell>
                                <TableCell className="py-2" />
                            </TableRow>
                        ))}
                        {!loading && recitations.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-10 text-sm">
                                    No reciters found.
                                </TableCell>
                            </TableRow>
                        )}
                        {recitations.map((r) => {
                            const on = enabledIds.has(r.id);
                            return (
                                <TableRow
                                    key={r.id}
                                    className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => toggle(r.id)}
                                >
                                    <TableCell className="py-2">
                                        <p className="font-medium text-sm">{r.reciter_name}</p>
                                    </TableCell>
                                    <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                                        {r.style ?? <span className="text-muted-foreground/40">—</span>}
                                    </TableCell>
                                    <TableCell className="py-2 pr-4">
                                        <div
                                            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-auto ${
                                                on ? "bg-primary" : "bg-muted-foreground/30"
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                                                    on ? "translate-x-5" : "translate-x-0"
                                                }`}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
