/**
 * حذف البيانات الشخصية للعملاء من الطلبات القديمة (docs/SECURITY.md §10).
 * التشغيل: npm run orders:purge-pii -- --older-than=180d
 * البنود والإجمالي والحالة تبقى؛ يُحذف الاسم والموبايل والعنوان والملاحظات وipHash.
 */
import { mongoose } from "@/models/_mongoose";
import { purgePiiOlderThan } from "@/server/orders.service";
import { loadScriptEnv, requireMongoUri } from "./_script-env";

function parseDays(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith("--older-than="));
  const match = arg?.match(/^--older-than=(\d+)d$/);
  if (!match?.[1]) throw new Error("حدد المدة بالأيام، مثل: --older-than=180d");
  const days = Number(match[1]);
  if (days < 30) throw new Error("أقل مدة مسموحة 30 يومًا، لتجنب حذف بيانات طلبات قيد المتابعة.");
  return days;
}

async function main() {
  loadScriptEnv();
  const days = parseDays(process.argv.slice(2));
  await mongoose.connect(requireMongoUri(), { serverSelectionTimeoutMS: 15_000 });
  const count = await purgePiiOlderThan(days);
  console.info(`✓ حُذفت البيانات الشخصية من ${count} طلب أقدم من ${days} يومًا.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
