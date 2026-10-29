/**
 * بناء/مزامنة فهارس كل النماذج (للإنتاج حيث autoIndex معطل).
 * التشغيل: npm run db:indexes
 */
import { ALL_MODELS } from "@/models";
import { mongoose } from "@/models/_mongoose";
import { databaseNameFromUri, loadScriptEnv, requireMongoUri } from "./_script-env";

async function main() {
  loadScriptEnv();
  const uri = requireMongoUri();
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15_000 });
  console.info(`قاعدة البيانات: ${databaseNameFromUri(uri) || "(الافتراضية)"}`);

  for (const model of ALL_MODELS) {
    const dropped = await model.syncIndexes();
    const indexes = await model.listIndexes();
    const names = indexes.map((index: { name?: string }) => index.name ?? "?").join(", ");
    const droppedNote = dropped.length > 0 ? ` (حُذف: ${dropped.join(", ")})` : "";
    console.info(`✓ ${model.modelName}: ${names}${droppedNote}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
