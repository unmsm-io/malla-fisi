import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dir, "..");
const publicDir = path.join(root, "public");
const escudoPath = path.join(publicDir, "escudo-unmsm.png");

const COLORS = {
  bg: "#141817",
  bgElevated: "#1a1f1d",
  bgAcademic: "#1f2a26",
  gold: "#c9a961",
  green: "#5a8a72",
  text: "#f4f1e8",
  muted: "#8a9290",
};

async function loadEscudo(size: number): Promise<Buffer> {
  return await sharp(escudoPath)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function generateMonogramSvg(size: number, padding: number): Promise<string> {
  const fontSize = Math.round(size * 0.5);
  const r = Math.round(size * 0.18);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.bg}"/>
      <stop offset="100%" stop-color="${COLORS.bgAcademic}"/>
    </linearGradient>
  </defs>
  <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}" rx="${r}" fill="url(#bg)" stroke="${COLORS.gold}" stroke-width="${Math.max(1, size / 32)}"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-weight="700" font-size="${fontSize}" fill="${COLORS.gold}"
        letter-spacing="-2">MF</text>
</svg>`;
}

async function generateFavicon() {
  console.log("Generating favicon set...");
  const sizes = [16, 32, 48, 180];

  const buffers = await Promise.all(
    sizes.map(async (size) => {
      const svg = await generateMonogramSvg(size, Math.round(size * 0.06));
      const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
      return { size, buf };
    }),
  );

  for (const { size, buf } of buffers) {
    if (size === 180) {
      await writeFile(path.join(publicDir, "apple-touch-icon.png"), buf);
      console.log(`  -> apple-touch-icon.png (${size}x${size})`);
    } else if (size === 32) {
      await writeFile(path.join(publicDir, "favicon-32x32.png"), buf);
      await writeFile(path.join(publicDir, "icon.png"), buf);
      console.log(`  -> favicon-32x32.png + icon.png (${size}x${size})`);
    } else if (size === 16) {
      await writeFile(path.join(publicDir, "favicon-16x16.png"), buf);
      console.log(`  -> favicon-16x16.png`);
    }
  }

  const ico32 = buffers.find((b) => b.size === 32)!.buf;
  await writeFile(path.join(publicDir, "favicon.ico"), ico32);
  console.log("  -> favicon.ico");
}

async function generateOgImage() {
  console.log("Generating OG image...");
  const W = 1200;
  const H = 630;

  const escudoOriginal = await readFile(escudoPath);
  const escudoBg = await sharp(escudoOriginal)
    .resize(420, 420, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .modulate({ saturation: 0.3, brightness: 1.4 })
    .png()
    .toBuffer();

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.bg}"/>
      <stop offset="50%" stop-color="${COLORS.bgElevated}"/>
      <stop offset="100%" stop-color="${COLORS.bgAcademic}"/>
    </linearGradient>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="${COLORS.green}" stroke-width="0.5" opacity="0.06"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <rect x="0" y="0" width="${W}" height="6" fill="${COLORS.gold}" opacity="0.85"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${COLORS.gold}" opacity="0.85"/>

  <g transform="translate(80, 80)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="20"
          fill="${COLORS.gold}" letter-spacing="6" font-weight="500">
      UNMSM · FACULTAD DE INGENIERIA DE SISTEMAS
    </text>
  </g>

  <g transform="translate(80, 200)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="92"
          fill="${COLORS.text}" font-weight="700" letter-spacing="-3">
      Malla FISI
    </text>
    <text x="0" y="60" font-family="Georgia, serif" font-size="36"
          fill="${COLORS.muted}" font-weight="400" font-style="italic">
      Constructor curricular
    </text>
  </g>

  <g transform="translate(80, 410)">
    <rect x="0" y="0" width="6" height="120" fill="${COLORS.gold}"/>
    <text x="24" y="22" font-family="Georgia, serif" font-size="22"
          fill="${COLORS.text}" font-weight="500">
      Drag-and-drop con validacion de prerrequisitos
    </text>
    <text x="24" y="58" font-family="Georgia, serif" font-size="22"
          fill="${COLORS.text}" font-weight="500">
      Auto-organize y diagnostico inteligente
    </text>
    <text x="24" y="94" font-family="Georgia, serif" font-size="22"
          fill="${COLORS.text}" font-weight="500">
      Exporta a Excel y PDF
    </text>
  </g>

  <text x="${W - 80}" y="${H - 50}" text-anchor="end"
        font-family="ui-monospace, 'SF Mono', monospace" font-size="18"
        fill="${COLORS.muted}" letter-spacing="2">
    malla-fisi.vercel.app
  </text>
</svg>`;

  const baseCanvas = await sharp(Buffer.from(svg)).png().toBuffer();

  const final = await sharp(baseCanvas)
    .composite([
      {
        input: escudoBg,
        top: 130,
        left: W - 420 - 80,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();

  await writeFile(path.join(publicDir, "og.png"), final);
  console.log(`  -> og.png (${W}x${H})`);

  const twitterCanvas = await sharp(final).resize(1200, 600).png().toBuffer();
  await writeFile(path.join(publicDir, "og-twitter.png"), twitterCanvas);
  console.log(`  -> og-twitter.png (1200x600)`);
}

async function main() {
  console.log("Generating brand assets for Malla FISI...\n");
  await generateFavicon();
  console.log();
  await generateOgImage();
  console.log("\nDone. Assets in public/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
