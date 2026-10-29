import { AdminModel } from "@/models/admin";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import { CounterModel } from "@/models/counter";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { MediaAssetModel } from "@/models/media-asset";
import { NotificationModel } from "@/models/notification";
import { OrderRequestModel } from "@/models/order-request";
import { ProductModel } from "@/models/product";
import { RateLimitModel } from "@/models/rate-limit";
import { SessionModel } from "@/models/session";
import { StoreSettingsModel } from "@/models/store-settings";

export {
  AdminModel,
  BrandModel,
  CategoryModel,
  CounterModel,
  InventoryMovementModel,
  MediaAssetModel,
  NotificationModel,
  OrderRequestModel,
  ProductModel,
  RateLimitModel,
  SessionModel,
  StoreSettingsModel,
};

/** كل النماذج — تُستخدم لبناء الفهارس (npm run db:indexes) وفي الاختبارات. */
export const ALL_MODELS = [
  ProductModel,
  CategoryModel,
  BrandModel,
  InventoryMovementModel,
  NotificationModel,
  AdminModel,
  SessionModel,
  StoreSettingsModel,
  OrderRequestModel,
  CounterModel,
  RateLimitModel,
  MediaAssetModel,
] as const;
