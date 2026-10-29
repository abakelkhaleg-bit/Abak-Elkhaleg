/**
 * محمّل صور next/image على مستوى المشروع (next.config → images.loaderFile).
 * - صور Cloudinary: تحويلات من شبكة Cloudinary نفسها (f_auto يختار WebP/AVIF، q_auto، وعرض مناسب).
 * - الصور المحلية (/brand/…): تُقدَّم كما هي؛ هي مولدة ومضغوطة مسبقًا.
 */

type LoaderArgs = { src: string; width: number; quality?: number };

const CLOUDINARY_UPLOAD = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;

export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  if (CLOUDINARY_UPLOAD.test(src)) {
    const transformation = `f_auto,q_${quality ?? "auto"},c_limit,w_${width}`;
    return src.replace("/image/upload/", `/image/upload/${transformation}/`);
  }
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
