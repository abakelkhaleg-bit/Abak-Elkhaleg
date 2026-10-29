# ADR 0007 — رفع الصور عبر الخادم

- **الحالة:** مقترح (يُعتمد مع الخطة)
- **البدائل:**
  1. رفع مباشر من المتصفح إلى Cloudinary بتوقيع يولده الخادم. ميزته أنه لا يمر بحد Vercel. عيبه أن الخادم لا يرى البايتات، فلا يتحقق من النوع الفعلي قبل الرفع، ويعتمد على قيود Cloudinary فقط.
  2. **رفع عبر Route Handler على الخادم، وهو المختار.**
- **القرار:**
  - `POST /api/admin/uploads` يتحقق بالترتيب من: `requireAdmin`، ثم Origin، ثم rate limit، ثم الحجم ≤ 4MB، ثم magic bytes عبر `file-type` (JPEG وPNG وWebP وAVIF).
  - بعدها يرفع بـ`upload_stream` إلى `abak-elkhalig/<folder>`، وينشئ `MediaAsset(pending)`.
  - الحذف من Cloudinary:
    - يتم فقط بعد نجاح حفظ الكيان.
    - وبعد التحقق من عدم استخدام الـpublicId في products أو categories أو brands أو settings.
  - التنظيف الدوري يحذف الأصول `pending` الأقدم من 24 ساعة.
- **العواقب:**
  - الحد الأقصى 4MB بسبب حد Vercel (4.5MB). صور العطور المحترفة تُضغط قبل الرفع إن لزم.
  - يمكن إضافة ضغط في المتصفح لاحقًا.
