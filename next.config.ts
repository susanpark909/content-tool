import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/library", destination: "/reels", permanent: false }];
  },
};

export default nextConfig;
