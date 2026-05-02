"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function YoutubeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
    );
}

function InstagramIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
    );
}

interface Account {
    _id: string;
    type: string;
    name: string;
    icon: string;
    connectedAt: string;
}

export function AccountsTab() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const aRes = await fetch("/api/accounts");
            setAccounts(await aRes.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            try {
                const aRes = await fetch("/api/accounts");
                const data = await aRes.json();
                if (!cancelled) {
                    setAccounts(data);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    async function disconnect(id: string) {
        setDisconnectingId(id);
        try {
            await fetch(`/api/accounts/${id}`, { method: "DELETE" });
            await load();
        } finally {
            setDisconnectingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="grid w-full gap-x-5 gap-y-3 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-medium">Accounts</h1>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {accounts.length}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Connected upload destinations for your generated clips.
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button className="flex flex-row items-center gap-1">
                            <Plus className="size-4" />
                            Connect account
                            <ChevronDown className="size-3.5 opacity-70" />
                            </Button>
                        }
                    />
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={() => {
                                window.location.href = "/api/youtube/auth";
                            }}
                            className="gap-2"
                        >
                            <YoutubeIcon className="size-4 text-red-500" />
                            YouTube
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => {
                                window.location.href = "/api/instagram/auth";
                            }}
                            className="gap-2"
                        >
                            <InstagramIcon className="size-4 text-pink-500" />
                            Instagram
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="overflow-x-auto">
                {loading ? (
                    <Table style={{ minWidth: 700 }}>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b">
                                <TableHead>Platform</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead>Connected</TableHead>
                                <TableHead style={{ width: 80 }}>
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 4 }).map((_, index) => (
                                <TableRow key={index} className="border-b">
                                    <TableCell className="py-3">
                                        <Skeleton className="h-4 w-24" />
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="size-6 rounded-full" />
                                            <Skeleton className="h-4 w-40" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Skeleton className="h-4 w-28" />
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Skeleton className="h-8 w-8" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                <Table style={{ minWidth: 700 }}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="text-xs font-semibold text-muted-foreground">
                                Platform
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">
                                Account
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">
                                Connected
                            </TableHead>
                            <TableHead style={{ width: 80 }}>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="text-center text-muted-foreground py-10 text-sm"
                                >
                                    No accounts connected. Click &quot;Connect
                                    account&quot; to get started.
                                </TableCell>
                            </TableRow>
                        )}
                        {accounts.map((a) => {
                            return (
                                <TableRow
                                    key={a._id}
                                    className="border-b hover:bg-transparent"
                                >
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-2">
                                            {a.type === "youtube" && (
                                                <YoutubeIcon className="size-4 text-red-500" />
                                            )}
                                            {a.type === "instagram" && (
                                                <InstagramIcon className="size-4 text-pink-500" />
                                            )}
                                            <span className="capitalize text-sm font-medium">
                                                {a.type}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={a.icon}
                                                alt=""
                                                className="size-6 rounded-full"
                                            />
                                            <span className="text-sm font-medium">
                                                {a.name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3 text-sm text-muted-foreground">
                                        {new Date(
                                            a.connectedAt,
                                        ).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </TableCell>
                                    <TableCell className="py-1 px-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 text-destructive hover:text-destructive"
                                            disabled={disconnectingId === a._id}
                                            onClick={() =>
                                                void disconnect(a._id)
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                )}
            </div>
        </div>
    );
}
