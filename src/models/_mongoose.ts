import mongoose, { type Model, type Schema } from "mongoose";

/**
 * إعدادات Mongoose العامة — تُطبَّق في كل مكان يُستورد فيه أي نموذج (التطبيق، السكربتات، الاختبارات).
 *
 * sanitizeFilter: أي كائن يحتوي مفاتيح تبدأ بـ$ داخل فلتر استعلام يُعامل كقيمة حرفية
 * (حماية من NoSQL injection). عند الحاجة لمشغّل حقيقي داخل فلتر نكتبه بأنفسنا
 * نغلّفه بـ trusted()، مثل: { categoryId: trusted({ $in: ids }) }.
 */
mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

export const trusted = mongoose.trusted.bind(mongoose);

/** يعيد النموذج المسجّل مسبقًا (HMR في التطوير) أو يسجّله لأول مرة. */
export function defineModel<T, TModel extends Model<T> = Model<T>>(
  name: string,
  schema: Schema<T, TModel>,
): TModel {
  const existing = mongoose.models[name] as TModel | undefined;
  return existing ?? mongoose.model<T, TModel>(name, schema);
}

export const integerValidator = {
  validator: (value: unknown) => value === undefined || value === null || Number.isInteger(value),
  message: "القيمة يجب أن تكون عددًا صحيحًا.",
};

export { mongoose };
