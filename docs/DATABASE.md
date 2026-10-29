# قاعدة البيانات — MongoDB + Mongoose

## 1. المتطلبات
- MongoDB 7 أو أحدث، تعمل **كـreplica set**، لأن عمليات المخزون والطلبات تستخدم المعاملات.
  - MongoDB Atlas (حتى M0) تعمل كـreplica set افتراضيًا.
  - التطوير المحلي: Atlas، أو `mongod --replSet rs0` مع `rs.initiate()`.
  - الاختبارات: `mongodb-memory-server` بوضع `MongoMemoryReplSet`.
- عند بدء التشغيل يفحص `lib/db.ts` دعم المعاملات عبر الأمر `hello`. إن لم تتوفر يسجل خطأ واضحًا، وعمليات المخزون تفشل بأمان بدل أن تعمل دون حماية.
- الاتصال مخزّن على `globalThis`، فلا تتكرر الاتصالات مع HMR وServerless.
- `autoIndex` مفعّل في التطوير. في الإنتاج تُبنى الفهارس بالأمر `npm run db:indexes`، الذي يستدعي `Model.syncIndexes()`.

## 2. اصطلاحات عامة
- جميع المجموعات عليها `timestamps: true` (حقلا `createdAt` و`updatedAt`)، إلا السجلات للإضافة فقط فعليها `createdAt` وحده.
- **المبالغ بالقروش** كأعداد صحيحة: 1 جنيه = 100 قرش. التحويل للعرض يتم في `lib/money.ts` فقط.
- الـSlug:
  - أحرف لاتينية صغيرة وأرقام و`-`، أو عربية مُنظَّفة.
  - النمط (`SLUG_PATTERN` في `src/lib/validation-rules.ts`): حروف عربية (ء–غ، ف–ي) أو لاتينية صغيرة أو أرقام لاتينية، مفصولة بشرطة واحدة. التشكيل والتطويل يُحذفان، والأرقام الهندية تُحوَّل، عبر `slugify()`.
  - فريد لكل مجموعة.
  - يُقترح تلقائيًا من الاسم ويمكن للأدمن تعديله.
  - **ثابت بعد النشر**: تغييره يتطلب تأكيدًا صريحًا من الأدمن، ويحذّره من أثره على الروابط.
- النصوص: `trim` وحدود طول في Zod وفي Mongoose معًا.
- المراجع:
  - تُستخدم `ObjectId` مع `ref`.
  - التحقق من وجود المرجع يتم في الخدمة قبل الحفظ.
  - عند الحذف تُطبَّق قواعد القسم 5.

## 2.1 ما نُفِّذ في المرحلة 2
- كل النماذج في `src/models/`. النماذج تستورد `src/models/_mongoose.ts`، الذي يضبط `strictQuery` و`sanitizeFilter` عالميًا، فتسري الحماية في التطبيق والسكربتات والاختبارات معًا.
- **sanitizeFilter:** أي كائن فيه مفاتيح تبدأ بـ`$` داخل فلتر يُعامل كقيمة حرفية، فيُرفض الاستعلام بـ`CastError` بدل أن يُنفَّذ. عندما يحتاج كودنا مشغّلًا حقيقيًا يُغلَّف بـ`trusted()`، مثل `{ categoryId: trusted({ $in: ids }) }`.
- **قواعد التحقق** مشتركة بين Zod (`src/schemas/`) وMongoose عبر `src/lib/validation-rules.ts`، فلا تتكرر القيم في مكانين.
- **قواعد الحذف** مفروضة على مستوى النموذج في `src/models/_guards.ts`، فلا يمكن تجاوزها بنسيان فحص في الخدمة:
  - Category وBrand: يُرفض الحذف بأي طريقة (`deleteOne`، `deleteMany`، `findOneAndDelete`، `doc.deleteOne()`) إذا كانت مرتبطة بمنتجات.
  - InventoryMovement: للإضافة فقط، فأي تعديل أو حذف يُرفض.
  - OrderRequest: الحذف مرفوض.
- **منع تكرار الاسم:** Category وBrand تحملان حقل `nameKey`، وهو الاسم بعد التطبيع وعليه فهرس فريد، فـ«الشرقية» و«الشرقيه» تُعتبران نفس الاسم.
- **صور seed التجريبية** من حساب Cloudinary العام `demo`. خدمة الصور (المرحلة 5) لن تحذف أي `publicId` خارج مجلد المشروع `abak-elkhalig/`.
- **ترجمة الأخطاء:** `src/lib/errors.ts` يحوّل `E11000` و`ValidationError` إلى `AppError` برسائل عربية وحقول محددة.

