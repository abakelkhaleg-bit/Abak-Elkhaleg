"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { siteConfig } from "@/config/site";

/**
 * next/image مع صورة بديلة: إن فشل تحميل الصورة (حُذفت من Cloudinary أو انقطع الاتصال)
 * تُعرض صورة المتجر البديلة بدل أيقونة صورة مكسورة.
 */
export function FallbackImage({ src, alt, ...props }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  const broken = failedSrc !== null && failedSrc === src;
  return (
    <Image
      {...props}
      src={broken ? siteConfig.brandAssets.placeholder : src}
      alt={alt}
      onError={() => {
        if (src !== siteConfig.brandAssets.placeholder) setFailedSrc(src);
      }}
    />
  );
}
