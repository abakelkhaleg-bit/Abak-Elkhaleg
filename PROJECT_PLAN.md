# خطة مشروع متجر «عطور عبق الخليج»

> الحالة: **المراحل 0–3 معتمدة · المرحلة 4 مكتملة — بانتظار المراجعة** (التفاصيل في [docs/PROGRESS.md](docs/PROGRESS.md))
> آخر تحديث: 2026-10-15

## 1. الرؤية

متجر إلكتروني عربي (RTL) فاخر وسريع لبيع العطور (شرقية، غربية، عود، مسك، رجالي، نسائي، للجنسين). يكتشف العميل العطور ويطّلع على تفاصيلها وأسعارها حسب الحجم، ثم يرسل طلبه عبر **واتساب**. صاحب المتجر يدير المنتجات والتصنيفات والماركات والصور والمخزون والإعدادات من لوحة تحكم محمية، ولا يحتاج لتعديل الكود.

**ما لا يشمله الإصدار الأول:** بوابة دفع إلكتروني، وحسابات عملاء، وتسجيل عام للأدمن، وإشعارات بريد أو SMS أو Push، وتقارير مبيعات تقديرية.

## 2. حالة المشروع عند البدء

| البند | الحالة |
|---|---|
| مجلد المشروع | `G:\الكلية\مواقع الكترونيه\abak elkhalig`، لا يحتوي إلا ملفين: `logo.png` (1645×659) و`icon.png` (658×655). كلاهما PNG غير شفاف، الأول بخلفية كريمية والثاني بخلفية بيضاء |
| package.json / كود | لا يوجد، والمشروع جديد |
| Git | غير موجود، ولن يُنشأ بقرار من المالك |
| Node.js | v24.15.0 |
| مديرو الحزم | npm 11.12.1 (المعتمد)، pnpm 10.33.0 متاح |
| نظام التشغيل | Windows 11 Pro |

## 3. القرارات الأساسية

القرارات المعتمدة من المالك:

| # | القرار | القيمة | ADR |
|---|---|---|---|
| D1 | اسم المتجر | **عطور عبق الخليج** (مطابق للوجو)، والمعرّف التقني `abak-elkhalig` | [0001](docs/decisions/0001-store-identity-and-locale.md) |
| D2 | الدولة والعملة | مصر، الجنيه المصري (EGP)، هواتف `01xxxxxxxxx`، وقائمة المحافظات الـ27 | [0001](docs/decisions/0001-store-identity-and-locale.md) |
| D3 | إدارة الإصدارات | بدون Git، والنشر على Vercel عبر CLI | [0002](docs/decisions/0002-no-git-vercel-cli.md) |
| D4 | سجل الطلبات | حفظ طلب أوليّ (OrderRequest) عند فتح واتساب بدون خصم مخزون، والأدمن يؤكده يدويًا | [0003](docs/decisions/0003-order-requests.md) |

القرارات التقنية (تُعتمد مع الخطة):

| # | القرار | ADR |
|---|---|---|
| T1 | npm مديرًا للحزم مع تثبيت دقيق للإصدارات | [0004](docs/decisions/0004-stack-and-versions.md) |
| T2 | Next.js App Router + TypeScript strict + Tailwind v4 + shadcn/ui + Mongoose + Zod | [0004](docs/decisions/0004-stack-and-versions.md) |
| T3 | مصادقة بجلسات في قاعدة البيانات + Argon2id (`@node-rs/argon2`) | [0005](docs/decisions/0005-auth-db-sessions.md) |
| T4 | MongoDB replica set ومعاملات لعمليات المخزون | [0006](docs/decisions/0006-inventory-concurrency.md) |
| T5 | رفع الصور عبر الخادم مع فحص magic bytes، بحد أقصى 4MB | [0007](docs/decisions/0007-server-side-image-upload.md) |
| T6 | بحث عربي على حقل `searchText` مُطبَّع | [0008](docs/decisions/0008-arabic-search.md) |
| T7 | Rate limiting مخزّن في MongoDB | [0005](docs/decisions/0005-auth-db-sessions.md) |
| T8 | الأسعار بالقروش (أعداد صحيحة) | [0009](docs/decisions/0009-money-in-piasters.md) |
| T9 | الإصدارات المثبتة فعليًا (TypeScript 6.0.3، ESLint 9.39.5 بسبب التوافق) | [0010](docs/decisions/0010-pinned-versions-phase1.md) |

## 4. المراحل

القاعدة الثابتة: **مرحلة واحدة في كل مرة**. في نهاية كل مرحلة أشغّل `lint` ثم `typecheck` ثم `test` ثم `build` (وأيضًا `test:e2e` من المرحلة 3 وما بعدها)، وأقدّم تقريرًا من 13 بندًا، وأحدّث [docs/PROGRESS.md](docs/PROGRESS.md)، ثم أتوقف حتى يوافق المالك صراحةً.

