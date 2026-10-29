import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// RTL: يُمنع استخدام الخصائص الفيزيائية في Tailwind؛ استخدم المنطقية (ms/me/ps/pe/start/end/text-start).
const PHYSICAL_CLASS =
  "/(^|\\s)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr)-|(^|\\s)text-(left|right)(\\s|$)/";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-expect-error": "allow-with-description",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='only']",
          message: "لا تستخدم .only في الاختبارات.",
        },
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=${PHYSICAL_CLASS}]`,
          message: "استخدم خصائص Tailwind المنطقية (ms/me/ps/pe/start/end/text-start) بدل left/right لدعم RTL.",
        },
        {
          selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=${PHYSICAL_CLASS}]`,
          message: "استخدم خصائص Tailwind المنطقية (ms/me/ps/pe/start/end/text-start) بدل left/right لدعم RTL.",
        },
      ],
    },
  },
];

export default config;
