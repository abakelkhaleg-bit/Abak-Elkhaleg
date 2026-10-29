# معمارية متجر «عطور عبق الخليج»

## 1. نظرة عامة

```
                ┌──────────────────────────── Next.js (App Router) ────────────────────────────┐
 المتصفح  ───►  │  Server Components (صفحات المتجر والإدارة)                                  │
 (RTL UI)       │  Client Components (السلة، معرض الصور، النماذج التفاعلية فقط)                │
                │        │                         │                                           │
                │        ▼                         ▼                                           │
                │  features/*/actions.ts      app/api/* (uploads, orders, health)              │
                │  (Server Actions رفيعة: requireAdmin → Zod → خدمة)                          │
                │        │                                                                     │
                │        ▼                                                                     │
                │  server/*  (طبقة الخدمات — server-only)                                     │
                │   catalog · inventory · orders · media · settings · auth · rate-limit        │
                │        │                              │                                      │
                └────────┼──────────────────────────────┼──────────────────────────────────────┘
                         ▼                              ▼
                 MongoDB (Atlas / replica set)     Cloudinary (الصور)
                   عبر Mongoose models/*            عبر SDK على الخادم فقط
```

## 2. الطبقات والمسؤوليات

| الطبقة | المجلد | المسؤولية | ممنوع عليها |
|---|---|---|---|
| العرض | `src/app/**`، `src/components/**` | جلب البيانات عبر الخدمات (Server Components) والعرض | منطق العمل، والوصول المباشر للنماذج من Client |
| المجالات | `src/features/<domain>/` | Server Actions ومكونات خاصة بالمجال | منطق قاعدة البيانات المباشر (تستدعي الخدمات فقط) |
| الخدمات | `src/server/` | منطق العمل والمعاملات والتحقق من الصلاحيات الداخلية | الاعتماد على React |
| البيانات | `src/models/` | تعريف المخططات والفهارس والتحقق على مستوى القاعدة | منطق عمل متعدد النماذج |
| التحقق | `src/schemas/` | مخططات Zod مشتركة بين الخادم والعميل | الوصول إلى قاعدة البيانات |
| أدوات | `src/lib/` | db، env، arabic-normalize، money، slug، whatsapp، cloudinary-url | أسرار في ملفات يستوردها Client |
| إعدادات ثابتة | `src/config/` | site.ts (الثوابت غير الحساسة)، governorates.ts | رقم واتساب أو أي بيانات تُدار من لوحة التحكم |

قواعد صارمة:
- كل ملف في `src/server/` يبدأ بـ`import "server-only"`، فيفشل البناء لو استورده Client Component.
- كل Server Action إدارية تبدأ بـ`await requireAdmin()`، ثم `schema.safeParse(input)`، ثم تستدعي الخدمة، ثم `revalidateTag`. عدد هذه الأسطر قليل عن قصد.
- النتيجة الموحدة للعمليات: `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } }`.
- رسائل الخطأ الظاهرة للمستخدم بالعربية. التفاصيل التقنية تُسجل في Logs الخادم فقط، ولا يُسجل فيها أي سر.

## 3. هيكل الملفات

