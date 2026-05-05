import esbuild from "esbuild";

const isProd = process.argv.includes("production");

const banner = {
  js: "/* Obsync plugin */"
};

esbuild
  .build({
    banner,
    entryPoints: ["main.ts"],
    bundle: true,
    minify: isProd,
    sourcemap: !isProd,
    target: "es2020",
    format: "cjs",
    outfile: "dist/main.js",
    external: ["obsidian"],
    logLevel: "info"
  })
  .catch(() => process.exit(1));
