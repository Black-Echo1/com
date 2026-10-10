// يجلب (مرة وحدة) صورة ونوع وحالة وتقييم وعدد حلقات كل أنمي، ويكتبها بملف SQL جاهز.
// الاستخدام:   node supabase/fill_mal_data.js
// بعدها الصق supabase/seed/09_mal_data.sql في SQL Editor وشغّله.
// المصدر الأول AniList (طلبين فقط لكل الأنميات)، وJikan احتياطي للباقي.
const fs = require("fs"), path = require("path"), vm = require("vm");

if (typeof fetch !== "function") {
  console.log("❌ نسخة Node عندك قديمة (لازم 18 أو أحدث). اكتب: node --version  وارسل لي الرقم.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
function load(file, name) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8").replace("const " + name, "var " + name), ctx);
  return ctx[name];
}
const db = load("data/anime_db.js", "animeDetailsDatabase");
const catalog = load("data/catalog_data.js", "animeCatalog");
const items = new Map(); // id -> malId
catalog.forEach((c) => c.malId && items.set(String(c.id), c.malId));
Object.entries(db).forEach(([id, d]) => d.malId && items.set(id, d.malId));

const q = (v) => v == null ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";
const num = (v) => (v == null || Number.isNaN(Number(v))) ? "NULL" : Number(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastError = "";

// ---- AniList: كل 50 أنمي بطلب واحد
async function fromAniList(malIds) {
  const result = new Map();
  const query = `query ($ids: [Int], $page: Int) { Page(page: $page, perPage: 50) {
    media(idMal_in: $ids, type: ANIME) { idMal format status episodes averageScore coverImage { extraLarge large } } } }`;
  for (let i = 0; i < malIds.length; i += 50) {
    const ids = malIds.slice(i, i + 50);
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { ids, page: 1 } }),
      });
      if (!res.ok) { lastError = "AniList HTTP " + res.status; continue; }
      const json = await res.json();
      for (const m of json?.data?.Page?.media || []) {
        result.set(Number(m.idMal), {
          poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
          type: m.format === "TV_SHORT" ? "TV" : m.format,
          status: m.status === "RELEASING" ? "Currently Airing" : m.status === "FINISHED" ? "Finished Airing" : m.status,
          score: typeof m.averageScore === "number" ? m.averageScore / 10 : null,
          episodes: m.episodes,
        });
      }
    } catch (e) { lastError = "AniList: " + (e.cause?.code || e.message); }
    await sleep(1200);
  }
  return result;
}

// ---- Jikan: احتياطي للأنميات اللي AniList ما رجّعها
async function fromJikan(malId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.jikan.moe/v4/anime/" + malId);
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) { lastError = "Jikan HTTP " + res.status; return null; }
      const d = (await res.json()).data;
      if (!d) return null;
      return { poster: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || null,
               type: d.type, status: d.status, score: d.score, episodes: d.episodes };
    } catch (e) { lastError = "Jikan: " + (e.cause?.code || e.message); await sleep(1500); }
  }
  return null;
}

(async () => {
  const malIds = [...new Set(items.values())];
  console.log(`عدد الأنميات: ${items.size}. جاري الجلب من AniList...`);
  const data = await fromAniList(malIds);
  console.log(`AniList رجّع بيانات ${data.size} من ${malIds.length}`);

  const missing = malIds.filter((m) => !data.has(Number(m)));
  if (missing.length) console.log(`جاري جلب الباقي (${missing.length}) من Jikan...`);
  for (const m of missing) {
    const d = await fromJikan(m);
    if (d) data.set(Number(m), d);
    await sleep(450);
  }

  const lines = [], noData = [];
  for (const [id, malId] of items) {
    const d = data.get(Number(malId));
    if (!d) { noData.push(id); continue; }
    lines.push(`update public.anime set poster = coalesce(poster, ${q(d.poster)}), mal_type = ${q(d.type)}, mal_status = ${q(d.status)}, mal_score = ${num(d.score)}, mal_episodes = ${num(d.episodes)} where id = ${q(id)};`);
  }

  const out = path.join(__dirname, "seed", "09_mal_data.sql");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join("\n") + "\n");
  console.log(`\n✅ انكتب ${lines.length} سطر في: ${out}`);
  if (!lines.length) {
    console.log("❌ ما انجلب أي شي. آخر خطأ: " + (lastError || "غير معروف"));
    console.log("غالباً الإنترنت يحجب AniList/Jikan، أو فيه VPN/جدار حماية. جرّب بعد شوي أو من شبكة ثانية.");
  } else if (noData.length) {
    console.log(`⚠️ ${noData.length} أنمي ما انجلب لهم شي (آخر خطأ: ${lastError || "-"}):`, noData.slice(0, 15).join(" | "));
  }
})();