```
abak elkhalig/
├─ assets/brand/                 الأصول الأصلية (logo.png, icon.png) — لا تُعدّل
├─ public/brand/                 نسخ محسنة مولدة
├─ scripts/
│  ├─ gen-brand-assets.ts
│  ├─ create-admin.ts            npm run admin:create
│  └─ seed-dev.ts                npm run seed:dev (يرفض في production)
├─ src/
│  ├─ app/
│  │  ├─ (store)/
│  │  │  ├─ layout.tsx           Header + Footer
│  │  │  ├─ page.tsx             الرئيسية
│  │  │  ├─ perfumes/page.tsx    جميع العطور (فلترة/ترتيب/صفحات عبر searchParams)
│  │  │  ├─ perfumes/[slug]/page.tsx
│  │  │  ├─ categories/[slug]/page.tsx
│  │  │  ├─ brands/page.tsx, brands/[slug]/page.tsx
│  │  │  ├─ search/page.tsx
│  │  │  ├─ cart/page.tsx
│  │  │  └─ policies/[slug]/page.tsx  (سياسة الشحن/الاستبدال/الخصوصية — محتوى من الإعدادات)
│  │  ├─ admin/
│  │  │  ├─ login/page.tsx
│  │  │  └─ (panel)/             layout يتحقق من الجلسة
│  │  │     ├─ page.tsx          Dashboard
│  │  │     ├─ products/ (list, new, [id])
│  │  │     ├─ categories/, brands/, inventory/, notifications/, orders/, settings/
│  │  ├─ api/
│  │  │  ├─ admin/uploads/route.ts   رفع الصور (multipart) — محمي
│  │  │  ├─ cron/cleanup-media/route.ts   تنظيف الصور المعلقة — محمي بـCRON_SECRET
│  │  │  └─ health/route.ts
│  │  ├─ sitemap.ts, robots.ts, not-found.tsx, error.tsx, global-error.tsx
│  │  ├─ icon.png, apple-icon.png
│  │  └─ layout.tsx              <html lang="ar" dir="rtl"> + الخط
│  ├─ components/ui/             shadcn
│  ├─ components/store/          ProductCard, PriceTag, Gallery, SizeSelector, ...
│  ├─ components/admin/          DataTable, ImageManager, ConfirmDialog, ...
│  ├─ features/
│  │  ├─ auth/ (actions.ts: login, logout)
│  │  ├─ catalog/ (admin actions للمنتجات/التصنيفات/الماركات)
│  │  ├─ cart/ (cart-store.ts [client], actions.ts: reviewCart)
│  │  ├─ orders/ (actions.ts: createOrderRequest, confirm, cancel, purgePii)
│  │  ├─ inventory/ (actions.ts: adjustStock, ...)
│  │  ├─ media/ (actions.ts: attach, reorder, remove)
│  │  └─ settings/ (actions.ts)
│  ├─ server/
│  │  ├─ auth/ (password.ts, session.ts, require-admin.ts)
│  │  ├─ catalog.service.ts, inventory.service.ts, orders.service.ts,
│  │  ├─ media.service.ts, settings.service.ts, notifications.service.ts
│  │  ├─ rate-limit.ts, cloudinary.ts
│  ├─ models/                    Product, Category, Brand, InventoryMovement, Notification,
│  │                             Admin, Session, StoreSettings, OrderRequest, Counter,
│  │                             RateLimit, MediaAsset
│  ├─ schemas/                   product.ts, category.ts, brand.ts, inventory.ts, order.ts, settings.ts, auth.ts
│  ├─ lib/                       db.ts, env.ts, arabic-normalize.ts, money.ts, slug.ts, whatsapp.ts, image-url.ts
│  ├─ config/                    site.ts, governorates.ts
│  ├─ hooks/                     useCart, ...
│  ├─ types/
│  ├─ styles/globals.css         Design Tokens (@theme)
│  └─ proxy.ts                   فحص مبدئي لمسارات /admin (Next 16 أعاد تسمية middleware إلى proxy — ADR 0010)
├─ tests/
│  ├─ unit/, integration/, e2e/
│  └─ setup/ (mongo-memory-replset.ts, cloudinary-mock.ts)
└─ docs/
```

**الفرق عن الهيكل المقترح في الطلب:** أضفنا `features/` لتجميع Server Actions ومكونات كل مجال بجانب بعض، وأبقينا `server/` لطبقة الخدمات المشتركة. هكذا لا يُكرر منطق العمل، لأن الـActions تستدعي الخدمات فقط.

## 4. تدفقات رئيسية

### 4.1 تصفح المنتجات
1. `perfumes/page.tsx` (Server Component) يقرأ `searchParams`، وهي: `q` و`category` و`brand` و`min` و`max` و`inStock` و`sort` و`page`.
2. يتحقق منها بـZod. القيم غير الصالحة تُعامل كأنها غير موجودة.
3. يستدعي `catalog.service.listPublished(filters)`. الخدمة تبني استعلامًا مفهرسًا مع `limit` (24 منتجًا) و`skip`، وتعيد `{items, total}`. الإسقاط (projection) يحمل حقول البطاقة فقط.
4. الكاش: `unstable_cache` أو `"use cache"` حسب إصدار Next، مع وسوم `products` و`product:<id>` و`categories` و`settings`. أي تعديل إداري يستدعي `revalidateTag` المناسب.

### 4.2 السلة
- الحالة في `localStorage` بالمفتاح `abak-cart-v1`، والمحتوى `[{productId, variantId, qty}]` فقط. لا تُخزن أسعار ولا أسماء.
- صفحة السلة تستدعي `reviewCart(items)`. الخادم يعيد لكل بند: الاسم، والصورة، والحجم، والسعر الحالي، والمتاح، والحالة (`ok | unavailable | qty_adjusted | removed`).
- الإضافة للسلة **لا تمس المخزون**.

