# الأمان — متجر «عطور عبق الخليج»

## 1. نموذج التهديدات (ملخص)

| الأصل | التهديد | الضابط |
|---|---|---|
| لوحة الإدارة | تخمين كلمة المرور | Argon2id + rate limit + رسائل خطأ عامة |
| الجلسات | سرقة الكوكي أو تثبيت الجلسة (fixation) | HttpOnly، Secure، SameSite، توكن جديد عند كل دخول، hash في القاعدة |
| عمليات الكتابة | CSRF | SameSite=Lax + فحص Origin (Server Actions تلقائيًا + Route Handlers يدويًا) |
| الأسعار والمخزون | تلاعب العميل بالأسعار والكميات | الخادم يعيد القراءة والحساب ولا يثق بأي سعر أو إجمالي قادم من المتصفح |
| رفع الصور | ملفات خبيثة أو ضخمة | فحص magic bytes، وقائمة أنواع مسموحة، وحد 4MB، ورفع من الخادم فقط |
| بيانات العملاء (OrderRequest) | تسريب البيانات الشخصية | خلف المصادقة فقط، حذف PII متاح، سياسة احتفاظ، لا PII في Logs |
| الأسرار | تسريبها في الكود أو الحزمة | `.env*` في التجاهل، `server-only`، لا `NEXT_PUBLIC_` للأسرار، فحص قبل كل مرحلة |
| إنشاء الطلبات | سبام أو إغراق القاعدة | rate limit لكل IP + Zod + حد عدد البنود (≤ 30) والكمية (≤ 20 لكل بند) |
| المحتوى | XSS | React يهرب المخرجات، لا `dangerouslySetInnerHTML` إلا لـJSON-LD عبر `JSON.stringify` مع تهريب `<`، CSP |
| البحث | Regex injection / ReDoS | تهريب كل مدخلات البحث قبل بناء الـregex، وحد طول 64 حرفًا |

## 2. المصادقة

### 2.1 حساب الأدمن الأول
- لا توجد صفحة تسجيل ولا كلمة مرور افتراضية في الكود.
- الأمر `npm run admin:create` يُشغَّل من الخادم أو الجهاز المحلي، متصلًا بـ`MONGODB_URI`:
  - يطلب اسم المستخدم، وكلمة المرور مرتين، دون أن تظهر على الشاشة.
  - شروط كلمة المرور: 12 حرفًا على الأقل، وألا تكون مساوية لاسم المستخدم.
  - يرفض العمل إن كان هناك أدمن موجود، والفهرس الفريد `singleton` يضمن ذلك على مستوى القاعدة أيضًا.
- `npm run admin:reset-password`:
  - يُشغَّل محليًا أو على الخادم فقط.
  - يغيّر كلمة المرور ويحدّث `passwordChangedAt`.
  - يحذف كل الجلسات.

### 2.2 كلمات المرور
- Argon2id عبر `@node-rs/argon2` بالمعاملات: `memoryCost 19456 KiB`، و`timeCost 2`، و`parallelism 1` (توصية OWASP)، وتُراجع في المرحلة 4 حسب زمن الاستجابة.
- كلمة المرور لا تُسجل ولا تُعاد في أي استجابة ولا تُخزن نصًا.
- عند فشل الدخول تظهر رسالة عامة واحدة: «اسم المستخدم أو كلمة المرور غير صحيحة».
- إن لم يوجد المستخدم يُنفَّذ تحقق hash وهمي، فيبقى زمن الاستجابة متقاربًا ولا يكشف وجود الحساب.

### 2.3 الجلسات
| البند | القيمة |
|---|---|
| التوكن | `crypto.randomBytes(32)` بترميز base64url |
| التخزين في القاعدة | `sha256(token)` فقط |
| اسم الكوكي | `__Host-abak_session` في الإنتاج (يتطلب Secure و`Path=/` وبدون Domain)، و`abak_session` في التطوير |
| خصائص الكوكي | `HttpOnly; SameSite=Lax; Path=/; Secure` (في الإنتاج)، و`Max-Age` = 7 أيام |
| الانتهاء | مطلق بعد 7 أيام (TTL)، أو بعد 24 ساعة خمول، أو إذا كان `createdAt < admin.passwordChangedAt` |
| الدخول | يُنشأ توكن جديد دائمًا (منع fixation) |
| الخروج | Server Action تحذف سجل الجلسة من القاعدة **و**تمسح الكوكي، فيصبح التوكن القديم باطلًا فورًا |
| انتهاء الجلسة أثناء العمل | الـActions تعيد `UNAUTHORIZED`، والواجهة تعرض «انتهت الجلسة، سجّل الدخول مجددًا» وتحوّل إلى `/admin/login?next=…` |

