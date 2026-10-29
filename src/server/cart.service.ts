import "server-only";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { multiplyPiasters } from "@/lib/money";
import { LIMITS } from "@/lib/validation-rules";
import { ProductModel } from "@/models/product";
import { trusted } from "@/models/_mongoose";
import { objectIdSchema } from "@/schemas/common";
import { primaryImage, type LeanProduct } from "@/server/catalog.service";
import type { CartLine, CartRemoval, CartReview } from "@/types/catalog";

/**
 * مراجعة السلة على الخادم: السلة في المتصفح تحمل معرّفات وكميات فقط، وهي غير موثوقة.
 * هنا نعيد قراءة الأسعار والتوفر من قاعدة البيانات ونحسب الإجمالي.
 * هذه الدالة للقراءة فقط — لا تخصم ولا تحجز أي مخزون (S5).
 */

const rawCartItemSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema,
  quantity: z.number().int().min(1).max(1_000),
});

export async function reviewCart(rawItems: unknown): Promise<CartReview> {
  const list = Array.isArray(rawItems) ? rawItems.slice(0, LIMITS.orderItems.max) : [];
  const removed: CartRemoval[] = [];

  // تجميع البنود الصالحة ودمج المكرر (نفس المنتج والحجم)
  const merged = new Map<string, { productId: string; variantId: string; quantity: number }>();
  for (const raw of list) {
    const parsed = rawCartItemSchema.safeParse(raw);
    if (!parsed.success) {
      const candidate = raw as { productId?: unknown; variantId?: unknown };
      removed.push({
        productId: typeof candidate?.productId === "string" ? candidate.productId : "",
        variantId: typeof candidate?.variantId === "string" ? candidate.variantId : "",
        name: null,
        reason: "invalid",
      });
      continue;
    }
    const key = `${parsed.data.productId}:${parsed.data.variantId}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...parsed.data,
      quantity: (existing?.quantity ?? 0) + parsed.data.quantity,
    });
  }

  const items = [...merged.values()];
  if (items.length === 0) return { lines: [], removed, total: 0, itemCount: 0 };

  await connectToDatabase();
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await ProductModel.find(
    { _id: trusted({ $in: productIds }), isPublished: true },
    { name: 1, slug: 1, images: 1, variants: 1 },
  ).lean<LeanProduct[]>();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  const lines: CartLine[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    const variant = product?.variants.find((v) => v._id.toString() === item.variantId);
    if (!product || !variant || !variant.isAvailable) {
      removed.push({ ...item, name: product?.name ?? null, reason: "unavailable" });
      continue;
    }
    const maxQuantity = Math.min(variant.stockQuantity, LIMITS.orderItemQuantity.max);
    if (maxQuantity <= 0) {
      removed.push({ ...item, name: product.name, reason: "out_of_stock" });
      continue;
    }
    const quantity = Math.min(item.quantity, maxQuantity);
    lines.push({
      productId: item.productId,
      variantId: item.variantId,
      slug: product.slug,
      name: product.name,
      sizeMl: variant.sizeMl,
      image: primaryImage(product.images, product.name),
      unitPrice: variant.price,
      compareAtPrice:
        variant.compareAtPrice && variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : null,
      quantity,
      maxQuantity,
      lineTotal: multiplyPiasters(variant.price, quantity),
      status: quantity === item.quantity ? "ok" : "adjusted",
    });
  }

  return {
    lines,
    removed,
    total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
