import { defineConfig, mergeConfig } from "vite";
import terser from "@rollup/plugin-terser";
import config from "@vuebro/configs/vite";

export default mergeConfig(
  config,
  defineConfig({
    build: {
      lib: {
        fileName: "loader-sfc.esm-browser.prod",
        entry: "src/loader-sfc.ts",
        formats: ["es"],
      },
      rollupOptions: {
        plugins: [terser()],
        external: ["vue"],
      },
      emptyOutDir: false,
    },
  }),
);
