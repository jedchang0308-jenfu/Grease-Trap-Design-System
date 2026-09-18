import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { reportPdfPlugin } from "./scripts/report-pdf-vite-plugin";

export default defineConfig({
  plugins: [react(), reportPdfPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
