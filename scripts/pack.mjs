// Package the plugin into a distributable .streamDeckPlugin zip.
// Steps:
//   1. Ensure tsup build is up to date.
//   2. Copy Sharp + its native bindings into the .sdPlugin folder (sharp can't be bundled).
//   3. Zip the .sdPlugin folder as <UUID>.streamDeckPlugin.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SD_DIR = join(ROOT, "com.vladoportos.aimonitor.sdPlugin");
const NODE_MODULES = join(SD_DIR, "node_modules");

function step(msg) {
  console.log(`\n[pack] ${msg}`);
}

step("Building TypeScript bundle...");
execSync("npx tsup", { cwd: ROOT, stdio: "inherit" });

step("Cleaning plugin's node_modules folder...");
rmSync(NODE_MODULES, { recursive: true, force: true });
mkdirSync(NODE_MODULES, { recursive: true });

step("Copying Sharp + native deps into plugin folder...");
const sharpRoot = join(ROOT, "node_modules", "sharp");
const imgRoot = join(ROOT, "node_modules", "@img");
const colorRoots = ["color", "color-convert", "color-name", "color-string",
                    "is-arrayish", "simple-swizzle", "detect-libc", "semver"];

if (existsSync(sharpRoot)) {
  cpSync(sharpRoot, join(NODE_MODULES, "sharp"), { recursive: true });
}
if (existsSync(imgRoot)) {
  cpSync(imgRoot, join(NODE_MODULES, "@img"), { recursive: true });
}
for (const dep of colorRoots) {
  const src = join(ROOT, "node_modules", dep);
  if (existsSync(src)) cpSync(src, join(NODE_MODULES, dep), { recursive: true });
}

step("Verifying plugin folder layout...");
const required = [
  "manifest.json",
  "bin/plugin.js",
  "fonts/Inter-Regular.ttf",
  "imgs/plugin/marketplace.svg",
  "ui/sdpi.js",
];
const missing = required.filter((r) => !existsSync(join(SD_DIR, r)));
if (missing.length > 0) {
  console.error(`[pack] missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

step("Creating .streamDeckPlugin zip...");
// Use a tiny pure-Node zip writer — adm-zip would be a dep we don't want.
// Use built-in approach: spawn `zip` if available, else fall back to manual using node:fs+stream + a tiny zip.
// Since we don't want extra deps, write a simple zip with node-only code:
try {
  await createZip(SD_DIR, join(ROOT, "com.vladoportos.aimonitor.streamDeckPlugin"));
  console.log(`[pack] done → ${join(ROOT, "com.vladoportos.aimonitor.streamDeckPlugin")}`);
} catch (e) {
  console.error(`[pack] zip failed: ${e.message}`);
  console.error("[pack] (the .sdPlugin folder is still ready — install it directly via the Stream Deck app)");
  process.exit(1);
}

// ----- minimal zip writer (store, no compression) -----
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d) {
  return ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
}
function dosDate(d) {
  return (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function createZip(srcDir, outPath) {
  const files = walk(srcDir);
  // Zip path entries should be prefixed with the sdPlugin folder name (Stream Deck expects this).
  const prefix = "com.vladoportos.aimonitor.sdPlugin/";
  const central = [];
  let offset = 0;
  const stream = createWriteStream(outPath);

  const write = (chunk) => new Promise((res, rej) => stream.write(chunk, (e) => e ? rej(e) : res()));

  for (const f of files) {
    const rel = (prefix + relative(srcDir, f).replaceAll("\\", "/"));
    const data = readFileSync(f);
    const crc = crc32(data);
    const size = data.length;
    const d = statSync(f).mtime;
    const time = dosTime(d), date = dosDate(d);
    const nameBuf = Buffer.from(rel, "utf8");

    // Local file header
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);   // version needed
    lfh.writeUInt16LE(0, 6);    // flags
    lfh.writeUInt16LE(0, 8);    // method: 0 = store
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);   // extra length
    await write(lfh);
    await write(nameBuf);
    await write(data);

    // Central dir record
    const cdr = Buffer.alloc(46);
    cdr.writeUInt32LE(0x02014b50, 0);
    cdr.writeUInt16LE(20, 4);   // version made by
    cdr.writeUInt16LE(20, 6);   // version needed
    cdr.writeUInt16LE(0, 8);
    cdr.writeUInt16LE(0, 10);
    cdr.writeUInt16LE(time, 12);
    cdr.writeUInt16LE(date, 14);
    cdr.writeUInt32LE(crc, 16);
    cdr.writeUInt32LE(size, 20);
    cdr.writeUInt32LE(size, 24);
    cdr.writeUInt16LE(nameBuf.length, 28);
    cdr.writeUInt16LE(0, 30);
    cdr.writeUInt16LE(0, 32);
    cdr.writeUInt16LE(0, 34);
    cdr.writeUInt16LE(0, 36);
    cdr.writeUInt32LE(0, 38);
    cdr.writeUInt32LE(offset, 42);
    central.push({ header: cdr, name: nameBuf });
    offset += lfh.length + nameBuf.length + size;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    await write(c.header);
    await write(c.name);
    cdSize += c.header.length + c.name.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  await write(eocd);
  await new Promise((res) => stream.end(res));
}