## 3. النماذج

### 3.1 Product (`products`)
| الحقل | النوع | قواعد |
|---|---|---|
| name | String | مطلوب، 2–120 |
| slug | String | مطلوب، فريد، نمط slug |
| shortDescription | String | مطلوب، ≤ 300 |
| description | String | ≤ 10,000 (نص منسق بسيط: فقرات وقوائم، يُعرض بأمان دون HTML خام) |
| categoryId | ObjectId → Category | مطلوب |
| brandId | ObjectId → Brand | مطلوب |
| images | [ProductImage] | ≤ 12 |
| variants | [ProductVariant] | 1–10، و`sizeMl` فريد داخل المنتج |
| isPublished | Boolean | افتراضي false. لا يُنشر إلا بوجود صورة واحدة على الأقل وحجم متاح بسعر |
| isFeatured | Boolean | افتراضي false |
| isOnSale | Boolean | محسوب عند الحفظ: true إن كان لأي حجم `compareAtPrice > price`. يمكن للأدمن إخفاؤه من قسم العروض بحقل `hideFromOffers` |
| sortOrder | Number | افتراضي 0 |
| seo | {title ≤ 70, description ≤ 160, ogImagePublicId?} | اختياري، والافتراضي يُشتق من الاسم والوصف |
| minPrice | Number (قروش) | محسوب = أقل سعر بين الأحجام المتاحة، ويُستخدم للفلترة والترتيب |
| inStock | Boolean | محسوب = أي حجم `isAvailable && stockQuantity > 0` |
| searchText | String | محسوب = `normalize(name + brand.name + category.name)` |
| createdAt / updatedAt | Date | |

ProductImage (subdocument):

| الحقل | قواعد |
|---|---|
| secureUrl | يبدأ بـ`https://res.cloudinary.com/` |
| publicId | مطلوب |
| altText | ≤ 150، والافتراضي اسم العطر |
| sortOrder | الصورة ذات أصغر قيمة هي الرئيسية |
| width, height | أرقام |

ProductVariant (subdocument، و`_id` هو variantId):

| الحقل | قواعد |
|---|---|
| sizeMl | عدد صحيح 1–1000 |
| sku | اختياري، `^[A-Z0-9-]{3,40}$`، **فريد عالميًا** عند وجوده |
| price | عدد صحيح > 0 (قروش) |
| compareAtPrice | اختياري، عدد صحيح **> price**، وإلا يُرفض ("خصم غير منطقي") |
| stockQuantity | عدد صحيح ≥ 0 |
| lowStockThreshold | عدد صحيح ≥ 0، افتراضي 3 |
| isAvailable | Boolean، يتحكم به الأدمن، ويمكن تعطيل حجم حتى لو له مخزون |

**نسبة الخصم** لا تُخزن، وتُحسب عند العرض: `round((compareAtPrice - price) / compareAtPrice * 100)`.

**ملاحظة مهمة:** لا يُعدَّل `stockQuantity` من نموذج تعديل المنتج العام. بعد الإنشاء يُعدَّل فقط عبر `inventory.service`، فيُسجَّل كل تغيير في سجل الحركات. الكمية الأولية عند الإنشاء تُسجل كحركة من نوع `initial`.

الفهارس:
- `{slug:1}` فريد.
- `{"variants.sku":1}` فريد مع `partialFilterExpression: {"variants.sku": {$type: "string"}}`.
- `{isPublished:1, categoryId:1, sortOrder:1, createdAt:-1}`
- `{isPublished:1, brandId:1, createdAt:-1}`
- `{isPublished:1, isFeatured:1, sortOrder:1}`
- `{isPublished:1, isOnSale:1}`
- `{isPublished:1, minPrice:1}`
- `{isPublished:1, searchText:1}`
- `{"images.publicId":1}`، ويُستخدم للتحقق من استخدام الصورة قبل حذفها.

> **ملاحظة عن تفرّد SKU:** الفهرس الفريد على حقل داخل مصفوفة يمنع التكرار بين مستندات مختلفة، لكنه لا يمنعه داخل المستند نفسه. لذلك تتحقق الخدمة وZod من عدم تكرار SKU وsizeMl داخل المنتج الواحد.

