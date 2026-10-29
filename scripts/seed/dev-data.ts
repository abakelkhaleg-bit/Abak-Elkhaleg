/**
 * بيانات تطوير فقط — لا تُستورد من كود التطبيق أبدًا. راجع docs/DATABASE.md §8.
 * الصور تشير إلى حساب Cloudinary التجريبي العام (demo) ولا تُحذف أبدًا من خدمة الصور
 * لأنها خارج مجلد المشروع (abak-elkhalig/).
 */
import { buildSearchText } from "@/lib/arabic-normalize";
import { slugify } from "@/lib/slug";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { ProductModel } from "@/models/product";
import { loadStoreSettings } from "@/models/store-settings";
import type { Types } from "mongoose";

const DEMO_IMAGE = {
  secureUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  publicId: "sample",
};

const categories = [
  "عطور رجالي",
  "عطور حريمي",
  "عطور للجنسين",
  "العطور الشرقية",
  "العود",
  "المسك",
  "العطور الفاخرة",
];

const brands = ["دار العود", "بيت العنبر", "مسك الأمراء"];

type SeedVariant = {
  sizeMl: number;
  sku: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  isAvailable?: boolean;
};

type SeedProduct = {
  name: string;
  category: string;
  brand: string;
  shortDescription: string;
  featured?: boolean;
  variants: SeedVariant[];
};

/** الأسعار بالقروش. */
const products: SeedProduct[] = [
  {
    name: "عود ملكي",
    category: "العود",
    brand: "دار العود",
    shortDescription: "عود كمبودي فاخر بلمسة من الورد الطائفي.",
    featured: true,
    variants: [
      { sizeMl: 50, sku: "DEV-OUD-50", price: 95_000, compareAtPrice: 120_000, stock: 12 },
      { sizeMl: 100, sku: "DEV-OUD-100", price: 165_000, stock: 2 },
    ],
  },
  {
    name: "مسك أبيض ناعم",
    category: "المسك",
    brand: "مسك الأمراء",
    shortDescription: "مسك أبيض نظيف يدوم طويلًا.",
    variants: [
      { sizeMl: 30, sku: "DEV-MUSK-30", price: 35_000, stock: 40 },
      { sizeMl: 75, sku: "DEV-MUSK-75", price: 72_000, stock: 0 },
    ],
  },
  {
    name: "عنبر الليل",
    category: "العطور الشرقية",
    brand: "بيت العنبر",
    shortDescription: "عنبر دافئ مع الفانيليا والبخور.",
    featured: true,
    variants: [{ sizeMl: 100, sku: "DEV-AMBER-100", price: 110_000, stock: 8 }],
  },
  {
    name: "ورد الصباح",
    category: "عطور حريمي",
    brand: "مسك الأمراء",
    shortDescription: "باقة ورد منعشة بلمسة حمضيات.",
    variants: [
      { sizeMl: 50, sku: "DEV-ROSE-50", price: 54_950, compareAtPrice: 65_000, stock: 15 },
      { sizeMl: 100, sku: "DEV-ROSE-100", price: 89_900, stock: 6 },
    ],
  },
  {
    name: "خشب الصحراء",
    category: "عطور رجالي",
    brand: "دار العود",
    shortDescription: "أخشاب جافة مع الجلد والهيل.",
    variants: [{ sizeMl: 100, sku: "DEV-WOOD-100", price: 78_000, stock: 3 }],
  },
  {
    name: "نسيم الخليج",
    category: "عطور للجنسين",
    brand: "بيت العنبر",
    shortDescription: "عطر بحري خفيف للاستخدام اليومي.",
    variants: [
      { sizeMl: 50, sku: "DEV-BREEZE-50", price: 42_000, stock: 20 },
      { sizeMl: 100, sku: "DEV-BREEZE-100", price: 68_000, stock: 9, isAvailable: false },
    ],
  },
];

export type SeedSummary = {
  categoriesCreated: number;
  brandsCreated: number;
  productsCreated: number;
  movementsCreated: number;
};

type NamedRef = { id: Types.ObjectId; name: string };

/** idempotent: يتخطى أي عنصر موجود بنفس الـslug، فيمكن تشغيله أكثر من مرة. */
export async function seedDevData(): Promise<SeedSummary> {
  const summary: SeedSummary = {
    categoriesCreated: 0,
    brandsCreated: 0,
    productsCreated: 0,
    movementsCreated: 0,
  };

  await loadStoreSettings();

  const categoryRefs = new Map<string, NamedRef>();
  for (const [index, name] of categories.entries()) {
    const slug = slugify(name);
    let category = await CategoryModel.findOne({ slug });
    if (!category) {
      category = await CategoryModel.create({ name, slug, sortOrder: index });
      summary.categoriesCreated += 1;
    }
    categoryRefs.set(name, { id: category._id, name });
  }

  const brandRefs = new Map<string, NamedRef>();
  for (const [index, name] of brands.entries()) {
    const slug = slugify(name);
    let brand = await BrandModel.findOne({ slug });
    if (!brand) {
      brand = await BrandModel.create({ name, slug, sortOrder: index });
      summary.brandsCreated += 1;
    }
    brandRefs.set(name, { id: brand._id, name });
  }

  for (const [index, seed] of products.entries()) {
    const slug = slugify(seed.name);
    if (await ProductModel.exists({ slug })) continue;

    const category = categoryRefs.get(seed.category);
    const brand = brandRefs.get(seed.brand);
    if (!category || !brand) throw new Error(`بيانات seed غير متسقة: ${seed.name}`);

    const product = await ProductModel.create({
      name: seed.name,
      slug,
      shortDescription: seed.shortDescription,
      description: `${seed.shortDescription}\n\nهذا وصف تجريبي لبيئة التطوير فقط.`,
      categoryId: category.id,
      brandId: brand.id,
      images: [{ ...DEMO_IMAGE, altText: seed.name, sortOrder: 0 }],
      variants: seed.variants.map((variant) => ({
        sizeMl: variant.sizeMl,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stockQuantity: variant.stock,
        isAvailable: variant.isAvailable ?? true,
      })),
      isPublished: true,
      isFeatured: seed.featured ?? false,
      sortOrder: index,
      searchText: buildSearchText(seed.name, brand.name, category.name),
    });
    summary.productsCreated += 1;

    const movements = product.variants
      .filter((variant) => variant.stockQuantity > 0)
      .map((variant) => ({
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        sizeMl: variant.sizeMl,
        movementType: "initial" as const,
        quantityDelta: variant.stockQuantity,
        previousQuantity: 0,
        newQuantity: variant.stockQuantity,
      }));
    if (movements.length > 0) {
      await InventoryMovementModel.insertMany(movements);
      summary.movementsCreated += movements.length;
    }
  }

  return summary;
}

/** يرفض التشغيل على قاعدة إنتاج. */
export function assertSafeSeedTarget(options: {
  nodeEnv: string | undefined;
  databaseName: string;
  force: boolean;
}): void {
  if (options.nodeEnv === "production") {
    throw new Error("seed:dev مرفوض في بيئة الإنتاج (NODE_ENV=production).");
  }
  const looksLikeDevDb = /-(dev|test)$/.test(options.databaseName);
  if (!looksLikeDevDb && !options.force) {
    throw new Error(
      `اسم قاعدة البيانات "${options.databaseName || "(فارغ)"}" لا ينتهي بـ -dev أو -test. ` +
        "استخدم قاعدة تطوير، أو أضف --force-dev إن كنت متأكدًا.",
    );
  }
}