### 4.3 الطلب عبر واتساب
1. يملأ العميل نموذج الطلب: الاسم، والهاتف، والمحافظة، والعنوان، والملاحظات. التحقق يتم بـZod في العميل وفي الخادم.
2. `createOrderRequest` تعمل كالتالي:
   - تطبق rate limit.
   - تتحقق من المدخلات.
   - تعيد قراءة المنتجات المنشورة من القاعدة.
   - تتحقق أن كل variant موجود ومتاح، وأن الكمية ≤ المخزون.
   - تحسب الإجمالي بالقروش.
   - تحجز رقمًا مرجعيًا بـ`$inc` على `counters`.
   - تحفظ OrderRequest بالحالة `opened_in_whatsapp`.
   - تبني رسالة عربية فيها الرقم المرجعي، ثم رابط `https://wa.me/<settings.whatsappNumber>?text=<encodeURIComponent(msg)>`.
3. العميل يحصل على `{reference, url}`. الواجهة تنتقل إلى الرابط بـ`window.location.assign(url)`، وتعرض قبلها وبعدها: «تم تجهيز رسالتك في واتساب — الطلب لا يُرسل حتى تضغط إرسال داخل واتساب، وسيتواصل معك المتجر للتأكيد».
4. لا يُخصم أي مخزون في هذه الخطوة.
5. الأدمن يراجع الطلب من «الطلبات» بعد التواصل. «تأكيد» يخصم المخزون داخل معاملة ([docs/DATABASE.md §المعاملات](docs/DATABASE.md)). «إلغاء» يغلق الطلب.

### 4.4 تعديل المخزون
`inventory.service.adjust({productId, variantId, type, delta | newQuantity, reason})` تعمل داخل معاملة واحدة:
1. تحديث شرطي ذري على الحجم المطلوب: `stockQuantity + delta ≥ 0`.
2. إضافة `InventoryMovement` بالقيمتين السابقة والجديدة.
3. `notifications.service.syncForVariant()`، وهي:
   - تفتح تنبيه `low_stock` أو `out_of_stock` إن لم يكن مفتوحًا.
   - أو تغلقه إن ارتفع المخزون فوق الحد.
4. `revalidateTag('product:<id>')`.

### 4.5 الصور
1. يختار الأدمن ملفًا، فيُرسل إلى `POST /api/admin/uploads` (multipart).
2. الخادم يتحقق من الجلسة وOrigin، ثم من الحجم (≤ 4MB)، ثم من نوع الملف الفعلي بالـmagic bytes.
3. يرفع الملف إلى Cloudinary في المجلد `abak-elkhalig/<products|categories|brands|settings>`.
4. ينشئ `MediaAsset{status:'pending'}` ويعيد `{publicId, secureUrl, width, height}`.
5. عند حفظ المنتج تتحول الأصول المستخدمة إلى `attached`. الصور التي أُزيلت من المنتج تُحذف من Cloudinary **بعد نجاح الحفظ فقط**، وبشرط ألا يكون الـpublicId مستخدمًا في أي مكان آخر.
6. مهمة تنظيف (Route محمي يُستدعى يدويًا أو من cron على VPS أو Vercel Cron) تحذف الأصول التي بقيت `pending` أكثر من 24 ساعة.
7. التسليم للعرض: `lib/image-url.ts` يبني روابط بتحويلات Cloudinary جاهزة:
   - `card`: `w_480,h_600,c_fill`.
   - `detail`: `w_1000`.
   - `thumb`: `w_160`.
   - `og`: `w_1200,h_630,c_pad`.
   - كلها مع `f_auto,q_auto`.
   - تُستخدم مع `next/image` عبر loader مخصص لـCloudinary.
   - صورة بديلة محلية `public/brand/placeholder.webp` عند غياب الصورة.

## 5. حدود Server وClient

Client Components مسموحة **فقط** لهذه المكونات:
- السلة (المتجر والمكون والعداد في الهيدر).
- محدد الحجم والكمية وزر الإضافة.
- معرض الصور.
- قائمة الموبايل.
- اقتراحات البحث.
- نموذج الطلب.
- نماذج الإدارة.
- مدير الصور.
- مكون Toast.

كل ما سواها Server Components.

## 6. المصادقة (ملخص — التفاصيل في docs/SECURITY.md)
- `middleware`/`proxy`: إن لم توجد Cookie جلسة على `/admin/**` (عدا `/admin/login`) يحوّل إلى صفحة الدخول. هذا فحص مبدئي فقط.
- `requireAdmin()`:
  - تقرأ Cookie الجلسة، وتحسب SHA-256 للتوكن، وتبحث عن جلسة صالحة.
  - إن وُجدت تحدّث `lastSeenAt` (مرة كل 5 دقائق كحد أقصى) وتعيد الأدمن.
  - إن لم توجد ترمي خطأ، فتحوّل الصفحات إلى الدخول، وترجع الـActions `UNAUTHORIZED`.
