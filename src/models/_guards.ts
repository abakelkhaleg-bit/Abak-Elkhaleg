import type { HydratedDocument, Query, Schema } from "mongoose";
import { AppError } from "@/lib/errors";
import { ProductModel } from "@/models/product";
import { trusted } from "@/models/_mongoose";

/**
 * حراس على مستوى النموذج لقواعد الحذف (docs/DATABASE.md §5). تعمل حتى لو استُدعي
 * الحذف مباشرة من أي مكان، فلا يمكن تجاوز القاعدة بنسيان فحص في الخدمة.
 */

const DELETE_QUERY_OPS: Array<"deleteOne" | "deleteMany" | "findOneAndDelete"> = [
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];
const UPDATE_QUERY_OPS: Array<
  "updateOne" | "updateMany" | "findOneAndUpdate" | "replaceOne" | "findOneAndReplace"
> = ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"];

/** يرفض حذف تصنيف أو ماركة ما دامت هناك منتجات مرتبطة بها. */
export function blockDeleteWhileProductsReference<T>(
  schema: Schema<T>,
  options: { productField: "categoryId" | "brandId"; code: string; entityLabel: string },
): void {
  const assertNotReferenced = async (ids: unknown[]) => {
    if (ids.length === 0) return;
    const count = await ProductModel.countDocuments({
      [options.productField]: trusted({ $in: ids }),
    });
    if (count > 0) {
      throw new AppError(
        options.code,
        `لا يمكن حذف ${options.entityLabel} لأنه مرتبط بـ${count} منتج — انقل المنتجات أو أخفِ ${options.entityLabel}.`,
      );
    }
  };

  schema.pre(
    DELETE_QUERY_OPS,
    { document: false, query: true },
    async function (this: Query<unknown, T>) {
      const ids: unknown[] = await this.model.find(this.getFilter()).distinct("_id");
      await assertNotReferenced(ids);
    },
  );

  schema.pre("deleteOne", { document: true, query: false }, async function (this: HydratedDocument<T>) {
    await assertNotReferenced([this._id]);
  });
}

/** يمنع الحذف عبر أي استعلام أو مستند (لسجلات يجب أن تبقى مرجعيًا). */
export function blockDeletes<T>(schema: Schema<T>, message: string): void {
  const reject = () => {
    throw new AppError("DELETE_FORBIDDEN", message);
  };
  schema.pre(DELETE_QUERY_OPS, { document: false, query: true }, reject);
  schema.pre("deleteOne", { document: true, query: false }, reject);
}

/** سجلات للإضافة فقط: لا تعديل ولا حذف بعد الإنشاء. */
export function makeAppendOnly<T>(schema: Schema<T>, message: string): void {
  blockDeletes(schema, message);
  schema.pre(UPDATE_QUERY_OPS, { document: false, query: true }, () => {
    throw new AppError("IMMUTABLE", message);
  });
  schema.pre("save", function (this: HydratedDocument<T>) {
    if (!this.isNew) throw new AppError("IMMUTABLE", message);
  });
}
