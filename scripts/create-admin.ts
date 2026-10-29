/**
 * إنشاء حساب الأدمن الأول (مرة واحدة فقط). يرفض إن وُجد حساب.
 * التشغيل: npm run admin:create
 */
import { AppError } from "@/lib/errors";
import { mongoose } from "@/models/_mongoose";
import { createInitialAdmin } from "@/server/auth/admin-account.service";
import { loadScriptEnv, requireMongoUri } from "./_script-env";
import { promptHidden, promptLine } from "./_prompt";

async function main() {
  loadScriptEnv();
  await mongoose.connect(requireMongoUri(), { serverSelectionTimeoutMS: 15_000 });

  const username = await promptLine("اسم المستخدم (إنجليزي صغير، 3–32): ");
  const password = await promptHidden("كلمة المرور (12 حرفًا على الأقل): ");
  const confirm = await promptHidden("أعد كتابة كلمة المرور: ");
  if (password !== confirm) throw new AppError("MISMATCH", "كلمتا المرور غير متطابقتين.");

  const admin = await createInitialAdmin({ username, password });
  console.info(`✓ تم إنشاء حساب الأدمن: ${admin.username}. سجّل الدخول من /admin/login`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
