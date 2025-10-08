import terser from "@rollup/plugin-terser";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/loader-sfc.ts"),
      fileName: "loader-sfc.esm-browser.prod",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["vue"],
      plugins: [terser({ format: { comments: false }, mangle: true })],
    },
  },
});
