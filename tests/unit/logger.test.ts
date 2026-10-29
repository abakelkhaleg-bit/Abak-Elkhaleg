import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, redact } from "@/lib/logger";

describe("redact", () => {
  it("يحذف القيم ذات المفاتيح الحساسة على أي عمق", () => {
    const output = redact({
      username: "admin",
      password: "s3cret",
      nested: { sessionToken: "abc", apiKey: "k", list: [{ phone: "01012345678" }] },
    });
    expect(output).toEqual({
      username: "admin",
      password: "[محذوف]",
      nested: { sessionToken: "[محذوف]", apiKey: "[محذوف]", list: [{ phone: "[محذوف]" }] },
    });
  });

  it("يحذف بيانات الاعتماد من روابط MongoDB داخل رسائل الأخطاء", () => {
    const output = redact(new Error("connect failed mongodb+srv://user:pw@cluster0.example.net/db"));
    expect(JSON.stringify(output)).not.toContain("user:pw");
    expect(JSON.stringify(output)).toContain("mongodb+srv://[محذوف]@cluster0");
  });
});

describe("logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("يكتب JSON دون القيم الحساسة", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("فشل", { password: "x", cookie: "y", step: 2 });
    const line = String(spy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as { level: string; context: Record<string, unknown> };
    expect(parsed.level).toBe("error");
    expect(parsed.context).toEqual({ password: "[محذوف]", cookie: "[محذوف]", step: 2 });
  });
});
