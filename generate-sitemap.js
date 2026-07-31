// ==========================================
// generate-sitemap.js
// يبني sitemap.xml تلقائياً من anime_db.js + dubbers_data.js — بدون أي
// تعديل يدوي. شغّله (node generate-sitemap.js) كل ما تضيف أنمي/حلقة/مؤدي
// جديد قبل ما ترفع الموقع (أو حطه كخطوة تلقائية في الـ CI/CD لو عندك).
//
// الاستخدام:
//   node generate-sitemap.js
// هيكتب sitemap.xml في نفس المجلد، ويطبع عدد الروابط اللي اتضافت.
// ==========================================
const fs = require("fs");
const path = require("path");

const SITE_URL = "https://black-echo1.github.io/com"; // بدون / في الآخر

function loadGlobal(file, globalName) {
    const code = fs.readFileSync(path.join(__dirname, file), "utf8");
    const sandbox = {};
    // eslint-disable-next-line no-new-func
    new Function("window", "module", "exports", code + `\nif (typeof ${globalName} !== 'undefined') { this.__result = ${globalName}; }`)
        .call(sandbox, sandbox, {}, {});
    return sandbox.__result;
}

function xmlEscape(s) {
    return (s || "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function urlEntry(loc, priority) {
    return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <priority>${priority}</priority>\n  </url>`;
}

function main() {
    const animeDb = loadGlobal("data/anime_db.js", "animeDetailsDatabase") || {};
    const dubbersDb = loadGlobal("data/dubbers_data.js", "dubbersDatabase") || {};

    const entries = [];

    // الصفحات الثابتة
    [
        ["/index.html", "1.0"],
        ["/html/browse.html", "0.8"],
        ["/html/dubbers.html", "0.8"],
        ["/html/teams.html", "0.6"],
        ["/html/competition.html", "0.6"],
        ["/html/men.html", "0.5"],
        ["/html/women.html", "0.5"]
    ].forEach(([p, prio]) => entries.push(urlEntry(SITE_URL + p, prio)));

    // صفحة كل أنمي (تلقائياً من anime_db.js)
    Object.keys(animeDb).forEach((animeId) => {
        entries.push(urlEntry(`${SITE_URL}/html/anime.html?id=${encodeURIComponent(animeId)}`, "0.9"));
    });

    // صفحة كل مؤدي مسجَّل يدوياً (المؤدون المكتشَفون تلقائياً من الحلقات
    // بيتحطوا في الموقع فعلياً لحظة إضافة الحلقة، لكن الأداة دي بتقرأ فقط
    // dubbers_data.js لأنه الملف الوحيد اللي متاح وقت البناء بدون تشغيل متصفح.
    // شغّل الأداة دي تاني بعد ما تحفظ أي مؤدي جديد في dubbedCharacters عشان
    // تتحط صفحته هنا كمان لو حبيت الأولوية له في نتائج البحث تكون أعلى)
    Object.keys(dubbersDb).forEach((actorId) => {
        entries.push(urlEntry(`${SITE_URL}/html/actor.html?id=${encodeURIComponent(actorId)}`, "0.7"));
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

    fs.writeFileSync(path.join(__dirname, "sitemap.xml"), xml, "utf8");
    console.log(`تم إنشاء sitemap.xml بعدد ${entries.length} رابط.`);
}

main();
