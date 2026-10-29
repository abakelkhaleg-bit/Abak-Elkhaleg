# ADR 0010 — الإصدارات المثبتة في المرحلة 1

- **الحالة:** منفّذ (2026-10-15)
- **السياق:**
  - ADR 0004 نص على اختيار أحدث الإصدارات المستقرة المتوافقة عبر `npm view`.
  - الفحص الفعلي أظهر تعارضين.
- **التعارضات والقرارات:**

| الحزمة | أحدث إصدار | المثبت | السبب |
|---|---|---|---|
| typescript | 7.0.2 | **6.0.3** | `typescript-eslint@8.71.2` يتطلب `typescript >=4.8.4 <6.1.0` |
| eslint | 10.12.0 | **9.39.5** | الإضافات داخل `eslint-config-next@16.4.1` (`eslint-plugin-react`، و`import`، و`jsx-a11y`) لا تدعم ESLint 10 بعد |
| @types/node | 26.x | **24.19.2** | مطابقة Node 24 LTS المستخدم |
| vite-tsconfig-paths | 6.1.1 | **أُزيلت** | تعتمد على `tsconfck` غير المصان. استُبدلت بـ`resolve.alias` في `vitest.config.mts` |

- **الإصدارات الأساسية المثبتة (بلا `^`):**
  - next 16.4.1، وreact وreact-dom 19.3.1.
  - tailwindcss و@tailwindcss/postcss 4.3.3.
  - mongoose 9.11.2، وzod 4.6.7.
  - vitest 5.0.4، و@playwright/test 1.64.1، وmongodb-memory-server 11.3.0.
  - sharp 0.35.5، وtsx 4.23.15، وprettier 3.9.10.
- **ملاحظات Next.js 16:**
  - Turbopack هو الافتراضي في البناء.
  - `next lint` أُزيل، ونستخدم `eslint .` مباشرة مع flat config.
  - `middleware` أصبح `proxy.ts` في Next 16، وسنستخدم `proxy.ts` في المرحلة 4.
- **مخاطر:**
  - npm يحذّر بأن ESLint 9 خارج الدعم. سنرقّي إلى ESLint 10 عندما تدعمه `eslint-config-next`، ونراجع ذلك في المرحلة 7.
  - shadcn/ui لم يُضف بعد. يُضاف كل مكون عند أول حاجة فعلية (المرحلة 3/4)، لتجنب كود غير مستخدم.
