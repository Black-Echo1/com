// يملأ كتالوج الأنمي (data/catalog_data.js) ببيانات MyAnimeList مرة وحدة:
// الصورة، النوع، الحالة، التقييم، عدد الحلقات. بعدها الصفحة الرئيسية ما بتحتاج أي طلب خارجي.
//
// التشغيل (من مجلد المشروع، يحتاج Node 18 أو أحدث):
//   node data/tools/enrich_catalog.js            ← بيكمّل الأنميات الناقصة فقط
//   node data/tools/enrich_catalog.js --force    ← بيحدّث الكل (مثلاً لتحديث التقييمات)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.JIKAN_BASE || 'https://api.jikan.moe/v4';
const FILE = path.join(__dirname, '..', 'catalog_data.js');
const FORCE = process.argv.includes('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mapStatus = (v) => {
    const t = String(v || '').toLowerCase();
    if (t.includes('airing') && !t.includes('finished')) return 'مستمر';
    if (t.includes('ongoing')) return 'مستمر';
    if (t.includes('finished') || t.includes('completed')) return 'مكتمل';
    return 'غير معروف';
};
const mapType = (v) => ({ TV: 'مسلسل', MOVIE: 'فيلم', OVA: 'أوفا / أونا', ONA: 'أوفا / أونا' }[String(v || '').toUpperCase()] || 'أنمي');

async function fetchAnime(malId) {
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const res = await fetch(`${BASE}/anime/${malId}`);
            if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
            if (!res.ok) return null;
            const json = await res.json();
            return json.data || null;
        } catch (_) { await sleep(1000); }
    }
    return null;
}

(async () => {
    const original = fs.readFileSync(FILE, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const text = original.replace(/\r\n/g, '\n');

    const start = text.indexOf('const animeCatalog = [');
    const end = text.indexOf('\n];', start);
    if (start === -1 || end === -1) throw new Error('ما لقيت مصفوفة animeCatalog بالملف');
    const arrayCode = text.slice(start, end + 3);
    const ctx = vm.createContext({});
    vm.runInContext(arrayCode + '\nthis.__catalog = animeCatalog;', ctx);
    const catalog = ctx.__catalog;

    const todo = catalog.filter((item) => item.malId && (FORCE || !item.poster));
    console.log(`الكتالوج: ${catalog.length} أنمي، المطلوب تحديثه: ${todo.length}`);

    let done = 0, failed = 0;
    for (const item of todo) {
        const data = await fetchAnime(item.malId);
        if (data) {
            item.poster = data.images?.jpg?.large_image_url || data.images?.jpg?.image_url || item.poster || '';
            item.type = mapType(data.type);
            item.status = mapStatus(data.status);
            item.rating = data.score || null;
            item.episodes = data.episodes || 0;
            done++;
        } else {
            failed++;
            console.log(`  فشل: ${item.title} (malId ${item.malId})`);
        }
        console.log(`[${done + failed}/${todo.length}] ${item.title}`);
        await sleep(450); // Jikan: حد أقصى 3 طلبات بالثانية
    }

    const ser = (item) => {
        const lines = Object.keys(item).map((key) => `        ${key}: ${JSON.stringify(item[key])}`);
        return `    {\n${lines.join(',\n')}\n    }`;
    };
    const newArray = `const animeCatalog = [\n${catalog.map(ser).join(',\n')}\n];`;
    const output = (text.slice(0, start) + newArray + text.slice(end + 3)).replace(/\n/g, eol);

    fs.writeFileSync(FILE.replace(/\.js$/, '.backup.js'), original);
    fs.writeFileSync(FILE, output);
    console.log(`تم. نجح ${done}، فشل ${failed}. نسخة احتياطية: catalog_data.backup.js`);
    if (failed) console.log('أعد تشغيل نفس الأمر لإكمال الناقص.');
})();
