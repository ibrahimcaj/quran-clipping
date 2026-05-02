const OAUTH_BASE = {
    prelive: "https://prelive-oauth2.quran.foundation",
    production: "https://oauth2.quran.foundation",
} as const;

const API_BASE = {
    prelive: "https://apis-prelive.quran.foundation",
    production: "https://apis.quran.foundation",
} as const;

type Env = keyof typeof OAUTH_BASE;

interface TokenCache {
    token: string;
    expiresAt: number;
}

declare global {
    var __qfTokenCache: TokenCache | null | undefined;
    var __qfTokenInflight: Promise<string> | null | undefined;
}

global.__qfTokenCache ??= null;
global.__qfTokenInflight ??= null;

const REFRESH_BUFFER_MS = 30_000;

function qfEnv(): Env {
    const e = process.env.QF_ENV ?? "prelive";
    return e === "production" ? "production" : "prelive";
}

async function fetchNewToken(): Promise<string> {
    const env = qfEnv();
    const clientId = process.env.QF_CLIENT_ID;
    const clientSecret = process.env.QF_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("QF_CLIENT_ID and QF_CLIENT_SECRET must be set");
    }

    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch(`${OAUTH_BASE[env]}/oauth2/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${creds}`,
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "content",
        }),
    });

    if (!res.ok) {
        throw new Error(`QF token request failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    global.__qfTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
}

export async function getToken(): Promise<string> {
    const cached = global.__qfTokenCache;
    if (cached && Date.now() < cached.expiresAt - REFRESH_BUFFER_MS) {
        return cached.token;
    }

    // Single in-flight promise prevents stampede under concurrent requests
    if (!global.__qfTokenInflight) {
        global.__qfTokenInflight = fetchNewToken().finally(() => {
            global.__qfTokenInflight = null;
        });
    }
    return global.__qfTokenInflight;
}

export function getApiBase(): string {
    return API_BASE[qfEnv()];
}

export function getClientId(): string {
    return process.env.QF_CLIENT_ID ?? "";
}

export function clearTokenCache(): void {
    global.__qfTokenCache = null;
}
