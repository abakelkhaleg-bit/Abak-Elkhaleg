/**
 * أشكال البيانات التي تمر من طبقة الخدمات إلى الواجهة. كلها قابلة للتسلسل
 * (نصوص وأرقام فقط) حتى يمكن تمريرها إلى Client Components بأمان.
 * المبالغ بالقروش.
 */

export type ImageView = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  image: ImageView | null;
  /** أقل سعر بين الأحجام المتاحة. */
  price: number;
  /** السعر قبل الخصم للحجم صاحب أقل سعر، إن وُجد. */
  compareAtPrice: number | null;
  hasMultiplePrices: boolean;
  inStock: boolean;
  isOnSale: boolean;
};

export type VariantView = {
  id: string;
  sizeMl: number;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  /** أقصى كمية يمكن طلبها (المخزون محدودًا بحد الطلب) — لا نكشف رقم المخزون الفعلي. */
  maxQuantity: number;
};

export type TaxonomyRef = { name: string; slug: string };

export type ProductDetailData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: TaxonomyRef | null;
  brand: TaxonomyRef | null;
  images: ImageView[];
  variants: VariantView[];
  seo: { title?: string; description?: string };
  updatedAt: string;
};

export type CategoryCardData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: ImageView | null;
};

export type BrandCardData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: ImageView | null;
};

export type ListingResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export type CartLineStatus = "ok" | "adjusted";

export type CartLine = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  sizeMl: number;
  image: ImageView | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  maxQuantity: number;
  lineTotal: number;
  status: CartLineStatus;
};

export type CartRemoval = {
  productId: string;
  variantId: string;
  name: string | null;
  reason: "unavailable" | "out_of_stock" | "invalid";
};

export type CartReview = {
  lines: CartLine[];
  removed: CartRemoval[];
  total: number;
  itemCount: number;
};
