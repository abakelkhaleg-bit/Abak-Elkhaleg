import "server-only";
import { getCoreEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
// يطبّق strictQuery و sanitizeFilter على مستوى التطبيق كله.
import { mongoose } from "@/models/_mongoose";

/**
 * اتصال Mongoose واحد يُعاد استخدامه (آمن مع HMR في التطوير ومع Serverless).
 * راجع docs/DATABASE.md §1.
 */

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __abakMongoose?: ConnectionCache;
};

const cache: ConnectionCache = (globalForMongoose.__abakMongoose ??= {
  conn: null,
  promise: null,
});

export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  // اتصال قائم أُنشئ خارج هذه الوحدة (الاختبارات والسكربتات) — نعيد استخدامه.
  if (!uri && mongoose.connection.readyState === 1) return mongoose;

  if (!cache.promise) {
    const connectionUri = uri ?? getCoreEnv().MONGODB_URI;
    const isProduction = process.env.NODE_ENV === "production";
    cache.promise = mongoose.connect(connectionUri, {
      bufferCommands: false,
      autoIndex: !isProduction,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    logger.error("فشل الاتصال بقاعدة البيانات", { error });
    throw new DatabaseConnectionError();
  }

  return cache.conn;
}

export async function disconnectDatabase(): Promise<void> {
  if (cache.conn) await cache.conn.disconnect();
  cache.conn = null;
  cache.promise = null;
}

export class DatabaseConnectionError extends Error {
  constructor() {
    super("تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.");
    this.name = "DatabaseConnectionError";
  }
}

/**
 * المعاملات تتطلب replica set أو sharded cluster (docs/decisions/0006).
 * تعتمد على نتيجة أمر hello: setName (replica set) أو msg === "isdbgrid" (mongos).
 */
export async function supportsTransactions(): Promise<boolean> {
  const connection = await connectToDatabase();
  const db = connection.connection.db;
  if (!db) return false;
  const hello = await db.admin().command({ hello: 1 });
  return typeof hello.setName === "string" || hello.msg === "isdbgrid";
}

export type DatabaseHealth =
  | { db: "ok"; transactions: boolean }
  | { db: "error"; transactions: false };

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    const transactions = await supportsTransactions();
    if (!transactions) {
      logger.warn("قاعدة البيانات لا تدعم المعاملات؛ عمليات المخزون ستُرفض. استخدم replica set.");
    }
    return { db: "ok", transactions };
  } catch (error) {
    logger.error("فحص صحة قاعدة البيانات فشل", { error });
    return { db: "error", transactions: false };
  }
}
