"use client";

import * as React from "react";
import {
    LinkIcon,
    FileVideo,
    Video,
    Sliders,
    ImageIcon,
    Settings2,
    PaintBucket,
    Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
    { title: "Clips", icon: FileVideo, view: "clips" },
    { title: "Stills", icon: Camera, view: "stills" },
    { title: "Settings", icon: Settings2, view: "settings" },
    { title: "Videos", icon: Video, view: "videos" },
    { title: "LUTs", icon: PaintBucket, view: "luts" },
    { title: "Overlays", icon: ImageIcon, view: "overlays" },
    { title: "Accounts", icon: LinkIcon, view: "accounts" },
];

interface AppSidebarProps {
    activeView: string;
    onViewChange: (v: string) => void;
}

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
    return (
        <>
            {/* Desktop: left icon rail */}
            <aside className="hidden sm:flex fixed left-0 top-0 h-full w-14 flex-col items-center gap-2 border-r bg-background py-4 z-40">
                {nav.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => onViewChange(item.view)}
                        className={cn(
                            "flex size-10 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            activeView === item.view
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                        )}
                    >
                        <item.icon className="size-5" />
                    </button>
                ))}
            </aside>

            {/* Mobile: bottom tab bar */}
            <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background h-14 px-2">
                {nav.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => onViewChange(item.view)}
                        className={cn(
                            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors outline-none text-[10px] font-medium",
                            activeView === item.view
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <item.icon
                            className={cn(
                                "size-5",
                                activeView === item.view && "text-primary",
                            )}
                        />
                        {item.title}
                    </button>
                ))}
            </nav>
        </>
    );
}
