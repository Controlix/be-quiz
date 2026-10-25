import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["tinyx.local", "*.local", "localhost", "192.168.0.248"],
};

export default nextConfig;
