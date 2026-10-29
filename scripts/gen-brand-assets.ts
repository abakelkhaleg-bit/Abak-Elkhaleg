/**
 * توليد أصول العلامة من الشعار والأيقونة الأصليين.
 * - الأصلان في جذر المشروع لا يُعدَّلان ولا يُحذفان؛ تُنسخ نسخة منهما إلى assets/brand/.
 * - المخرجات المولدة: أيقونات App Router، favicon، شعار WebP، صورة بديلة، صورة مشاركة افتراضية.
 * التشغيل: npm run brand:assets
 */
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = process.cwd();
const sources = {
  logo: path.join(root, "logo.png"),
  icon: path.join(root, "icon.png"),
};
const brandArchive = path.join(root, "assets", "brand");
const publicBrand = path.join(root, "public", "brand");
const appDir = path.join(root, "src", "app");

const IVORY = { r: 251, g: 246, b: 236, alpha: 1 };
const CREAM = { r: 243, g: 234, b: 216, alpha: 1 };

async function ensureSourceExists(file: string) {
  try {
    await stat(file);
  } catch {
    throw new Error(`الملف المصدر غير موجود: ${path.relative(root, file)}`);
  }
}

/** يقص الأيقونة إلى دائرة بخلفية شفافة (الأصل له زوايا بيضاء). */
async function circularIcon(size: number): Promise<Buffer> {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  return sharp(sources.icon)
    .resize(size, size, { fit: "cover" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await Promise.all(Object.values(sources).map(ensureSourceExists));
  await mkdir(brandArchive, { recursive: true });
  await mkdir(publicBrand, { recursive: true });

  // 1) أرشفة الأصول الأصلية كما هي
  await copyFile(sources.logo, path.join(brandArchive, "logo-original.png"));
  await copyFile(sources.icon, path.join(brandArchive, "icon-original.png"));

  // 2) الشعار للهيدر والفوتر
  const logoMeta = await sharp(sources.logo).metadata();
  const logoWidth = 960;
  const logoHeight = Math.round(((logoMeta.height ?? 0) / (logoMeta.width ?? 1)) * logoWidth);
  await sharp(sources.logo)
    .resize(logoWidth)
    .webp({ quality: 88 })
    .toFile(path.join(publicBrand, "logo.webp"));

  // 3) أيقونات App Router
  await writeFile(path.join(appDir, "icon.png"), await circularIcon(256));
  const appleIcon = await sharp({
    create: { width: 180, height: 180, channels: 4, background: IVORY },
  })
    .composite([{ input: await circularIcon(164), gravity: "center" }])
    .png()
    .toBuffer();
  await writeFile(path.join(appDir, "apple-icon.png"), appleIcon);
  const icoSizes = await Promise.all([16, 32, 48].map((size) => circularIcon(size)));
  await writeFile(path.join(appDir, "favicon.ico"), await pngToIco(icoSizes));

  // 3.1) شعار دائري شفاف لقسم الـHero في الصفحة الرئيسية
  await sharp(await circularIcon(560))
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(path.join(publicBrand, "emblem.webp"));

  // 4) صورة بديلة للمنتجات بدون صورة (نسبة البطاقة 4:5)
  const watermark = await sharp(await circularIcon(360))
    .ensureAlpha()
    .linear([1, 1, 1, 0.18], [0, 0, 0, 0])
    .png()
    .toBuffer();
  await sharp({ create: { width: 800, height: 1000, channels: 4, background: CREAM } })
    .composite([{ input: watermark, gravity: "center" }])
    .webp({ quality: 80 })
    .toFile(path.join(publicBrand, "placeholder.webp"));

  // 5) صورة المشاركة الافتراضية (Open Graph 1200×630)
  const ogLogo = await sharp(sources.logo).resize(1000).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: IVORY } })
    .composite([{ input: ogLogo, gravity: "center" }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(publicBrand, "og-default.jpg"));

  console.info(
    JSON.stringify(
      {
        logo: { file: "public/brand/logo.webp", width: logoWidth, height: logoHeight },
        generated: [
          "src/app/icon.png",
          "src/app/apple-icon.png",
          "src/app/favicon.ico",
          "public/brand/placeholder.webp",
          "public/brand/og-default.jpg",
        ],
        archived: ["assets/brand/logo-original.png", "assets/brand/icon-original.png"],
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