قيمة `next` تُقبل فقط إن كانت مسارًا داخليًا يبدأ بـ`/admin`، لمنع Open Redirect.

### 2.4 التفويض
- `requireAdmin()` يُستدعى في **كل**:
  - layout وصفحة إدارة (Server Components).
  - Server Action إدارية.
  - Route Handler إداري (`/api/admin/**`).
- `middleware`/`proxy` للتحويل المبدئي فقط، **ولا يُعتمد عليه كحماية**.
- إخفاء الروابط في الواجهة ليس حماية.
- اختبار تكاملي يمر على **كل** Server Actions الإدارية المصدّرة ويتأكد أنها ترفض الاستدعاء دون جلسة. القائمة تُجمع آليًا من `features/*/actions.ts`.

## 3. Rate Limiting
| الحاوية | المفتاح | الحد |
|---|---|---|
| `login` | sha256(ip + username) | 5 محاولات / 15 دقيقة |
| `login-ip` | sha256(ip) | 20 محاولة / 15 دقيقة |
| `order` | sha256(ip) | 10 طلبات / 10 دقائق |
| `upload` | adminId | 60 رفعًا / 10 دقائق |
| `search-suggest` | sha256(ip) | 60 / دقيقة |

- التنفيذ في `server/rate-limit.ts` على مجموعة `rate_limits` بعملية `$inc` ذرية مع TTL.
- مصدر الـIP:
  - على Vercel: الرأس `x-forwarded-for` (أول قيمة).
  - على VPS: Nginx يضبط `X-Real-IP`، والتطبيق يثق فقط بالرأس الذي يحدده `TRUSTED_PROXY_HEADER` في البيئة.
- عند تجاوز الحد تظهر رسالة عربية ويُرسل `Retry-After`.

## 4. CSRF
- Server Actions: Next.js يقارن رأس `Origin` بـ`Host` تلقائيًا. ونضبط `serverActions.allowedOrigins` فقط إن احتجنا دومينًا إضافيًا.
- Route Handlers التي تكتب (`POST /api/admin/uploads`):
  - فحص صريح بأن `Origin` يطابق `APP_URL`.
  - مع كوكي `SameSite=Lax`.
- لا توجد عمليات كتابة عبر `GET`.

## 5. Security Headers (عبر `next.config` → `headers()`)
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<per-request>' (أو 'unsafe-inline' مؤقتًا إن تعارض مع إصدار Next — يُوثق القرار في المرحلة 7);
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://res.cloudinary.com;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload   (الإنتاج فقط)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: DENY
```
- لوحة الإدارة تضيف `X-Robots-Tag: noindex, nofollow` و`Cache-Control: no-store`.
- `poweredByHeader: false`.

## 6. التحقق من المدخلات
- **كل** مدخل من العميل يمر عبر Zod على الخادم: نماذج، وsearchParams، وparams، وmultipart.
- معرفات ObjectId يُتحقق من صيغتها قبل الاستعلام.
- لا تمرير لكائنات المستخدم مباشرة إلى استعلامات Mongo، لمنع NoSQL injection مثل `{$gt: ""}`.
- `mongoose.set('sanitizeFilter', true)` كطبقة إضافية.
- الأسعار والإجماليات والمخزون في الطلب تُحسب على الخادم فقط.
- روابط التواصل الاجتماعي والـhref في البانرات تُقبل فقط إن كانت `https://` أو مسارًا داخليًا يبدأ بـ`/`.

## 7. Cloudinary
- `CLOUDINARY_API_SECRET` على الخادم فقط، ولا يُعرض للمتصفح بأي شكل.
- الرفع من الخادم بعد التحقق من:
  - الجلسة.
  - Origin.
  - الحجم ≤ 4MB (يُفحص من `Content-Length` ثم من الحجم الفعلي).
  - النوع الفعلي بالـmagic bytes عبر مكتبة `file-type`: JPEG وPNG وWebP وAVIF فقط. SVG مرفوض لاحتمال احتوائه على سكربت.
