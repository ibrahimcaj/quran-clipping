export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:     "Pending",
    queued:      "Queued",
    running:     "Running",
    ready:       "Ready",
    downloading: "Downloading",
    processing:  "Processing",
    cropping:    "Cropping",
    vertical:    "Vertical",
    done:        "Done",
    completed:   "Completed",
    cancelled:   "Cancelled",
    uploading:   "Uploading",
    uploaded:    "Uploaded",
    failed:      "Failed",
    error:       "Error",
    manual_upload: "Manual Upload",
  };
  return map[status] ?? status;
}

export function statusDot(status: string): string {
  const map: Record<string, string> = {
    pending:     "bg-slate-400",
    queued:      "bg-orange-400",
    running:     "bg-blue-400",
    ready:       "bg-green-400",
    downloading: "bg-blue-400",
    processing:  "bg-purple-400",
    cropping:    "bg-yellow-400",
    vertical:    "bg-cyan-400",
    done:        "bg-green-400",
    completed:   "bg-green-400",
    cancelled:   "bg-zinc-400",
    uploading:   "bg-sky-300",
    uploaded:    "bg-blue-300",
    failed:      "bg-red-400",
    error:       "bg-red-400",
    manual_upload: "bg-amber-400",
  };
  return map[status] ?? "bg-muted-foreground";
}

export function statusCardColor(status: string): string {
  const map: Record<string, string> = {
    pending:     "border-slate-500/30 bg-slate-500/5",
    queued:      "border-orange-500/30 bg-orange-500/5",
    running:     "border-blue-500/30 bg-blue-500/5",
    ready:       "border-green-500/30 bg-green-500/5",
    downloading: "border-blue-500/30 bg-blue-500/5",
    processing:  "border-purple-500/30 bg-purple-500/5",
    cropping:    "border-yellow-500/30 bg-yellow-500/5",
    vertical:    "border-cyan-500/30 bg-cyan-500/5",
    done:        "border-green-500/30 bg-green-500/5",
    completed:   "border-green-500/30 bg-green-500/5",
    cancelled:   "border-zinc-500/30 bg-zinc-500/5",
    uploading:   "border-sky-500/30 bg-sky-500/5",
    uploaded:    "border-blue-600/30 bg-blue-600/5",
    failed:      "border-red-500/30 bg-red-500/5",
    error:       "border-red-500/30 bg-red-500/5",
    manual_upload: "border-amber-500/30 bg-amber-500/5",
  };
  return map[status] ?? "border-border bg-card";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:     "bg-slate-500/20 text-slate-400 border-slate-500/30",
    queued:      "bg-orange-500/20 text-orange-400 border-orange-500/30",
    running:     "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ready:       "bg-green-500/20 text-green-400 border-green-500/30",
    downloading: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    processing:  "bg-purple-500/20 text-purple-400 border-purple-500/30",
    cropping:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    vertical:    "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    done:        "bg-green-500/20 text-green-400 border-green-500/30",
    completed:   "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled:   "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    uploading:   "bg-sky-500/20 text-sky-300 border-sky-500/30",
    uploaded:    "bg-blue-600/20 text-blue-300 border-blue-600/30",
    failed:      "bg-red-500/20 text-red-400 border-red-500/30",
    error:       "bg-red-500/20 text-red-400 border-red-500/30",
    manual_upload: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}