- يُستدعى في: layout الإدارة، وكل صفحة إدارة، وكل Server Action إدارية، وكل Route إداري.

## 7. التصميم (Design System)

### الألوان (Tokens)

| Token | القيمة | الاستخدام |
|---|---|---|
| `--color-ivory` | `#FBF6EC` | الخلفية الرئيسية |
| `--color-cream` | `#F3EAD8` | البطاقات والأقسام |
| `--color-charcoal` | `#1C1915` | النص الأساسي والأزرار الأساسية |
| `--color-espresso` | `#3E2A17` | العناوين والفوتر |
| `--color-gold` | `#B8862F` | الإبراز والحدود والأيقونات |
| `--color-gold-text` | `#8A6420` | نص ذهبي يحقق تباين AA على الخلفية العاجية |
| `--color-success` | `#2F7D4F` | النجاح |
| `--color-warning` | `#B26B00` | التحذير |
| `--color-danger` | `#B3261E` | الخطأ |

### الخط والطباعة
- Tajawal بالأوزان 400 و500 و700 و800، مع `display: swap` و`subsets: ['arabic']`.
- مقياس الطباعة: 14 ← 16 ← 18 ← 20 ← 24 ← 32 ← 40.

### المسافات والأشكال
- المسافات بنظام 4px.
- الزوايا: `--radius-sm` 6px، و`--radius-md` 10px، و`--radius-lg` 16px.
- ظلال ناعمة بحد أقصى مستويين.

### الحركة
- انتقالات من 150 إلى 200ms فقط.
- تُعطَّل بالكامل تحت `prefers-reduced-motion`.

### قواعد RTL
- خصائص منطقية فقط: `ms-*` و`me-*` و`ps-*` و`pe-*` و`start-*` و`end-*` و`text-start`.
- ESLint يمنع `ml-*` و`mr-*` و`left-*` و`right-*` في className. القاعدة تُضاف في المرحلة 1.
- الأيقونات الاتجاهية (أسهم التالي والسابق، والـchevron) تُعكس بـ`rtl:rotate-180`. الأيقونات غير الاتجاهية لا تُعكس، مثل السلة والبحث والهاتف وواتساب.
- الأرقام والأسعار:
  - تُنسق بـ`Intl.NumberFormat('ar-EG', {style:'currency', currency:'EGP'})`.
  - رقم الهاتف يُعرض داخل `<bdi dir="ltr">`.
  - الأرقام الهندية أم العربية؟ نستخدم الافتراضي `ar-EG`، وتُراجع في المرحلة 3.

### الشعار
- الهيدر يستخدم `public/brand/logo.webp` على الخلفية العاجية.
- الفوتر الداكن يضع الشعار داخل إطار كريمي، لأن الشعار غير شفاف.

## 7.1 قواعد التوجيه وصفحات 404 (تقررت في المرحلة 3)
- صفحات المتجر ديناميكية (`dynamic = "force-dynamic"` في `(store)/layout.tsx`)، لأن الأسعار والتوفر يجب أن تكون حالية. الكاش بالوسوم يأتي مع عمليات الإدارة في المرحلة 4.
- **لا `loading.tsx` على مستوى المسارات** التي قد تستدعي `notFound()`. حدود التحميل تجعل الاستجابة تبدأ بحالة 200، فتخرج صفحة 404 بحالة خاطئة (soft 404). حالات التحميل تكون داخل المكونات التفاعلية.
- الروابط غير المعروفة تمر عبر `(store)/[...missing]/page.tsx`، فتُعرض `(store)/not-found.tsx` داخل layout المتجر. أما `app/not-found.tsx` الجذرية فثابتة ولا تقرأ قاعدة البيانات، وهي للمسارات خارج المتجر.
- صور `next/image` تمر عبر `src/lib/image-loader.ts`:
  - صور Cloudinary تُحوَّل في شبكة Cloudinary (`f_auto,q_auto,w_*`).
  - الصور المحلية تُقدَّم كما هي.

## 8. الأداء
- Server Components افتراضيًا، وأقل قدر من JavaScript على صفحات المنتجات.
- Pagination على الخادم، ولا يُحمَّل كل الكتالوج أبدًا.
- `next/image` مع Cloudinary loader، و`priority` لصورة الـHero وصورة المنتج الرئيسية فقط.
- فهارس لكل نمط استعلام في المتجر (انظر DATABASE.md).
- الكاش بالوسوم، وإعادة التحقق عند التعديل فقط.

## 9. مستندات ذات صلة
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/decisions/](docs/decisions/)
