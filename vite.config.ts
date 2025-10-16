import terser from "@rollup/plugin-terser";
import { defineConfig } from "vite";

/* -------------------------------------------------------------------------- */
/*     Настройка vite для сборки библиотеки loader-sfc.esm-browser.prod.js    */
/* -------------------------------------------------------------------------- */

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/loader-sfc.ts",
      fileName: "loader-sfc.esm-browser.prod",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["vue"],
      plugins: [terser()],
    },
  },
});
