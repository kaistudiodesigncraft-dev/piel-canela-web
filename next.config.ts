import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isGitHubPages ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: isGitHubPages,
  images: {
    unoptimized: isGitHubPages,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dlrdlwjighvcyhirwgfu.supabase.co",
        pathname: "/storage/v1/object/public/treatment-media/**",
      },
      {
        protocol: "https",
        hostname: "dlrdlwjighvcyhirwgfu.supabase.co",
        pathname: "/storage/v1/object/public/site-content-media/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
