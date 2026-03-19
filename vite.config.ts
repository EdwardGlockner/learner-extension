import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    target: "es2022",
    rollupOptions: {
      input: {
        about: new URL("./about.html", import.meta.url).pathname,
        dashboard: new URL("./dashboard.html", import.meta.url).pathname,
        manage: new URL("./manage.html", import.meta.url).pathname,
        history: new URL("./history.html", import.meta.url).pathname,
        options: new URL("./options.html", import.meta.url).pathname,
        background: new URL("./src/background/index.ts", import.meta.url).pathname
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") {
            return "background.js";
          }

          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
