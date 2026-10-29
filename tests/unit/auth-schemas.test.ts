import { describe, expect, it } from "vitest";
import { loginSchema, safeAdminNextPath } from "@/schemas/auth";

describe("safeAdminNextPath (A9 — منع Open Redirect)", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/products", "/admin/products"],
    ["/admin/products?status=draft", "/admin/products?status=draft"],
  ])("يقبل %s", (input, expected) => {
    expect(safeAdminNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/admin",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/perfumes",
    "/admin-evil",
    "/admin/login",
    "/admin/x y",
    "",
    undefined,
    42,
  ])("يرفض %s ويعيد /admin", (input) => {
    expect(safeAdminNextPath(input)).toBe("/admin");
  });
});

describe("loginSchema", () => {
  it("يطبّع اسم المستخدم ويرفض الفارغ", () => {
    expect(loginSchema.parse({ username: "  Owner ", password: "x" }).username).toBe("owner");
    expect(loginSchema.safeParse({ username: "", password: "" }).success).toBe(false);
  });
});
