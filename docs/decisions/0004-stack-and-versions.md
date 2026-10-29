# ADR 0004 — التقنيات ومدير الحزم والإصدارات

- **الحالة:** مقترح (يُعتمد مع الخطة)
- **القرار:**
  - **التقنيات:** Next.js (App Router، `src/`)، وReact، وTypeScript strict، وTailwind CSS v4، وshadcn/ui، وMongoose، وZod، وVitest، وPlaywright، و`@node-rs/argon2`، و`cloudinary` (SDK للخادم)، و`file-type`، و`sharp` (لتوليد أصول العلامة فقط).
  - **مدير الحزم: npm.** هو الافتراضي على Vercel وعلى أي VPS، ولا يتطلب أدوات إضافية. pnpm متاح، لكن لا فائدة جوهرية منه لمشروع واحد.
  - **الإصدارات:** في بداية المرحلة 1 تُحدد أحدث الإصدارات **المستقرة** المتوافقة مع Node 24 عبر `npm view <pkg> version` وملاحظات الإصدار. تُثبت بدقة دون `^`، وتُسجل في PROGRESS.
  - أي اختلاف في واجهات الإصدار الفعلي يُعالج ويوثق في ADR جديد، مثل تسمية `middleware`/`proxy` أو آلية الكاش `unstable_cache`/`"use cache"`.
- **مرفوض:**
  - Prisma: المطلوب Mongoose.
  - NextAuth/Auth.js: انظر ADR 0005.
  - Jest: Vitest أبسط مع ESM وTypeScript.
