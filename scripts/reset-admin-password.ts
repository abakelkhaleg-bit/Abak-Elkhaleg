/**
 * تغيير كلمة مرور الأدمن من الخادم/الجهاز المحلي، مع إبطال كل الجلسات.
 * التشغيل: npm run admin:reset-password
 */
import { AppError } from "@/lib/errors";
import { mongoose } from "@/models/_mongoose";
import { resetAdminPassword } from "@/server/auth/admin-account.service";
import { loadScriptEnv, requireMongoUri } from "./_script-env";
import { promptHidden } from "./_prompt";

async function main() {
  loadScriptEnv();
  await mongoose.connect(requireMongoUri(), { serverSelectionTimeoutMS: 15_000 });

  const password = await promptHidden("كلمة المرور الجديدة (12 حرفًا على الأقل): ");
  const confirm = await promptHidden("أعد كتابة كلمة المرور: ");
  if (password !== confirm) throw new AppError("MISMATCH", "كلمتا المرور غير متطابقتين.");

  const result = await resetAdminPassword({ password });
  console.info(
    `✓ تم تغيير كلمة مرور ${result.username}، وأُبطلت ${result.sessionsRevoked} جلسة.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
