import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const scriptPolicy = process.env.NODE_ENV === "production" ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: https://profile.line-scdn.net https://sprofile.line-scdn.net; media-src 'self'; style-src 'self' 'unsafe-inline'; ${scriptPolicy}; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ] }];
  },
};

export default nextConfig;
