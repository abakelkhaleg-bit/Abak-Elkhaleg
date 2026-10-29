import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { ALL_MODELS } from "@/models";
import { mongoose } from "@/models/_mongoose";

/**
 * يربط ملف اختبار تكاملي بقاعدة مستقلة داخل replica set الموجودة في الذاكرة،
 * يبني الفهارس الحقيقية، ويفرغ المجموعات قبل كل اختبار.
 * التفريغ يتم عبر الـdriver مباشرة (يتجاوز حراس الحذف في النماذج عمدًا).
 */
export function setupTestDatabase(dbName: string): void {
  beforeAll(async () => {
    await mongoose.connect(inject("mongoUri"), { dbName, autoIndex: false });
    for (const model of ALL_MODELS) {
      await model.createCollection();
      await model.syncIndexes();
    }
  });

  beforeEach(async () => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("لا يوجد اتصال بقاعدة الاختبار.");
    for (const collection of await db.collections()) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
