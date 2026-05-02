import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["quran.ibrahim.ba"],
    devIndicators: { position: "top-right" },
    typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