### المرحلة 0 — التحليل والتخطيط
- فحص المجلد والبيئة.
- كتابة: PROJECT_PLAN وARCHITECTURE وACCEPTANCE_CRITERIA وdocs/SECURITY وTESTING وDATABASE وDEPLOYMENT وPROGRESS وdocs/decisions.
- لا كود ولا تثبيت حزم.

### المرحلة 1 — تأسيس المشروع
- التحقق من أحدث الإصدارات المستقرة المتوافقة عبر `npm view` ثم إنشاء مشروع Next.js (App Router، `src/`، TypeScript strict).
- Tailwind v4 وDesign Tokens (ألوان وخطوط ومسافات وزوايا وظلال) في `src/styles/globals.css`.
- إعداد shadcn/ui بتكوين RTL. تُضاف المكونات عند الحاجة فقط.
- خط Tajawal عبر `next/font/google`، وضبط `<html lang="ar" dir="rtl">`.
- ESLint (إعداد Next + قواعد TypeScript الصارمة: منع `any` و`ts-ignore`) وPrettier.
- Vitest (unit + integration) وPlaywright (E2E)، مع إعداد `mongodb-memory-server` بوضع replica set.
- `src/lib/env.ts` للتحقق من متغيرات البيئة بـZod، و`.env.example`.
- `src/lib/db.ts` لاتصال Mongoose مخزّن عالميًا (آمن مع HMR وServerless).
- `scripts/gen-brand-assets.ts`: ينسخ اللوجو والأيقونة الأصليين إلى `assets/brand/` ويولد منهما `app/icon.png` و`app/apple-icon.png` و`favicon.ico` و`public/brand/logo.webp`.
- الأغلفة الأساسية: Layout المتجر، Layout الإدارة الفارغ، صفحات `not-found` و`error` و`loading`، ومسار `/api/health`.
- أوامر npm: `dev` و`build` و`start` و`lint` و`typecheck` و`test` و`test:watch` و`test:e2e` و`format`.

### المرحلة 2 — نماذج البيانات
- نماذج Mongoose: Product (مع ProductVariant وProductImage كـsubdocuments)، Category، Brand، InventoryMovement، Notification، Admin، Session، StoreSettings، OrderRequest، Counter، RateLimit، MediaAsset.
- مخططات Zod المقابلة في `src/schemas/`.
- الفهارس وقواعد التحقق وقواعد الحذف (انظر [docs/DATABASE.md](docs/DATABASE.md)).
- `lib/arabic-normalize.ts` و`lib/slug.ts` و`lib/money.ts` مع اختباراتها.
- اختبارات النماذج واختبار اتصال قاعدة البيانات.
- `scripts/seed-dev.ts`: بيانات تطوير، ويرفض العمل إذا كانت `NODE_ENV=production`.

### المرحلة 3 — واجهة المتجر
- Header (الشعار، التنقل، البحث، السلة مع العدد) وFooter (السياسات والتواصل من الإعدادات).
- الصفحة الرئيسية: Hero، التصنيفات، المميز، الأحدث، العروض، قسم تعريفي. كل البيانات من قاعدة البيانات.
- `/perfumes`: Grid، وبحث، وفلاتر (تصنيف، ماركة، سعر، توفر)، وترتيب، وPagination على الخادم عبر searchParams، وعدد النتائج، وزر «إزالة الفلاتر».
- `/categories/[slug]` و`/brands` و`/brands/[slug]`.
- `/perfumes/[slug]`: معرض الصور، والأحجام (السعر والتوفر يتغيران حسب الحجم)، والكمية، والإضافة للسلة، وزر الطلب عبر واتساب، والمنتجات المرتبطة، وBreadcrumbs.
- `/search` مع الاقتراحات.
- `/cart`: سلة في localStorage، تُعاد مزامنة أسعارها وتوفرها من الخادم.
- حالات التحميل والفراغ والخطأ، والتصميم المتجاوب.
- E2E: التصفح، والفلترة، واختيار الحجم، والسلة.

### المرحلة 4 — لوحة الإدارة
- `scripts/create-admin.ts` (`npm run admin:create`): يطلب اسم المستخدم وكلمة المرور تفاعليًا، ويرفض إن كان هناك أدمن موجود.
- صفحة الدخول، والجلسات، وتسجيل الخروج، و`requireAdmin()`، وrate limit للدخول.
- Dashboard: إحصائيات المنتجات والمخزون والتنبيهات فقط، دون أي أرقام مبيعات.
- CRUD للمنتجات: الأحجام، والنشر وإيقافه، والتمييز، والعرض، والترتيب، وSEO.
- CRUD للتصنيفات (مع منع حذف المرتبط) وللماركات.
- إعدادات المتجر.
- مكون إدارة الصور (اختيار ومعاينة وترتيب واختيار الرئيسية). يعمل في هذه المرحلة على أساس الخدمة، والتكامل الكامل مع Cloudinary في المرحلة 5.

