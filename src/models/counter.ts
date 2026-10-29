import { Schema, type ClientSession, type Model } from "mongoose";
import { isDuplicateKeyError } from "@/lib/errors";
import { defineModel } from "@/models/_mongoose";

/** عدادات تسلسلية ذرية (مثل أرقام الطلبات). راجع docs/DATABASE.md §3.10. */

export interface Counter {
  _id: string;
  seq: number;
}

export type CounterModel = Model<Counter>;

const counterSchema = new Schema<Counter, CounterModel>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = defineModel<Counter, CounterModel>("Counter", counterSchema);

/** يعيد القيمة التالية للعداد بعملية $inc ذرية — فريدة حتى تحت التزامن. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const counter = await CounterModel.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after", session },
      );
      if (!counter) throw new Error(`تعذر تحديث العداد ${name}.`);
      return counter.seq;
    } catch (error) {
      // أول استخدام متزامن للعداد: قد يفشل upsert أحدهما بـ E11000؛ إعادة المحاولة تزيد القيمة الموجودة.
      if (!isDuplicateKeyError(error) || attempt >= 3) throw error;
    }
  }
}

export function formatOrderReference(seq: number): string {
  return `AK-${String(seq).padStart(6, "0")}`;
}
