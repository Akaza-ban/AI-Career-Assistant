import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both runtimes consume the same server-owned assistant registry files.
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
