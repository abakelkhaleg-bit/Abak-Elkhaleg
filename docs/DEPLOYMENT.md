# النشر والتشغيل — متجر «عطور عبق الخليج»

> هذا المستند هيكل أولي من المرحلة 0. يُستكمل ويُختبر فعليًا في المرحلة 9.

## 1. المتطلبات المشتركة
| العنصر | القيمة |
|---|---|
| Node.js | 24 LTS (المطوَّر عليه: v24.15.0). يُثبت في `package.json` بالحقل `engines` |
| مدير الحزم | npm (`npm ci` في الإنتاج) |
| قاعدة البيانات | MongoDB Atlas (موصى به)، أو MongoDB 7 أو أحدث **replica set** |
| الصور | حساب Cloudinary |
| متغيرات البيئة | انظر [SECURITY.md §8](SECURITY.md#8-الأسرار-ومتغيرات-البيئة) و`.env.example` |

## 2. MongoDB Atlas
1. إنشاء Cluster في منطقة قريبة من مصر، مثل `eu-central-1` أو `me-south-1` إن توفرت.
2. Database User بصلاحية `readWrite` على قاعدة `abak-elkhalig` فقط.
3. Network Access:
   - Vercel: `0.0.0.0/0` مع كلمة مرور قوية، أو Vercel Secure Compute إن توفر. القيد موثق.
   - VPS: عنوان IP الخادم فقط.
4. نسخ `MONGODB_URI` بالصيغة `mongodb+srv://…/abak-elkhalig?retryWrites=true&w=majority`.
5. بناء الفهارس: `npm run db:indexes`.

## 3. Cloudinary
1. من Dashboard: `Cloud name` و`API Key` و`API Secret`، وتوضع في متغيرات البيئة فقط.
2. المجلد الجذر للصور `abak-elkhalig/` (يُنشأ تلقائيًا عند الرفع).
3. لا حاجة لـUpload Preset غير موقّع، **ولا يُنشأ**، لأن الرفع يتم من الخادم.

## 4. Vercel (بدون Git — عبر CLI)
```
npm i -g vercel
vercel login
vercel link                 # ربط المجلد بمشروع Vercel
vercel env add MONGODB_URI production
vercel env add CLOUDINARY_CLOUD_NAME production
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
vercel env add APP_URL production
vercel env add IP_HASH_SALT production
vercel env add TRUSTED_PROXY_HEADER production   # x-forwarded-for
vercel env add CRON_SECRET production
vercel deploy               # Preview
vercel deploy --prod        # Production
```
- Build Command: `npm run build`، وOutput: الافتراضي لـNext.js.
- الدومين: Project → Settings → Domains، ثم تحديث `APP_URL`.
- Cron لتنظيف الصور المعلقة: `vercel.json` بالمسار `/api/cron/cleanup-media` مع `CRON_SECRET`.
- **قيد معروف:** جسم الطلب ≤ 4.5MB، وحد رفع الصور عندنا 4MB.
- بعد النشر: تشغيل `npm run admin:create` محليًا موجّهًا إلى `MONGODB_URI` الإنتاجية مرة واحدة.
  - الأمر يعمل بـ`node --conditions=react-server --import tsx`، فيحتاج الاعتماديات كاملة (`npm ci` يشمل devDependencies).
  - يحتاج طرفية تفاعلية لإدخال كلمة المرور مخفية.
  - لتغيير كلمة المرور لاحقًا: `npm run admin:reset-password`، وهو يبطل كل الجلسات.

## 5. VPS (Ubuntu 24.04 LTS)
```
# Node 24 عبر nvm أو NodeSource، ثم:
sudo npm i -g pm2
# رفع ملفات المشروع (بدون node_modules و.next و.env*) عبر rsync/scp
cd /var/www/abak-elkhalig
npm ci
cp .env.example .env.production   # ثم تعبئة القيم يدويًا، والصلاحيات chmod 600
npm run build
npm run db:indexes
npm run admin:create
pm2 start npm --name abak-elkhalig -- start
pm2 save && pm2 startup
```

Nginx (reverse proxy):
```
server {
  server_name example.com www.example.com;
  client_max_body_size 5m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
- HTTPS: `sudo certbot --nginx -d example.com -d www.example.com`، والتجديد تلقائي.
- `TRUSTED_PROXY_HEADER=x-real-ip`.
- السجلات: `pm2 logs abak-elkhalig`، مع `pm2 install pm2-logrotate`.
- Cron لتنظيف الصور:
  ```
  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/cleanup-media
  ```
  يُشغَّل يوميًا.
- التحديث الآمن:
  1. رفع النسخة الجديدة إلى مجلد release جديد.
  2. `npm ci && npm run build`.
  3. تبديل symlink.
  4. `pm2 reload abak-elkhalig`.
  5. الاحتفاظ بالإصدار السابق للتراجع.
- **لا يُخزن أي ملف دائم على القرص**: الصور في Cloudinary، والبيانات في MongoDB.

## 6. النسخ الاحتياطي والاستعادة
- Atlas: النسخ الاحتياطي المجدول متاح في الخطط المدفوعة. في M0 نستخدم `mongodump`.
- نسخ يدوي أو مجدول:
  ```
  mongodump --uri="$MONGODB_URI" --gzip --archive=backup-$(date +%F).gz
  ```
  الاحتفاظ بـ14 نسخة يومية خارج الخادم.
- الاستعادة (تُجرَّب على قاعدة اختبار أولًا):
  ```
  mongorestore --uri="$MONGODB_URI_RESTORE_TARGET" --gzip --archive=backup-YYYY-MM-DD.gz --drop
  ```
- Cloudinary: الأصول تبقى في الحساب. يمكن تصدير قائمة الـpublicIds من `media_assets` ضمن النسخة.
- **بدون Git:** يُنصح بأرشفة مجلد المشروع (zip) بعد كل مرحلة كنقطة استرجاع.

## 7. قائمة ما قبل الإطلاق (تُستكمل في المرحلة 9)
- [ ] كل متغيرات البيئة مضبوطة و`env.ts` لا يشتكي.
- [ ] الفهارس مبنية.
- [ ] حساب الأدمن منشأ، وكلمة مروره قوية ومحفوظة في مدير كلمات مرور.
- [ ] رقم واتساب مضبوط في الإعدادات ومجرَّب.
- [ ] منتجات حقيقية مضافة، ولا بيانات seed في الإنتاج.
- [ ] HTTPS يعمل، وHSTS ظاهر.
- [ ] `robots.txt` و`sitemap.xml` صحيحان، و`APP_URL` = الدومين النهائي.
- [ ] تجربة الطلب كاملة على موبايل حقيقي.
- [ ] نسخة احتياطية أولى مأخوذة، واستعادتها مجرَّبة.
