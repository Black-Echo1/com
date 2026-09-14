// update_episodes_thumbnails_batch.js
// يغيّر أغلفة (thumbnails) عدة حلقات دفعة وحدة، بدل ما تكتب أمر لكل حلقة لحالها.
//
// طريقة الاستخدام:
//   1) افتح ملف "thumbnail_updates.json" (بجانب هذا السكربت) وعدّله بالحلقات اللي تبيها
//   2) شغّل الأمر التالي:
//
//      node tools/update_episodes_thumbnails_batch.js tools/thumbnail_updates.json
//
// شكل ملف الـ JSON (مصفوفة، كل عنصر فيها حلقة توديها تعديل):
// [
//   { "animeId": "wind breaker", "episode": 1, "thumbnail": "https://example.com/ep1.jpg" },
//   { "animeId": "wind breaker", "episode": 2, "thumbnail": "https://example.com/ep2.jpg" },
//   { "animeId": "jaadugar", "episode": 3, "thumbnail": "https://example.com/ep3.jpg" }
// ]

const fs = require("fs");
const path = require("path");
const { loadDatabase, saveDatabase } = require("./db_helper");

function main() {
    const jsonPathArg = process.argv[2];

    if (!jsonPathArg) {
        console.error("الاستخدام الصحيح:");
        console.error("  node tools/update_episodes_thumbnails_batch.js <مسار_ملف_json>");
        console.error("مثال:");
        console.error("  node tools/update_episodes_thumbnails_batch.js tools/thumbnail_updates.json");
        process.exit(1);
    }

    const jsonPath = path.resolve(jsonPathArg);
    if (!fs.existsSync(jsonPath)) {
        console.error(`ما لقيت الملف: ${jsonPath}`);
        process.exit(1);
    }

    let updates;
    try {
        updates = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (err) {
        console.error("خطأ في قراءة ملف الـ JSON — تأكد إن الصيغة صحيحة:", err.message);
        process.exit(1);
    }

    if (!Array.isArray(updates) || updates.length === 0) {
        console.error("ملف الـ JSON لازم يكون مصفوفة فيها عنصر واحد على الأقل.");
        process.exit(1);
    }

    const { data } = loadDatabase();

    let done = 0;
    let failed = 0;

    updates.forEach((item, index) => {
        const { animeId, episode, thumbnail } = item;

        if (!animeId || episode === undefined || !thumbnail) {
            console.error(`[${index + 1}] ✘ عنصر ناقص (animeId / episode / thumbnail) — تم تجاهله`);
            failed++;
            return;
        }

        const anime = data[animeId];
        if (!anime || !anime.episodes) {
            console.error(`[${index + 1}] ✘ ما لقيت أنمي بالمعرّف "${animeId}"`);
            failed++;
            return;
        }

        const ep = anime.episodes.find((e) => e.number === episode);
        if (!ep) {
            console.error(`[${index + 1}] ✘ ما لقيت حلقة رقم ${episode} في "${animeId}"`);
            failed++;
            return;
        }

        ep.thumbnail = thumbnail;
        done++;
        console.log(`[${index + 1}] ✔ ${animeId} - حلقة ${episode} تم تحديث غلافها`);
    });

    if (done > 0) {
        const backupPath = saveDatabase(data);
        console.log(`\n💾 تم حفظ التعديلات. نسخة احتياطية من الملف القديم: ${backupPath}`);
    }

    console.log(`\n=== انتهى === نجح: ${done} | فشل: ${failed}`);
}

main();