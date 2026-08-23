import type { NextConfig } from "next";
import { resolveReleaseEnvironment } from "./scripts/release-environment.mjs";

resolveReleaseEnvironment();

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://dlrdlwjighvcyhirwgfu.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://dlrdlwjighvcyhirwgfu.supabase.co wss://dlrdlwjighvcyhirwgfu.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "9mb",
    },
  },
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
  headers: isGitHubPages
    ? undefined
    : async () => [
        {
          source: "/(.*)",
          headers: securityHeaders,
        },
      ],
};

export default nextConfig;