### المرحلة 5 — Cloudinary والمخزون
- `server/media.service.ts`: رفع ورفض واستبدال وحذف آمن، مع MediaAsset وتنظيف الصور المعلقة.
- `server/inventory.service.ts`: تعديل وإضافة وتصحيح جرد بشكل ذري، مع سجل حركات وتنبيهات بلا تكرار.
- صفحات المخزون وسجل الحركات والتنبيهات في الإدارة.
- اختبارات التزامن.

### المرحلة 6 — واتساب والطلبات الأولية
- `server/orders.service.ts`: مراجعة السلة على الخادم، وإنشاء OrderRequest برقم مرجعي، وبناء الرسالة والرابط.
- نموذج بيانات العميل (المحافظات المصرية، والتحقق من الهاتف).
- صفحة «الطلبات» في الإدارة: عرض، وتأكيد (يخصم المخزون داخل معاملة)، وإلغاء (يعيد المخزون إن كان الطلب مؤكدًا)، وحذف بيانات العميل الشخصية.
- توثيق الفرق بين فتح واتساب وإرسال الرسالة وتأكيد الطلب.

### المرحلة 7 — SEO والأمان
- Metadata لكل صفحة، وCanonical، و`sitemap.ts`، و`robots.ts`، وOpen Graph، وJSON-LD (Product وBreadcrumbList وOrganization).
- `noindex` للإدارة وللصفحات المفلترة غير الأساسية.
- Security Headers وCSP، ومراجعة حماية كل Action وRoute، و`npm audit`، وفحص تسريب الأسرار.

### المرحلة 8 — الاختبارات الشاملة
- استكمال كامل مصفوفة [docs/TESTING.md](docs/TESTING.md).
- اختبارات RTL والاستجابة على 3 مقاسات.
- مراجعة Lighthouse (الأداء وإمكانية الوصول وSEO).
- مراجعة أخطاء Console والخادم.

### المرحلة 9 — النشر والتسليم
- Vercel (CLI) وVPS (Node 24 وPM2 وNginx وHTTPS)، وAtlas، وCloudinary.
- `.env.example` نهائي، ودليل التشغيل، والنسخ الاحتياطي والاستعادة، وقائمة ما قبل الإطلاق.
- اختبار البيئة المنشورة.

## 5. المخاطر

| الخطر | الأثر | المعالجة |
|---|---|---|
| اللوجو غير شفاف (خلفية كريمية) | يظهر كمستطيل على الخلفيات الداكنة | الهيدر عاجي اللون. في الفوتر الداكن يوضع الشعار داخل إطار كريمي مقصود. **نسخة شفافة أو SVG من المالك ستكون أفضل** |
| ملفات اللوجو كبيرة (1.2MB و0.6MB) | بطء التحميل | نولّد منها نسخًا محسنة (WebP بعرض مناسب) ونحتفظ بالأصل دون تعديل |
| عدم وجود Git | صعوبة التراجع عن التغييرات، ولا يمكن ربط Vercel بمستودع | النشر عبر Vercel CLI. أنصح بالنسخ الاحتياطي اليدوي للمجلد بين المراحل |
| المعاملات تتطلب replica set | فشل المعاملات على MongoDB مستقلة (standalone) | نشترط Atlas أو replica set. فحص بدء التشغيل يعطي رسالة خطأ واضحة |
| حد جسم الطلب في Vercel (4.5MB) | فشل رفع الصور الكبيرة | حد 4MB مع رسالة واضحة، وضغط اختياري في المتصفح قبل الرفع |
| صفحات العملاء وبياناتهم الشخصية في OrderRequest | خطر خصوصية | حماية الإدارة، وإتاحة حذف البيانات الشخصية، وسياسة احتفاظ موثقة |
| تغيّر واجهات Next.js بين الإصدارات (مثل middleware/proxy) | أخطاء في البناء | التحقق من توثيق الإصدار الفعلي في المرحلة 1 وتسجيل ما يُعتمد |
| تطبيع البحث العربي بـregex | بطء مع كتالوج كبير جدًا | فهرس و`limit` في الاستعلام. الترقية إلى Atlas Search ممكنة لاحقًا |

## 6. أوامر الجودة (تُنشأ في المرحلة 1)

```
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # Vitest (unit + integration)
npm run test:e2e    # Playwright
npm run build       # next build
```

## 7. المستندات

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/PROGRESS.md](docs/PROGRESS.md)
- [docs/decisions/](docs/decisions/)
