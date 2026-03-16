import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: false,
  entry: ["src/main.ts", "src/preload.ts"],
  external: ["electron"],
  format: ["cjs"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node20",
});
