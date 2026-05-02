import { getDb } from "./mongodb";

const CONCURRENCY = 3;

declare global {
    var __workerRunning: boolean | undefined;
    var __runningJobs: Map<string, AbortController> | undefined;
}

global.__runningJobs ??= new Map();
global.__workerRunning ??= false;

export function cancelJob(jobId: string) {
    const ac = global.__runningJobs!.get(jobId);
    if (ac) {
        ac.abort();
        global.__runningJobs!.delete(jobId);
    }
}

export function isJobRunning(jobId: string): boolean {
    return global.__runningJobs!.has(jobId);
}

async function tick() {
    const jobs = global.__runningJobs!;
    if (jobs.size >= CONCURRENCY) return;

    try {
        const db = await getDb();
        const slots = CONCURRENCY - jobs.size;
        const runningIds = [...jobs.keys()];

        // Query your collection for queued jobs, then for each:
        //   const ac = new AbortController();
        //   jobs.set(job.id, ac);
        //   runJob(db, job, ac.signal)
        //       .catch(() => {})
        //       .finally(() => jobs.delete(job.id));
        void db; void slots; void runningIds;
    } catch {
        // DB not ready yet
    }
}

export function startWorker() {
    if (global.__workerRunning) return;
    global.__workerRunning = true;

    setInterval(tick, 3000);
    tick();
    console.log("[worker] Queue worker started (concurrency=3)");
}