### 3.2 Category (`categories`)
| الحقل | قواعد |
|---|---|
| name | مطلوب، 2–60، فريد (بعد التطبيع) |
| slug | فريد |
| description | ≤ 1000 |
| image | {secureUrl, publicId, altText}؟ |
| isActive | افتراضي true. التصنيف المخفي لا يظهر في المتجر وتُعيد صفحته 404 |
| sortOrder | افتراضي 0 |
| seo | {title, description}؟ |

الفهارس: `{slug:1}` فريد، `{isActive:1, sortOrder:1}`، `{"image.publicId":1}`.

### 3.3 Brand (`brands`)
الحقول: name، slug (فريد)، description، logo؟، isActive، sortOrder، seo؟

الفهارس: `{slug:1}` فريد، `{isActive:1, name:1}`، `{"logo.publicId":1}`.

### 3.4 InventoryMovement (`inventory_movements`) — للإضافة فقط
| الحقل | قواعد |
|---|---|
| productId | ObjectId، مطلوب |
| variantId | ObjectId، مطلوب |
| productName, sizeMl | snapshot، يبقى السجل مقروءًا حتى لو حُذف المنتج |
| movementType | `initial` \| `restock` \| `adjustment` \| `stocktake` \| `sale` \| `order_cancel_restore` |
| quantityDelta | عدد صحيح ≠ 0، إلا في `stocktake` حيث يمكن أن يكون 0 |
| previousQuantity, newQuantity | ≥ 0، والشرط `newQuantity = previousQuantity + quantityDelta` |
| reason | مطلوب في `adjustment` و`stocktake`، بطول 3–300 |
| orderId | ObjectId؟ في `sale` و`order_cancel_restore` |
| createdAt | |

الفهارس: `{productId:1, createdAt:-1}`، `{createdAt:-1}`، `{orderId:1, variantId:1, movementType:1}` فريد جزئي عند وجود orderId. الفهرس الأخير يمنع تكرار الخصم لنفس بند الطلب.

### 3.5 Notification (`notifications`)
| الحقل | قواعد |
|---|---|
| type | `low_stock` \| `out_of_stock` |
| productId, variantId | مطلوب |
| productName, sizeMl, quantityAtTrigger | snapshot |
| message | نص عربي، مثل: «عطر X — 50ml: المتبقي 2» |
| status | `unread` \| `read` |
| isOpen | Boolean، تساوي true طوال دورة التنبيه |
| resolvedAt | Date؟، يُضبط عند إغلاق الدورة (`isOpen=false`) |
| createdAt, readAt | |

**منع التكرار:** فهرس فريد على `{variantId:1, type:1}` مع `partialFilterExpression: {isOpen: true}`. استُخدم حقل منطقي لأن الفهارس الجزئية لا تدعم المطابقة مع `null` بشكل موثوق. النتيجة أنه لا يوجد إلا تنبيه مفتوح واحد لكل حجم ونوع. محاولة الإنشاء المكرر تُلتقط كخطأ `11000` وتُتجاهل بأمان.

**دورة التنبيه** في `notifications.service.syncForVariant(qty, threshold)`، وتُستدعى فقط بعد تغيّر المخزون أو تغيّر حد التنبيه:
- `qty == 0`:
  - يُفتح `out_of_stock` إن لم يكن مفتوحًا.
  - يبقى `low_stock` مفتوحًا، لأنه سبق نفاد المخزون.
- `0 < qty ≤ threshold`:
  - يُفتح `low_stock` إن لم يكن مفتوحًا.
  - يُغلق `out_of_stock` إن كان مفتوحًا.
- `qty > threshold`: يُغلق كل التنبيهات المفتوحة (`isOpen = false` و`resolvedAt = now`). أي انخفاض بعدها يفتح دورة جديدة.

فتح الـDashboard **لا ينشئ** تنبيهات، بل يقرؤها فقط.

الفهارس: الفريد الجزئي أعلاه، و`{status:1, createdAt:-1}`.

### 3.6 Admin (`admins`)
| الحقل | قواعد |
|---|---|
| singleton | ثابت `"admin"`، عليه فهرس فريد، فلا يمكن وجود أكثر من حساب |
| username | 3–32، `^[a-zA-Z0-9_.-]+$`، يُخزن lowercase |
| passwordHash | Argon2id PHC string |
| passwordChangedAt | Date، أي جلسة أُنشئت قبله تُعتبر باطلة |

### 3.7 Session (`sessions`)
| الحقل | قواعد |
|---|---|
| tokenHash | SHA-256 hex، فريد. التوكن نفسه لا يُخزن |
| adminId | ObjectId |
| expiresAt | Date، وعليه فهرس TTL بقيمة `expireAfterSeconds: 0`. الحد المطلق 7 أيام |
| lastSeenAt | Date. انتهاء الخمول بعد 24 ساعة يُفحص في الكود |
| userAgent | مختصر، للعرض فقط |
| createdAt | |

