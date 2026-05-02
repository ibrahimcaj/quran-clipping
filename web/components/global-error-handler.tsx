"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function GlobalErrorHandler() {
    useEffect(() => {
        function onError(e: ErrorEvent) {
            // Ignore ResizeObserver noise which is cosmetic, not actionable
            if (e.message?.includes("ResizeObserver")) return;
            toast.error(e.message || "Unhandled error", {
                description: e.filename ? `${e.filename}:${e.lineno}` : undefined,
            });
        }

        function onUnhandledRejection(e: PromiseRejectionEvent) {
            const message =
                e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Unhandled rejection");
            toast.error(message);
        }

        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onUnhandledRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onUnhandledRejection);
        };
    }, []);

    return null;
}
