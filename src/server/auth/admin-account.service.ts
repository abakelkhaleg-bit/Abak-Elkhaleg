import "server-only";
import { connectToDatabase } from "@/lib/db";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import { USERNAME_PATTERN } from "@/lib/validation-rules";
import { AdminModel } from "@/models/admin";
import { hashPassword, passwordPolicyErrors } from "@/server/auth/password";
import { deleteAllSessions } from "@/server/auth/session";

/**
 * إدارة حساب الأدمن الوحيد. تُستدعى من سكربتات سطر الأوامر فقط
 * (npm run admin:create / admin:reset-password) — لا توجد صفحة تسجيل عامة.
 */

function assertValidCredentials(username: string, password: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      "VALIDATION",
      "اسم المستخدم يجب أن يكون 3–32 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو . _ -",
    );
  }
  const policy = passwordPolicyErrors(password, username);
  if (policy.length > 0) throw new AppError("VALIDATION", policy.join(" "));
}

const ADMIN_EXISTS = "يوجد حساب أدمن بالفعل؛ لا يُسمح إلا بحساب واحد.";

export async function createInitialAdmin(input: {
  username: string;
  password: string;
}): Promise<{ username: string }> {
  const username = input.username.trim().toLowerCase();
  assertValidCredentials(username, input.password);
  await connectToDatabase();

  if (await AdminModel.exists({})) throw new AppError("ADMIN_EXISTS", ADMIN_EXISTS);
  try {
    await AdminModel.create({ username, passwordHash: await hashPassword(input.password) });
  } catch (error) {
    // سباق نادر بين تشغيلين متزامنين: الفهرس الفريد singleton يمنع الحساب الثاني.
    if (isDuplicateKeyError(error)) throw new AppError("ADMIN_EXISTS", ADMIN_EXISTS);
    throw error;
  }
  return { username };
}

/** يغيّر كلمة المرور ويبطل كل الجلسات القائمة. */
export async function resetAdminPassword(input: {
  password: string;
}): Promise<{ username: string; sessionsRevoked: number }> {
  await connectToDatabase();
  const admin = await AdminModel.findOne({});
  if (!admin) {
    throw new AppError("NO_ADMIN", "لا يوجد حساب أدمن. استخدم npm run admin:create أولًا.");
  }
  assertValidCredentials(admin.username, input.password);

  admin.passwordHash = await hashPassword(input.password);
  admin.passwordChangedAt = new Date();
  await admin.save();
  const sessionsRevoked = await deleteAllSessions(admin._id);
  return { username: admin.username, sessionsRevoked };
}