- أي خطأ من Cloudinary يُسجَّل دون بيانات الاعتماد، ويُعرض للمستخدم: «تعذر رفع الصورة، حاول مرة أخرى». لا يتغير شيء في بيانات المنتج.

## 8. الأسرار ومتغيرات البيئة
| المتغير | سري؟ | ملاحظة |
|---|---|---|
| `MONGODB_URI` | نعم | |
| `CLOUDINARY_CLOUD_NAME` | لا | يُستخدم لبناء روابط الصور |
| `CLOUDINARY_API_KEY` | نعم (على الخادم فقط) | |
| `CLOUDINARY_API_SECRET` | نعم | |
| `APP_URL` | لا | الأساس للـcanonical وفحص Origin |
| `IP_HASH_SALT` | نعم | 32 بايت عشوائية |
| `TRUSTED_PROXY_HEADER` | لا | `x-forwarded-for` (Vercel) أو `x-real-ip` (VPS) |
| `CRON_SECRET` | نعم | لحماية مسار تنظيف الصور المعلقة |

- `src/lib/env.ts` يتحقق بـZod عند بدء التشغيل، ويفشل بوضوح إن كان أي متغير ناقصًا.
- **لا متغير سري يبدأ بـ`NEXT_PUBLIC_`.** وفحص آلي في الاختبارات يتأكد من ذلك.
- `.env`، و`.env.local`، و`.env.*.local`، و`.env.production` ممنوعة من النشر. المسموح فقط `.env.example` بقيم فارغة.
- قبل نهاية كل مرحلة: بحث grep عن أنماط الأسرار (`mongodb+srv://`، و`api_secret`، ومفاتيح طويلة) في `src/` وفي مخرجات `.next/static`.

## 9. السجلات (Logs)
- logger بسيط (`lib/logger.ts`) يحذف تلقائيًا أي مفتاح اسمه `password`، أو `token`، أو `cookie`، أو `authorization`، أو `secret`، أو `phone`، أو `address`.
- لا تُسجل أجسام الطلبات كاملة.
- أخطاء الخادم تُسجل برقم مرجعي يُعرض للمستخدم: «حدث خطأ (رمز: X)».

## 10. البيانات الشخصية للعملاء
- تُجمع فقط الحقول اللازمة للطلب: الاسم، والهاتف، والمحافظة، والعنوان، والملاحظات.
- لا تظهر إلا داخل لوحة الإدارة المحمية.
- **سياسة الاحتفاظ المقترحة:**
  - الأدمن يستطيع حذف PII لأي طلب في أي وقت.
  - أمر `npm run orders:purge-pii -- --older-than=180d` لحذف PII من الطلبات الأقدم من 180 يومًا. يُشغَّل يدويًا أو بجدولة على VPS أو Vercel Cron.
- عنوان IP لا يُخزن نصًا، بل `ipHash` مع salt.
- صفحة «سياسة الخصوصية» في المتجر تشرح ما يُجمع ولماذا.

## 11. الاعتماديات
- تثبيت دقيق للإصدارات، و`package-lock.json` يُحفظ.
- `npm audit --omit=dev` في نهاية كل مرحلة. أي ثغرة عالية أو حرجة تُعالج أو تُوثق في §12 مع مبرر.
- لا تُثبَّت مكتبات بلا مراجعة: نتحقق من الصيانة، والتنزيلات، والتوافق مع إصدار Next وNode.

## 12. مخاطر متبقية معروفة
| الخطر | الحالة |
|---|---|
| CSP مع `'unsafe-inline'` للـstyles | مقبول، لأن Tailwind وNext يحقنان أنماطًا. يُعاد تقييمه في المرحلة 7 |
| Rate limit بقاعدة البيانات يضيف استعلامًا لكل محاولة | مقبول لحجم متجر واحد |
| عدم وجود MFA للأدمن | خارج نطاق الإصدار الأول، ومرشح للإصدار التالي |
| لا يوجد Git، فلا يوجد سجل تغييرات للمراجعة الأمنية | قرار المالك. يُعوَّض بتوثيق PROGRESS |
