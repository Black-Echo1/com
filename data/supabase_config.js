/**
 * إعدادات Supabase — عبّي القيمتين هون بعد ما تنشئ مشروعك على supabase.com
 * (Project Settings → API Keys). كل ملفات الموقع (الكتالوج، نموذج التقديم)
 * بتقرأ من هون.
 *
 * SUPABASE_URL: رابط مشروعك (شكله: https://xxxxxxxx.supabase.co)
 * SUPABASE_ANON_KEY: المفتاح العام — اسمه الجديد "publishable key" (يبدأ
 *                     بـ sb_publishable_...)، وهو نفس وظيفة "anon key" القديم.
 *                     آمن يكون ظاهر بكود الموقع، مصمم لهيك الاستخدام.
 *
 * لو تركتهم فاضيين، الموقع بيكمل شغله عادي بالاعتماد على ملفات JS الثابتة فقط
 * (catalog_data.js / anime_db.js) — لا شيء بينكسر.
 */
window.SUPABASE_CONFIG = {
    url: 'https://ehwjqiljojyafglwphwn.supabase.co',
    anonKey: 'sb_publishable_xClwdJeyoO_zl96kO7r0aA_PvfEIZOZ',
};
