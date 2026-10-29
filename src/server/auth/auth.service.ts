import "server-only";
import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { AdminModel } from "@/models/admin";
import { verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { consumeRateLimit, RATE_LIMITS, resetRateLimit } from "@/server/rate-limit";

/** رسالة واحدة لكل أسباب الفشل حتى لا يُكشف وجود اسم المستخدم. */
const INVALID_CREDENTIALS = "اسم المستخدم أو كلمة المرور غير صحيحة.";

export async function login(input: {
  username: string;
  password: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ token: string }> {
  const username = input.username.trim().toLowerCase();
  const pairKey = `${input.ip}|${username}`;

  const [pairLimit, ipLimit] = await Promise.all([
    consumeRateLimit("login", pairKey, RATE_LIMITS.login),
    consumeRateLimit("login-ip", input.ip, RATE_LIMITS.loginIp),
  ]);
  if (!pairLimit.allowed || !ipLimit.allowed) {
    const seconds = Math.max(pairLimit.retryAfterSeconds, ipLimit.retryAfterSeconds);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    logger.warn("تجاوز حد محاولات الدخول", { bucket: !pairLimit.allowed ? "login" : "login-ip" });
    throw new AppError(
      "RATE_LIMITED",
      `محاولات كثيرة لتسجيل الدخول. حاول مرة أخرى بعد ${minutes} دقيقة.`,
    );
  }

  await connectToDatabase();
  const admin = await AdminModel.findOne({ username }).select("+passwordHash");
  const valid = admin
    ? await verifyPassword(admin.passwordHash, input.password)
    : await verifyAgainstDummy(input.password);

  if (!admin || !valid) {
    logger.warn("محاولة دخول فاشلة");
    throw new AppError("INVALID_CREDENTIALS", INVALID_CREDENTIALS);
  }

  // الدخول الناجح يصفّر العدادين: حساب المحاولات الناجحة ضمن حد الـIP لا يفيد أمنيًا
  // ويحجب مستخدمين شرعيين خلف IP مشترك.
  await Promise.all([resetRateLimit("login", pairKey), resetRateLimit("login-ip", input.ip)]);
  const token = await createSession(admin._id, input.userAgent);
  logger.info("تسجيل دخول الأدمن");
  return { token };
}
