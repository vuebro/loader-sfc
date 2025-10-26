import terser from "@rollup/plugin-terser";
import config from "@vuebro/configs/vite";
import { defineConfig, mergeConfig } from "vite";

export default mergeConfig(
  config,
  defineConfig({
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
  }),
);
