import { defineConfig } from "tsup";

export default defineConfig({
  entry: { plugin: "src/plugin/index.ts" },
  outDir: "com.vladoportos.aimonitor.sdPlugin/bin",
  // CommonJS so that the `ws` library's dynamic `require('events')` etc. work.
  // The .sdPlugin folder ships a package.json declaring "type": "commonjs".
  format: ["cjs"],
  target: "node20",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  shims: false,
  noExternal: [/.*/],
  external: ["sharp"],
  outExtension() {
    return { js: ".js" };
  },
});
