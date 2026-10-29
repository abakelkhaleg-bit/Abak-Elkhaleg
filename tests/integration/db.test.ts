import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import {
  DatabaseConnectionError,
  checkDatabaseHealth,
  connectToDatabase,
  disconnectDatabase,
  supportsTransactions,
} from "@/lib/db";

const mongoUri = inject("mongoUri");

describe("اتصال قاعدة البيانات", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it("يرفض رابطًا غير صالح بخطأ عربي واضح ثم يسمح بإعادة المحاولة", async () => {
    await expect(connectToDatabase("mongodb://bad host name/x")).rejects.toBeInstanceOf(
      DatabaseConnectionError,
    );
    await expect(connectToDatabase(mongoUri)).resolves.toBeDefined();
    await disconnectDatabase();
  });

  it("يتصل ويعيد استخدام نفس الاتصال", async () => {
    const first = await connectToDatabase(mongoUri);
    const second = await connectToDatabase(mongoUri);
    expect(first).toBe(second);
    expect(first.connection.readyState).toBe(1);
  });

  it("يكتشف دعم المعاملات (replica set)", async () => {
    await connectToDatabase(mongoUri);
    await expect(supportsTransactions()).resolves.toBe(true);
    await expect(checkDatabaseHealth()).resolves.toEqual({ db: "ok", transactions: true });
  });

  it("يفعّل sanitizeFilter لحماية الاستعلامات من حقن المشغّلات", () => {
    expect(mongoose.get("sanitizeFilter")).toBe(true);
    expect(mongoose.get("strictQuery")).toBe(true);
  });
});

describe("المعاملات", () => {
  const Probe = mongoose.models.Probe ?? mongoose.model("Probe", new mongoose.Schema({ n: Number }));

  beforeAll(async () => {
    await connectToDatabase(mongoUri);
    await Probe.createCollection();
  });

  afterEach(async () => {
    await Probe.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("تحفظ التغييرات عند النجاح وتتراجع عنها عند الفشل", async () => {
    const connection = await connectToDatabase(mongoUri);

    await connection.connection.transaction(async (session) => {
      await Probe.create([{ n: 1 }], { session });
    });
    expect(await Probe.countDocuments()).toBe(1);

    await expect(
      connection.connection.transaction(async (session) => {
        await Probe.create([{ n: 2 }], { session });
        throw new Error("فشل مقصود");
      }),
    ).rejects.toThrow("فشل مقصود");
    expect(await Probe.countDocuments()).toBe(1);
  });
});
