// generate_ouo_links.js
// يمر على كل حلقة وكل سيرفر داخل anime_db.js، وإذا ما كان عنده "ouo_url"،
// يستخدم API تبع ouo.io عشان يولّد رابط مختصر ويحفظه.
//
// طريقة التشغيل:
//   1) خذ الـ API Key من حسابك على ouo.io (Settings > API)
//   2) شغّل الأمر التالي في نفس مجلد anime_db.js:
//
//      OUO_API_KEY=ضع_مفتاحك_هنا node tools/generate_ouo_links.js
//
//   ملاحظة: لا تكتب المفتاح داخل الكود نفسه ولا ترفعه لأي مكان عام —
//   مرره فقط كمتغير بيئة وقت التشغيل زي ما هو موضح فوق.

const { loadDatabase, saveDatabase } = require("./db_helper");

const API_KEY = process.env.OUO_API_KEY;
const DELAY_MS = 1200; // تأخير بين كل طلب وآخر لتفادي أي حظر من طرف ouo.io

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shortenLink(destinationUrl) {
    const apiUrl = `https://ouo.io/api/${API_KEY}?s=${encodeURIComponent(destinationUrl)}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const text = (await res.text()).trim();
    if (!text.startsWith("http")) {
        throw new Error(`رد غير متوقع من ouo.io: ${text}`);
    }
    return text;
}

async function main() {
    if (!API_KEY) {
        console.error("خطأ: لازم تمرر مفتاح API عبر متغير البيئة OUO_API_KEY.");
        console.error("مثال: OUO_API_KEY=xxxxxxx node tools/generate_ouo_links.js");
        process.exit(1);
    }

    console.log("جاري تحميل anime_db.js ...");
    const { data } = loadDatabase();

    let total = 0;
    let toProcess = [];

    for (const animeId of Object.keys(data)) {
        const anime = data[animeId];
        if (!anime.episodes) continue;

        anime.episodes.forEach((ep, epIndex) => {
            if (!ep.servers) return;
            ep.servers.forEach((server, sIndex) => {
                total++;
                if (!server.ouo_url && server.url) {
                    toProcess.push({ animeId, epIndex, sIndex, url: server.url });
                }
            });
        });
    }

    console.log(`إجمالي السيرفرات: ${total} — الناقصة (بدون ouo_url): ${toProcess.length}`);

    if (toProcess.length === 0) {
        console.log("كل السيرفرات عندها ouo_url بالفعل. لا شيء لعمله.");
        return;
    }

    let done = 0;
    let failed = 0;

    for (const item of toProcess) {
        const { animeId, epIndex, sIndex, url } = item;
        try {
            const shortLink = await shortenLink(url);
            data[animeId].episodes[epIndex].servers[sIndex].ouo_url = shortLink;
            done++;
            console.log(`[${done}/${toProcess.length}] ✔ ${animeId} - حلقة ${epIndex + 1} - سيرفر ${sIndex + 1}`);
        } catch (err) {
            failed++;
            console.error(`[${done + failed}/${toProcess.length}] ✘ فشل لـ ${animeId} - حلقة ${epIndex + 1}: ${err.message}`);
        }

        // نحفظ تدريجياً كل 10 عمليات ناجحة حتى لو انقطع التشغيل بالمنتصف ما نخسر شغل
        if ((done + failed) % 10 === 0) {
            saveDatabase(data);
            console.log("💾 تم حفظ تقدم مؤقت في anime_db.js");
        }

        await delay(DELAY_MS);
    }

    const backupPath = saveDatabase(data);
    console.log("\n=== انتهى ===");
    console.log(`نجح: ${done} | فشل: ${failed}`);
    console.log(`تم حفظ نسخة احتياطية من الملف القديم في: ${backupPath}`);
}

main().catch((err) => {
    console.error("خطأ عام:", err);
    process.exit(1);
});