import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker deployment
  output: "standalone",
  allowedDevOrigins: ["192.168.0.248", "192.168.*", "localhost", "127.0.0.1"],
};

export default nextConfig;
