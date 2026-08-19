# نظام الاجتماعات الإلكتروني — دليل التشغيل

هذا الملف يشرح خطوات التفعيل التي تحتاج لتنفيذها بنفسك خارج الكود (حسابات
خارجية، متغيرات بيئة، وتطبيق قاعدة البيانات) قبل أن يعمل النظام فعلياً.

## 1) تطبيق تغييرات قاعدة البيانات

الملف `drizzle/0001_meetings.sql` يضيف فقط الجداول الأربعة الجديدة الخاصة
بالاجتماعات (`meetings`, `meetingParticipants`, `meetingBans`,
`meetingOverridePermissions`) ولا يلمس أي جدول موجود. طبّقه بإحدى الطرق:

```bash
psql "$DATABASE_URL" -f drizzle/0001_meetings.sql
```

أو الصقه مباشرة في SQL Editor بلوحة تحكم Supabase.

> ملاحظة: لاحظت أن مجلد `drizzle/` الحالي للمشروع غير متزامن مع
> `drizzle/schema.ts` — هناك 17 جدولاً (books, workLogs, teamInviteLinks,
> profileEditRequests، إلخ) مضافة في الكود لكن لا يوجد لها ملفات migration
> مطابقة، على الأغلب لأنها طُبّقت مباشرة عبر `drizzle-kit push`. لم ألمس
> هذا الخلل القديم لأنه خارج نطاق هذه المهمة، لكن يُفضّل إصلاحه لاحقاً حتى
> لا يتكرر الالتباس عند أي migration مستقبلي.

## 2) LiveKit (خادم الوسائط الصوتية/المرئية)

الخيار الأسهل والموصى به: **LiveKit Cloud**.
1. أنشئ حساباً على https://cloud.livekit.io (مجاني).
2. أنشئ مشروعاً جديداً، وانسخ من صفحة الإعدادات: `WebSocket URL`، `API Key`، `API Secret`.
3. أضف في متغيرات البيئة (Vercel → Settings → Environment Variables):
   ```
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   ```

بديل: استضافة ذاتية (مثلاً على Oracle Cloud Free Tier) — نفس متغيرات البيئة
تماماً، فقط بقيم خادمك الخاص. لا حاجة لتغيير أي كود عند التبديل بين الخيارين.

## 3) Supabase Realtime (الحضور، الدردشة اللحظية، الإشارات)

نفس مشروع Supabase Postgres الحالي يكفي:
1. من لوحة تحكم Supabase → **Database → Replication**، فعّل Realtime (هذا
   تلقائي غالباً لأي مشروع جديد).
2. من **Project Settings → API**، انسخ `Project URL` و `anon public key`.
3. أضف في متغيرات البيئة:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=...
   ```

لا يتم تخزين أي فيديو أو صوت أو نص دردشة في قاعدة بيانات Postgres نفسها —
فقط بيانات وصفية مؤقتة عن الاجتماع (من أنشأه، حالته، القيود المفعّلة عليه).

## 4) مهمة التنظيف اليومية (Cron)

أُضيفت إلى `vercel.json`:
```json
{ "path": "/api/cron/meetings-cleanup", "schedule": "0 4 * * *" }
```
تحقق من حد عدد Cron Jobs المسموح في خطتك على Vercel (الخطة المجانية Hobby
تسمح بعدد محدود من المهام وبتكرار مرة واحدة يومياً كحد أقصى) — إذا كان لديك
حد أقصى بلغته الآن نتيجة إضافة هذه المهمة، سيظهر خطأ عند النشر ويجب حينها
دمج مهمتي التنظيف (`books-cleanup` و `meetings-cleanup`) في مسار واحد.

بما أن Vercel المجاني لا يسمح بتشغيل متكرر (كل بضع دقائق)، الإنهاء التلقائي
لاجتماع فارغ لا يعتمد فقط على هذا الـ cron: يتم أيضاً التحقق من ذلك تلقائياً
(`autoEndEmptyLiveMeetings`) في كل مرة يُستعلَم فيها عن قائمة الاجتماعات من
صفحة الإعدادات، كشبكة أمان إضافية.

## 5) بعد الإعداد

بمجرد ضبط المتغيرات الأربعة (`LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) وإعادة النشر على
Vercel، ستظهر بطاقة "نظام الاجتماعات الإلكتروني" في لوحة تحكم الأدمن
(`/admin/meetings-settings`) لأصحاب المناصب الإدارية والتنظيمية المخوّلة.
