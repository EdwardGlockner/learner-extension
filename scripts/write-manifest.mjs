import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const manifestSourcePath = resolve(rootDir, "public", "manifest.json");
const distManifestPath = resolve(rootDir, "dist", "manifest.json");
const target = process.argv[2] ?? "chrome";
const targetBuildDir = resolve(rootDir, "builds", target);

const raw = await readFile(manifestSourcePath, "utf8");
const manifest = JSON.parse(raw);

if (target === "firefox") {
  delete manifest.minimum_chrome_version;
  manifest.background = {
    scripts: ["background.js"],
    type: "module"
  };
} else {
  manifest.background = {
    service_worker: "background.js",
    type: "module"
  };
}

await mkdir(resolve(rootDir, "dist"), { recursive: true });
await writeFile(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await rm(targetBuildDir, { recursive: true, force: true });
await mkdir(resolve(rootDir, "builds"), { recursive: true });
await cp(resolve(rootDir, "dist"), targetBuildDir, { recursive: true });
