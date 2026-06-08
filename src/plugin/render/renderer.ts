import satori from "satori";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KEY_SIZE } from "./theme.js";
import type { RenderNode } from "./keyTrees.js";

export interface LoadedFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal" | "italic";
}

let cachedFonts: LoadedFont[] | null = null;

/**
 * Load fonts from a directory containing Inter-Regular.ttf, Inter-SemiBold.ttf, Inter-Bold.ttf.
 * Called once at plugin startup; cached for subsequent renders.
 */
export async function loadFonts(fontDir: string): Promise<LoadedFont[]> {
  if (cachedFonts) return cachedFonts;
  const [reg, semi, bold] = await Promise.all([
    readFile(join(fontDir, "Inter-Regular.ttf")),
    readFile(join(fontDir, "Inter-SemiBold.ttf")),
    readFile(join(fontDir, "Inter-Bold.ttf")),
  ]);
  cachedFonts = [
    { name: "Inter", data: reg, weight: 400, style: "normal" },
    { name: "Inter", data: semi, weight: 600, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
  ];
  return cachedFonts;
}

/** For tests — replace the cached fonts with an injected set. */
export function setFontsForTesting(fonts: LoadedFont[] | null): void {
  cachedFonts = fonts;
}

/**
 * Rasterize a key-tree to a PNG buffer at the Stream Deck retina size (144×144).
 * Requires fonts to have been loaded via `loadFonts` first.
 */
export async function renderToPng(tree: RenderNode): Promise<Buffer> {
  if (!cachedFonts) {
    throw new Error("renderToPng called before loadFonts");
  }
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: KEY_SIZE,
    height: KEY_SIZE,
    fonts: cachedFonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}
