"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { RefreshCw, ExternalLink, Eye, ThumbsUp, MessageSquare, Clock, Heart, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account {
  _id: string;
  type: "youtube" | "instagram";
  channelId?: string;
  igUserId?: string;
  name: string;
  icon: string;
}

interface TimeseriesPoint {
  date: string;
  views: number;
  likes: number;
  watchMinutes: number;
}

interface TopClip {
  clipId: string;
  title: string;
  thumbnailUrl: string;
  postUrl: string;
  views: number;
  likes: number;
  comments: number;
  watchMinutes: number;
  impressions: number;
  reach: number;
  saved: number;
  platform: string;
}

interface AnalyticsData {
  platform: string;
  timeseries: TimeseriesPoint[];
  topClips: TopClip[];
  totals: { views: number; likes: number; comments: number; watchMinutes: number };
}

const DAYS_OPTIONS = [7, 14, 30, 90];

const areaConfig: ChartConfig = {
  views:        { label: "Views",      color: "hsl(var(--chart-1))" },
  likes:        { label: "Likes",      color: "hsl(var(--chart-2))" },
  watchMinutes: { label: "Watch min",  color: "hsl(var(--chart-3))" },
};

const barConfig: ChartConfig = {
  views: { label: "Views", color: "hsl(var(--chart-1))" },
};

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />{label}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AnalyticsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    fetch("/api/accounts")
      .then(r => r.json())
      .then((accs: Account[]) => {
        const relevant = accs.filter(a => a.type === "youtube" || a.type === "instagram");
        setAccounts(relevant);
        if (relevant.length > 0 && !activeId) {
          const first = relevant[0];
          setActiveId(first.type === "youtube" ? first.channelId! : first.igUserId!);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAccount = accounts.find(a =>
    (a.type === "youtube" && a.channelId === activeId) ||
    (a.type === "instagram" && a.igUserId === activeId)
  );

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?accountId=${activeId}&days=${days}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeId, days]);

  useEffect(() => { load(); }, [load]);

  async function sync() {
    if (!activeId || !activeAccount) return;
    setSyncing(true);
    setSyncError("");
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: activeId,
          platform: activeAccount.type,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSyncError(body.error ?? `HTTP ${res.status}`);
      } else {
        load();
      }
    } catch (e: any) {
      setSyncError(e.message ?? "Network error");
    } finally {
      setSyncing(false);
    }
  }

  const isYT = data?.platform === "youtube";
  const isIG = data?.platform === "instagram";
  const ts = data?.timeseries ?? [];
  const topClips = data?.topClips ?? [];
  const totals = data?.totals ?? { views: 0, likes: 0, comments: 0, watchMinutes: 0 };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium">Analytics</h1>
        <p className="text-sm text-muted-foreground">Performance across your uploaded shorts and reels.</p>
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {accounts.map(a => {
              const id = a.type === "youtube" ? a.channelId! : a.igUserId!;
              return (
                <button
                  key={id}
                  onClick={() => setActiveId(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                    activeId === id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.icon && <img src={a.icon} alt="" className="size-4 rounded-full" />}
                  <span>{a.name}</span>
                  <span className="opacity-60 capitalize">{a.type === "instagram" ? "· IG" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isYT && (
            <div className="flex rounded-lg border overflow-hidden">
              {DAYS_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={sync} disabled={syncing}>
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
              Sync now
            </Button>
            {syncError && <p className="text-xs text-destructive max-w-xs text-right">{syncError}</p>}
          </div>
        </div>
      </div>

      {!activeId ? (
        <p className="text-sm text-muted-foreground">No accounts connected. Go to Accounts to connect one.</p>
      ) : loading && !data ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading analytics…</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {isYT ? (
              <>
                <StatCard icon={Eye}           label="Views"      value={fmt(totals.views)} />
                <StatCard icon={ThumbsUp}      label="Likes"      value={fmt(totals.likes)} />
                <StatCard icon={MessageSquare} label="Comments"   value={fmt(totals.comments)} />
                <StatCard icon={Clock}         label="Watch time" value={`${fmt(totals.watchMinutes)} min`} />
              </>
            ) : (
              <>
                <StatCard icon={Eye}           label="Impressions" value={fmt(totals.views)} />
                <StatCard icon={Heart}         label="Likes"       value={fmt(totals.likes)} />
                <StatCard icon={MessageSquare} label="Comments"    value={fmt(totals.comments)} />
                <StatCard icon={Bookmark}      label="Saves"       value={fmt(totals.watchMinutes)} />
              </>
            )}
          </div>

          {/* Views over time (YouTube only) */}
          {isYT && ts.length > 0 && (
            <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <p className="text-sm font-medium">Views over time</p>
              <ChartContainer config={areaConfig} className="h-48 w-full">
                <AreaChart data={ts} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="views" stroke="hsl(var(--chart-1))" fill="url(#gViews)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            </div>
          )}

          {/* Top clips bar chart */}
          {topClips.length > 0 && (
            <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <p className="text-sm font-medium">Top clips by {isIG ? "engagement" : "views"}</p>
              <ChartContainer config={barConfig} className="h-48 w-full">
                <BarChart
                  layout="vertical"
                  data={topClips.slice(0, 10).map(c => ({
                    name: c.title.slice(0, 40),
                    views: isIG ? c.likes + c.comments : c.views,
                  }))}
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="views" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {/* Clips table */}
          {topClips.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead style={{ width: 88 }} />
                    <TableHead className="text-xs font-semibold text-muted-foreground">Clip</TableHead>
                    {isYT ? (
                      <>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Views</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Likes</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Comments</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Watch time</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Impressions</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Reach</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Likes</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Comments</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Saves</TableHead>
                      </>
                    )}
                    <TableHead style={{ width: 40 }} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClips.map(clip => (
                    <TableRow key={clip.clipId} className="border-b hover:bg-muted/30">
                      <TableCell className="py-2 pr-0 w-[88px] min-w-[88px]">
                        {clip.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={clip.thumbnailUrl} alt="" className="w-[88px] aspect-video object-cover rounded" />
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <p className="text-sm font-medium line-clamp-2 max-w-xs">{clip.title}</p>
                      </TableCell>
                      {isYT ? (
                        <>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.views)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.likes)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.comments)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.watchMinutes)} min</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.impressions)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.reach)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.likes)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.comments)}</TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">{fmt(clip.saved)}</TableCell>
                        </>
                      )}
                      <TableCell className="py-2">
                        {clip.postUrl && (
                          <a href={clip.postUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="size-7">
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {topClips.length === 0 && !loading && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No analytics data yet. Click &quot;Sync now&quot; to fetch from {isIG ? "Instagram" : "YouTube Analytics"}.
              {isIG && (
                <span className="block text-xs mt-1 opacity-60">
                  Note: impressions &amp; reach require the instagram_business_manage_insights permission.
                </span>
              )}
              {!isIG && (
                <span className="block text-xs mt-1 opacity-60">Note: data has a 2–3 day delay on YouTube&apos;s end.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