### 3.8 StoreSettings (`store_settings`) — مستند واحد
- `_id: "store"` ثابت.
- القراءة بـ`findOneAndUpdate({_id:"store"}, {$setOnInsert: defaults}, {upsert:true, new:true})`، فلا يمكن وجود أكثر من سجل.

الحقول:
- storeName (افتراضي «عطور عبق الخليج»)
- logo؟ (Cloudinary، والبديل الشعار المحلي)
- whatsappNumber: بصيغة E.164 دون `+`، مثل `2010xxxxxxxx`. يُدخل بصيغة مصرية ويُحوَّل. **مطلوب قبل تفعيل الطلب**: إن لم يُضبط يظهر زر الطلب معطلًا مع رسالة.
- contact {phone, email, address, workingHours}
- description
- defaultSeo {title, description, ogImage}
- socialLinks {instagram, facebook, tiktok, x, snapchat}: روابط https فقط.
- policies [{slug, title, body}]: الشحن، والاستبدال، والخصوصية.
- homepage {heroTitle, heroSubtitle, heroImage, promoBanners[{title, subtitle, image, href, isActive, sortOrder}]}: الأقسام الترويجية القابلة للإدارة.

### 3.9 OrderRequest (`order_requests`)
| الحقل | قواعد |
|---|---|
| reference | `AK-` + 6 أرقام على الأقل، فريد، من `counters` |
| items | [{productId, variantId, productName, slug, sizeMl, unitPrice, quantity, lineTotal}]: snapshot محسوب على الخادم |
| total | قروش، محسوب على الخادم |
| customer | {name 2–60, phone `^01[0125]\d{8}$`, governorate (من القائمة), address ≤ 300, notes ≤ 500} |
| status | `opened_in_whatsapp` \| `confirmed` \| `cancelled` |
| statusHistory | [{status, at, note?}] |
| confirmedAt, cancelledAt | Date؟ |
| piiPurgedAt | Date؟. عند حذف البيانات الشخصية تُستبدل حقول customer بقيم فارغة |
| ipHash | SHA-256 للـIP مع salt، لأغراض rate limit والتحقيق فقط |
| createdAt, updatedAt | |

الحالة «منتهي» **محسوبة عند العرض** (`opened_in_whatsapp` وعمرها أكثر من 7 أيام)، ولا تُخزن. السبب أن الطلب يجب أن يبقى قابلًا للتأكيد إن عاد العميل متأخرًا.

الفهارس: `{reference:1}` فريد، `{status:1, createdAt:-1}`، `{createdAt:-1}`.

### 3.10 Counter (`counters`)
`{_id: "order", seq: Number}`، ويُحدَّث بـ`findOneAndUpdate({$inc:{seq:1}}, {upsert:true, new:true})`، وهي عملية ذرية.

### 3.11 RateLimit (`rate_limits`)
`{_id: "<bucket>:<keyHash>", count, expiresAt}` وعليه فهرس TTL على `expiresAt`. التحديث بـ`$inc` مع upsert، وهي عملية ذرية.

### 3.12 MediaAsset (`media_assets`)
| الحقل | قواعد |
|---|---|
| publicId | فريد |
| secureUrl, format, bytes, width, height | |
| folder | `products` \| `categories` \| `brands` \| `settings` |
| status | `pending` \| `attached` |
| createdAt | |

الفهرس: `{status:1, createdAt:1}`، ويُستخدم لتنظيف الأصول المعلقة.

## 4. العلاقات

```
Category 1 ──< Product >── 1 Brand
Product 1 ──< ProductVariant (مضمّن)
Product 1 ──< ProductImage (مضمّن) ── publicId ── MediaAsset
Product/Variant 1 ──< InventoryMovement
Product/Variant 1 ──< Notification
OrderRequest ──< items (snapshot مع productId/variantId)
OrderRequest 1 ──< InventoryMovement (sale / order_cancel_restore)
Admin 1 ──< Session
```

**سبب تضمين الأحجام داخل المنتج:** تُقرأ دائمًا مع المنتج، وعددها صغير (≤ 10). كما أن التحديث الذري لكمية حجم بعينه ممكن بـ`arrayFilters` على مستند واحد.

## 5. قواعد الحذف

