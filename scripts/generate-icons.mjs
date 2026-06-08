// Generate placeholder action SVGs in the plugin's imgs/actions folder.
// Each is a simple dark square with a Claude-orange glyph.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "com.vladoportos.aimonitor.sdPlugin", "imgs", "actions");
mkdirSync(outDir, { recursive: true });

const ACCENT = "#cc785c";
const BG = "#0f0f0f";
const TEXT = "#f5f5f4";

const svg = (glyph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">
  <rect width="144" height="144" rx="20" fill="${BG}"/>
  ${glyph}
</svg>
`;

const ICONS = {
  // Usage bucket: a gauge arc
  usage: svg(`
    <path d="M 36 96 A 36 36 0 1 1 108 96" stroke="${ACCENT}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="72" cy="96" r="4" fill="${ACCENT}"/>
    <line x1="72" y1="96" x2="98" y2="76" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round"/>
  `),
  // Headline: a star/asterisk
  headline: svg(`
    <text x="72" y="92" font-family="Arial,sans-serif" font-size="64" fill="${ACCENT}" text-anchor="middle" font-weight="700">!</text>
    <circle cx="72" cy="118" r="4" fill="${ACCENT}"/>
  `),
  // Extra (€/$ symbol)
  extra: svg(`
    <text x="72" y="100" font-family="Arial,sans-serif" font-size="72" fill="${ACCENT}" text-anchor="middle" font-weight="700">€</text>
  `),
  // Status (dot)
  status: svg(`
    <circle cx="72" cy="72" r="20" fill="${ACCENT}"/>
    <circle cx="72" cy="72" r="34" fill="none" stroke="${ACCENT}" stroke-width="3" opacity="0.4"/>
  `),
  // Refresh (↻ glyph)
  refresh: svg(`
    <text x="72" y="100" font-family="Arial,sans-serif" font-size="80" fill="${TEXT}" text-anchor="middle">↻</text>
  `),
  // Open in browser (arrow-out-of-box)
  open: svg(`
    <path d="M 44 60 v 40 h 56 v -40" stroke="${ACCENT}" stroke-width="4" fill="none" stroke-linejoin="round"/>
    <path d="M 72 30 v 40 M 56 46 L 72 30 L 88 46" stroke="${ACCENT}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `),
};

for (const [name, body] of Object.entries(ICONS)) {
  const file = join(outDir, `${name}.svg`);
  writeFileSync(file, body, "utf8");
  console.log(`wrote ${file}`);
}
