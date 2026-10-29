"use server";

import { AppError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";
import {
  createProduct,
  deleteProduct,
  setProductFlag,
  updateProduct,
} from "@/server/admin/products.admin.service";
import {
  createTaxonomy,
  deleteTaxonomy,
  setTaxonomyActive,
  updateTaxonomy,
  type TaxonomyKind,
} from "@/server/admin/taxonomy.admin.service";
import { runAdminAction } from "@/server/auth/admin-action";

/**
 * عمليات إدارة الكتالوج. كل دالة تمر عبر runAdminAction (تحقق الجلسة أولًا)،
 * والمدخلات غير موثوقة: تتحقق منها الخدمات بـ Zod وتعيد قراءة المراجع من القاعدة.
 */

function assertKind(kind: unknown): TaxonomyKind {
  if (kind !== "category" && kind !== "brand") throw new AppError("VALIDATION", "نوع غير معروف.");
  return kind;
}

const asBoolean = (value: unknown) => value === true;

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAdminAction(() => createProduct(input));
}

export async function updateProductAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAdminAction(() => updateProduct(id, input));
}

export async function setProductPublishedAction(id: unknown, value: unknown): Promise<ActionResult> {
  return runAdminAction(() => setProductFlag(id, "isPublished", asBoolean(value)));
}

export async function setProductFeaturedAction(id: unknown, value: unknown): Promise<ActionResult> {
  return runAdminAction(() => setProductFlag(id, "isFeatured", asBoolean(value)));
}

export async function deleteProductAction(id: unknown): Promise<ActionResult> {
  return runAdminAction(() => deleteProduct(id));
}

export async function createTaxonomyAction(
  kind: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => createTaxonomy(assertKind(kind), input));
}

export async function updateTaxonomyAction(
  kind: unknown,
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => updateTaxonomy(assertKind(kind), id, input));
}

export async function setTaxonomyActiveAction(
  kind: unknown,
  id: unknown,
  value: unknown,
): Promise<ActionResult> {
  return runAdminAction(async () => setTaxonomyActive(assertKind(kind), id, asBoolean(value)));
}

export async function deleteTaxonomyAction(kind: unknown, id: unknown): Promise<ActionResult> {
  return runAdminAction(async () => deleteTaxonomy(assertKind(kind), id));
}
