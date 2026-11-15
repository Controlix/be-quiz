import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["tinyx.local", "*.local", "localhost", "192.168.0.248"],
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingExcludes: {
    "*": [
      // Build and bundler artifacts
      "node_modules/@swc/core/**",
      "node_modules/@esbuild/**",
      "node_modules/webpack/**",
      "node_modules/terser/**",
      // Unused Prisma WASM query engines and compilers across all targets
      "node_modules/@prisma/client/runtime/*wasm-base64*",
      "node_modules/@prisma/client/runtime/*.wasm",
      "node_modules/.prisma/client/*.wasm",
      // On Vercel, exclude Alpine/musl binary target (Amazon Linux uses glibc debian-openssl-3.0.x)
      ...(isVercel ? ["node_modules/.prisma/client/libquery_engine-linux-musl*"] : []),
    ],
  },
};

export default nextConfig;
