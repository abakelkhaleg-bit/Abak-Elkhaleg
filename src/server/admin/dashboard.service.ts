import "server-only";
import { connectToDatabase } from "@/lib/db";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { NotificationModel } from "@/models/notification";
import { ProductModel } from "@/models/product";

/**
 * إحصائيات لوحة التحكم — من بيانات المنتجات والمخزون الفعلية فقط.
 * لا أرقام مبيعات أو طلبات مؤكدة (النظام لا يسجل مبيعات حتى المرحلة 6).
 */

export type DashboardStats = {
  products: { total: number; published: number; draft: number; featured: number; onSale: number };
  stock: { lowVariants: number; outVariants: number };
  unreadNotifications: number;
  recentMovements: Array<{
    id: string;
    productName: string;
    sizeMl: number;
    movementType: string;
    quantityDelta: number;
    newQuantity: number;
    createdAt: string;
  }>;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  await connectToDatabase();
  const [productCounts, variantCounts, unreadNotifications, movements] = await Promise.all([
    ProductModel.aggregate<{
      total: number;
      published: number;
      featured: number;
      onSale: number;
    }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: ["$isPublished", 1, 0] } },
          featured: { $sum: { $cond: ["$isFeatured", 1, 0] } },
          onSale: { $sum: { $cond: ["$isOnSale", 1, 0] } },
        },
      },
    ]),
    ProductModel.aggregate<{ low: number; out: number }>([
      { $unwind: "$variants" },
      { $match: { "variants.isAvailable": true } },
      {
        $group: {
          _id: null,
          out: { $sum: { $cond: [{ $eq: ["$variants.stockQuantity", 0] }, 1, 0] } },
          low: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$variants.stockQuantity", 0] },
                    { $lte: ["$variants.stockQuantity", "$variants.lowStockThreshold"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    NotificationModel.countDocuments({ status: "unread", isOpen: true }),
    InventoryMovementModel.find().sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const counts = productCounts[0] ?? { total: 0, published: 0, featured: 0, onSale: 0 };
  const variants = variantCounts[0] ?? { low: 0, out: 0 };
  return {
    products: {
      total: counts.total,
      published: counts.published,
      draft: counts.total - counts.published,
      featured: counts.featured,
      onSale: counts.onSale,
    },
    stock: { lowVariants: variants.low, outVariants: variants.out },
    unreadNotifications,
    recentMovements: movements.map((movement) => ({
      id: movement._id.toString(),
      productName: movement.productName,
      sizeMl: movement.sizeMl,
      movementType: movement.movementType,
      quantityDelta: movement.quantityDelta,
      newQuantity: movement.newQuantity,
      createdAt: movement.createdAt.toISOString(),
    })),
  };
}
