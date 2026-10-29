"use client";

import { useState } from "react";
import { FallbackImage } from "@/components/store/fallback-image";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import type { ImageView } from "@/types/catalog";

const arabicNumber = new Intl.NumberFormat("ar-EG");

export function ProductGallery({ images, productName }: { images: ImageView[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const list = images.length > 0 ? images : [{ src: siteConfig.brandAssets.placeholder, alt: productName }];
  const active = list[Math.min(activeIndex, list.length - 1)] ?? list[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-cream ring-1 ring-sand/60 sm:aspect-[4/5]">
        <FallbackImage
          src={active.src}
          alt={active.alt}
          fill
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
          className="object-cover"
        />
      </div>
      {list.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="صور العطر">
          {list.map((image, index) => (
            <li key={`${image.src}-${index}`}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`عرض الصورة ${arabicNumber.format(index + 1)}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={cn(
                  "relative block size-20 overflow-hidden rounded-md ring-2 transition",
                  index === activeIndex ? "ring-gold" : "ring-transparent hover:ring-sand",
                )}
              >
                <FallbackImage src={image.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
