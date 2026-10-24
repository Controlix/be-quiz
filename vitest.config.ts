import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://quiz:quiz@localhost:5432/be_quiz?schema=test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