| الكيان | القاعدة |
|---|---|
| Category | **يُرفض** الحذف إن وُجد أي منتج مرتبط، مع رسالة «لا يمكن حذف التصنيف لأنه مرتبط بـN منتج — انقل المنتجات أو أخفِ التصنيف». الإخفاء (`isActive=false`) متاح دائمًا |
| Brand | نفس قاعدة Category |
| Product | حذف فعلي بعد تأكيد. الحركات والتنبيهات تبقى لأنها تحمل snapshot. التنبيهات المفتوحة تُغلق. الطلبات تبقى لأنها snapshot. صور المنتج تُحذف من Cloudinary بعد نجاح الحذف، وفقط إن لم تُستخدم في مكان آخر. البديل الموصى به في الواجهة: إيقاف النشر |
| Variant | حذف حجم له حركات مسموح، وتبقى الحركات. حذف آخر حجم مرفوض |
| InventoryMovement | لا يُحذف ولا يُعدّل أبدًا |
| OrderRequest | لا يُحذف. المتاح فقط حذف البيانات الشخصية (purge) |
| Admin | لا حذف من الواجهة |

## 6. المعاملات والتزامن

**خصم أو إضافة مخزون لحجم** (يُستخدم في `inventory.service` وفي تأكيد الطلب):
```ts
await session.withTransaction(async () => {
  const before = await Product.findOneAndUpdate(
    { _id: productId, variants: { $elemMatch: { _id: variantId, stockQuantity: { $gte: -delta } } } },
    { $inc: { "variants.$[v].stockQuantity": delta } },
    { arrayFilters: [{ "v._id": variantId }], session, new: false, projection: {...} }
  );
  if (!before) throw new InsufficientStockError();   // لا تتجاوز المتاح ولا كمية سالبة
  await InventoryMovement.create([{ previousQuantity, newQuantity, ... }], { session });
  await notifications.syncForVariant(..., { session });
  await Product.updateOne({ _id: productId }, { $set: { inStock, minPrice } }, { session });
});
```
- الشرط `stockQuantity ≥ -delta` داخل الفلتر يجعل الفحص والتحديث عملية واحدة ذرية، فلا تحدث حالة سباق.
- `stocktake` (تعيين قيمة مطلقة) يستخدم قفلًا تفاؤليًا: يُقرأ `stockQuantity` الحالي، ثم يُحدَّث بشرط بقائه على نفس القيمة، ويُعاد المحاولة حتى 3 مرات.

**تأكيد طلب:**
- أولًا انتقال حالة شرطي:
  ```ts
  OrderRequest.findOneAndUpdate({_id, status:"opened_in_whatsapp"}, {$set:{status:"confirmed", ...}, $push:{statusHistory}}, {session})
  ```
  إن لم يُرجع مستندًا فالطلب أُكد أو أُلغي من قبل، وتتوقف العملية دون خصم. هذا هو **منع تكرار الخصم**.
- بعدها خصم كل بند بالآلية السابقة داخل **نفس المعاملة**. إن لم يكفِ مخزون أي بند تُلغى المعاملة كاملة ويُعرض على الأدمن البند الناقص.
- الفهرس الفريد `{orderId, variantId, movementType}` على الحركات طبقة حماية ثانية.

**إلغاء طلب مؤكد:** انتقال شرطي من `confirmed` إلى `cancelled`، ثم حركات `order_cancel_restore`، داخل معاملة واحدة.

## 7. معالجة الأخطاء
| الخطأ | المعالجة |
|---|---|
| `E11000` (تكرار) | يُترجم حسب الفهرس إلى «الرابط (slug) مستخدم بالفعل» أو «رمز SKU مستخدم بالفعل» |
| أخطاء الاتصال | رسالة «تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى» مع تسجيل التفاصيل على الخادم |
| `TransientTransactionError` | يُعاد تلقائيًا عبر `withTransaction` |
| `ValidationError` | يُحوَّل إلى `fieldErrors` |

## 8. بيانات التطوير (Seed)
- `npm run seed:dev` ينشئ تصنيفات وماركات ومنتجات تجريبية بصور placeholder.
- يرفض العمل إذا كانت `NODE_ENV=production`، أو إذا لم يكن `MONGODB_URI` يشير إلى قاعدة اسمها ينتهي بـ`-dev` أو `-test`، إلا بعلم صريح `--force-dev`.
- لا يُستورد أي ملف seed من كود التطبيق.

## 9. النسخ الاحتياطي
راجع [DEPLOYMENT.md](DEPLOYMENT.md#النسخ-الاحتياطي-والاستعادة).
