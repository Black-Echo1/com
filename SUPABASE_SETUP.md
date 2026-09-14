# ربط نموذج "التقديم على فرصة تعاون" بـ Supabase

## 1. إنشاء المشروع
1. سجّل بـ https://supabase.com (مجاني للبداية)
2. أنشئ مشروع جديد (New Project) واختر باسورد لقاعدة البيانات (احفظه بمكان آمن)
3. من Project Settings → API Keys، انسخ:
   - **Project URL**
   - **Publishable key** (يبدأ بـ `sb_publishable_...` — هو نفس ما كان يُسمى `anon key` سابقاً، بس باسم جديد. آمن تماماً يظهر بكود الموقع)
4. افتح `data/supabase_config.js` بموقعك وحط القيمتين مكان الفراغين.

⚠️ لا تستخدم أبداً **Secret key** (يبدأ بـ `sb_secret_...`، أو `service_role` بالنظام القديم) بأي ملف من ملفات الموقع نفسه — هذا مفتاح خطير لو انكشف، ومكانه فقط داخل إعدادات الوظيفة السحابية بالخطوة 6.

## 2. تحديد إيميلات الفرق
افتح `data/team_contacts.js` بموقعك، وبدّل الإيميلات التجريبية بإيميلات كل فريق
الحقيقية (Black Echo، نور شادو، الأكاتسكي...). لإضافة فريق جديد مستقبلاً، فقط
أضف سطراً جديداً بنفس الشكل — القائمة المنسدلة بالفورم بتتحدث تلقائياً.

## 3. إنشاء مكان تخزين الملفات (Storage Bucket)
1. من القائمة الجانبية: Storage → New Bucket
2. اسم الـ bucket بالضبط: `talent-applications`
3. فعّل "Public bucket" (عشان الرابط يشتغل بالإيميل)

## 4. الحصول على مفتاح إرسال إيميل (Resend مجاني وسهل)
1. سجّل بـ https://resend.com (مجاني حتى 3000 إيميل/شهر)
2. من API Keys أنشئ مفتاح جديد وانسخه
3. تأكد من إضافة/تفعيل بريد "from" (أو استخدم النطاق التجريبي المتاح افتراضياً للتجربة)

## 5. إنشاء الوظيفة السحابية (Edge Function)
تحتاج جهازك يكون فيه Node.js مثبت، ثم بالـ Terminal:

```bash
npm install -g supabase
supabase login
cd مجلد-مشروعك
supabase init
supabase functions new send-application-email
```

هيتكوّن ملف `supabase/functions/send-application-email/index.ts` — استبدل محتواه بهذا:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL"); // احتياطي: يُستخدم فقط لو فريق ما عنده إيميل محدد

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  try {
    const { name, contact, target, details, fileUrl, fileName, teamId, teamName, teamEmail, submittedAt } = await req.json();

    // كل فريق له إيميله الخاص (معرّف بملف data/team_contacts.js بالموقع)، فالطلب
    // بيروح مباشرة لصندوق الفريق المطلوب بدل صندوق إداري واحد للجميع.
    const recipient = teamEmail || ADMIN_EMAIL;

    const html = `
      <h2>طلب تعاون جديد — ${teamName || "Black Echo"}</h2>
      <p><b>الاسم:</b> ${name}</p>
      <p><b>وسيلة التواصل:</b> ${contact}</p>
      <p><b>الفرصة المتقدم لها:</b> ${target}</p>
      <p><b>التفاصيل:</b><br>${(details || "لا يوجد").replace(/\n/g, "<br>")}</p>
      ${fileUrl ? `<p><b>الملف المرفق:</b> <a href="${fileUrl}">${fileName}</a></p>` : ""}
      <p style="color:#888">أُرسل بتاريخ: ${submittedAt}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Black Echo <onboarding@resend.dev>", // بدّلها بنطاقك بعد التحقق
        to: [recipient],
        subject: `طلب تعاون جديد (${teamName || "فريق"}): ${target}`,
        html,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders() });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}
```

## 6. ضبط المفاتيح السرية ورفع الوظيفة

```bash
supabase secrets set RESEND_API_KEY=your_resend_key_here
supabase secrets set ADMIN_EMAIL=your_email@example.com
supabase functions deploy send-application-email
```

## 7. التجربة
افتح `community.html` بموقعك المنشور (لازم يكون منشور فعلياً، مش بس محلي)، اذهب لتبويب "فرص التعاون"، دوس "قدّم على فرصة تعاون"، عبّي الفورم وجرب الإرسال.

---

**ملاحظة أمان مهمة:** الـ `anon key` بملف `supabase_config.js` آمن يكون ظاهر بكود الموقع (مصمم لهيك). لكن `RESEND_API_KEY` لازم يضل **بس** داخل `supabase secrets` (الخطوة 5) وما ينحط أبداً بأي ملف بالموقع نفسه — وإلا أي حد يقدر ياخده ويستخدمه لحسابك.
