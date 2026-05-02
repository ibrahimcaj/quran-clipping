import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    allowedDevOrigins: [
        "admins-macbook-air-1.tail9ba3a.ts.net",
        "ibrahim-1.tail9ba3a.ts.net",
        "clips.ibrahim.ba",
    ],
    devIndicators: { position: "top-right" },
    typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
