/**
 * تعبئة قاعدة التطوير ببيانات تجريبية. يرفض العمل في الإنتاج.
 * التشغيل: npm run seed:dev  (أو npm run seed:dev -- --force-dev)
 */
import { mongoose } from "@/models/_mongoose";
import { databaseNameFromUri, loadScriptEnv, requireMongoUri } from "./_script-env";
import { assertSafeSeedTarget, seedDevData } from "./seed/dev-data";

async function main() {
  loadScriptEnv();
  const uri = requireMongoUri();
  assertSafeSeedTarget({
    nodeEnv: process.env.NODE_ENV,
    databaseName: databaseNameFromUri(uri),
    force: process.argv.includes("--force-dev"),
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  const summary = await seedDevData();
  console.info("تمت تعبئة بيانات التطوير:", summary);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
