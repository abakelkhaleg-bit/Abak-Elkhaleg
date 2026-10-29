/**
 * قواعد التحقق المشتركة بين مخططات Zod (src/schemas) ونماذج Mongoose (src/models)
 * حتى لا تتكرر القيم في مكانين. التفاصيل في docs/DATABASE.md.
 */

/** حروف عربية (ء–غ، ف–ي) + لاتينية صغيرة + أرقام، مفصولة بشرطة واحدة. */
export const SLUG_PATTERN =
  /^[a-z0-9ء-غف-ي]+(?:-[a-z0-9ء-غف-ي]+)*$/;
export const SKU_PATTERN = /^[A-Z0-9-]{3,40}$/;
export const EGYPT_MOBILE_PATTERN = /^01[0125]\d{8}$/;
/** رقم واتساب المتجر بصيغة E.164 دون "+": 20 + رقم موبايل مصري بدون الصفر. */
export const WHATSAPP_E164_PATTERN = /^201[0125]\d{8}$/;
export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;
export const CLOUDINARY_URL_PATTERN = /^https:\/\/res\.cloudinary\.com\/[^\s]+$/;
export const ORDER_REFERENCE_PATTERN = /^AK-\d{6,}$/;
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export const LIMITS = {
  productName: { min: 2, max: 120 },
  shortDescription: { max: 300 },
  description: { max: 10_000 },
  altText: { max: 150 },
  imagesPerProduct: 12,
  variantsPerProduct: { min: 1, max: 10 },
  sizeMl: { min: 1, max: 1000 },
  /** أقصى سعر: مليون جنيه (بالقروش). */
  maxPricePiasters: 100_000_000,
  maxStock: 1_000_000,
  categoryName: { min: 2, max: 60 },
  brandName: { min: 2, max: 60 },
  taxonomyDescription: { max: 1000 },
  seoTitle: { max: 70 },
  seoDescription: { max: 160 },
  movementReason: { min: 3, max: 300 },
  customerName: { min: 2, max: 60 },
  customerAddress: { max: 300 },
  customerNotes: { max: 500 },
  orderItems: { max: 30 },
  orderItemQuantity: { max: 20 },
  storeDescription: { max: 1000 },
  policyBody: { max: 20_000 },
} as const;

export const MOVEMENT_TYPES = [
  "initial",
  "restock",
  "adjustment",
  "stocktake",
  "sale",
  "order_cancel_restore",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
/** حركات يجب أن تحمل سببًا مكتوبًا. */
export const MOVEMENT_TYPES_REQUIRING_REASON: readonly MovementType[] = ["adjustment", "stocktake"];
/** حركات مرتبطة بطلب. */
export const ORDER_MOVEMENT_TYPES: readonly MovementType[] = ["sale", "order_cancel_restore"];

export const NOTIFICATION_TYPES = ["low_stock", "out_of_stock"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_STATUSES = ["unread", "read"] as const;

export const ORDER_STATUSES = ["opened_in_whatsapp", "confirmed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MEDIA_FOLDERS = ["products", "categories", "brands", "settings"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];
export const MEDIA_STATUSES = ["pending", "attached"] as const;
