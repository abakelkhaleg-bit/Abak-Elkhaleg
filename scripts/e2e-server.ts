/**
 * خادم اختبارات E2E: يشغّل MongoDB مؤقتة (replica set في الذاكرة)، ثم يبني التطبيق
 * ويشغّله بوضع الإنتاج. يُستدعى من playwright.config.ts فقط — لا يستخدم أي بيانات حقيقية.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ALL_MODELS } from "@/models";
import { mongoose } from "@/models/_mongoose";
import { seedE2EData } from "../tests/e2e/seed-e2e";

const port = process.env.E2E_PORT ?? "3100";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

function run(args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, [nextBin, ...args], { env, stdio: "inherit" });
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await replSet.waitUntilRunning();

  const mongoUri = replSet.getUri("abak-elkhalig-e2e");

  // تعبئة بيانات الاختبار (فهارس حقيقية + seed + حالات حدّية) قبل تشغيل التطبيق
  await mongoose.connect(mongoUri);
  for (const model of ALL_MODELS) await model.syncIndexes();
  await seedE2EData();
  await mongoose.disconnect();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    APP_URL: `http://localhost:${port}`,
    MONGODB_URI: mongoUri,
    NEXT_TELEMETRY_DISABLED: "1",
    // رفع الصور بلا شبكة؛ storage.ts يرفض هذا السائق إلا على localhost.
    MEDIA_STORAGE: "memory",
    // قيم عشوائية لكل تشغيل (لا أسرار حقيقية): لازمة لـ ipHash في الطلبات وللـcron.
    IP_HASH_SALT: randomBytes(32).toString("hex"),
    CRON_SECRET: randomBytes(32).toString("hex"),
  };

  const buildCode = await waitForExit(run(["build"], env));
  if (buildCode !== 0) {
    await replSet.stop();
    process.exit(buildCode);
  }

  const server = run(["start", "-p", port], env);

  const shutdown = async () => {
    server.kill();
    await replSet.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const code = await waitForExit(server);
  await replSet.stop();
  process.exit(code);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
