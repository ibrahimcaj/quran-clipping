"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AccountsTab } from "@/components/accounts-tab";
import { LutsTab } from "@/components/luts-tab";
import { OverlaysTab } from "@/components/overlays-tab";
import { ClipsTab } from "@/components/clips-tab";
import { SettingsTab } from "@/components/settings-tab";
import { StillImagesTab } from "@/components/still-images-tab";
import { VideosTab } from "@/components/videos-tab";

export default function Home() {
    const [view, setView] = useState("clips");

    return (
        <div className="flex min-h-screen">
            <AppSidebar activeView={view} onViewChange={setView} />
            <main className="flex-1 min-w-0 sm:pl-14 pb-14 sm:pb-0 overflow-y-auto">
                <div className="p-4 lg:p-6 flex flex-col gap-4">
                    {view === "clips" && <ClipsTab />}
                    {view === "stills" && <StillImagesTab />}
                    {view === "settings" && <SettingsTab />}
                    {view === "videos" && <VideosTab />}
                    {view === "luts" && <LutsTab />}
                    {view === "overlays" && <OverlaysTab />}
                    {view === "accounts" && <AccountsTab />}
                </div>
            </main>
        </div>
    );
}
