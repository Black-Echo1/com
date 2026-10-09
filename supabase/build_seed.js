// يحوّل data/anime_db.js + data/catalog_data.js إلى ملفات SQL جاهزة للاستيراد.
// الاستخدام:  node supabase/build_seed.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
function load(file, name) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8").replace("const " + name, "var " + name), ctx);
  return ctx[name];
}
const db = load("data/anime_db.js", "animeDetailsDatabase");
const catalog = load("data/catalog_data.js", "animeCatalog");
const catById = new Map(catalog.map((c, i) => [String(c.id), { ...c, order: i }]));
const q = (v) => v == null || v === "" ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";
const j = (v) => "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";

const out = path.join(__dirname, "seed");
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);

// الأنميات: كل اللي بالكتالوج + كل اللي بقاعدة الحلقات
const ids = [...new Set([...catalog.map((c) => String(c.id)), ...Object.keys(db)])];
const rows = ids.map((id) => {
  const d = db[id] || {}, c = catById.get(id);
  const order = c ? c.order : -1;
  return `(${q(id)},${q(d.title || (c && c.title))},${d.malId || (c && c.malId) || "NULL"},${c && c.isHero ? "true" : "false"},${c ? "true" : "false"},${q(d.dubbingTeam)},${j(d.dubbedCharacters || {})},${q(d.poster)},${q(d.coverBanner)},${q(d.story)},${order + 1})`;
});
fs.writeFileSync(path.join(out, "01_anime.sql"),
  "insert into public.anime (id,title,mal_id,is_hero,in_catalog,dubbing_team,dubbed_characters,poster,cover_banner,story,sort_order) values\n" +
  rows.join(",\n") + "\non conflict (id) do nothing;\n");

// الحلقات: ملفات بحجم ~350KB عشان تنلصق بسهولة
let chunk = [], size = 0, n = 2, total = 0;
const head = "insert into public.episodes (anime_id,number,title,thumbnail,duration,release_date,dubbing_team,servers) values\n";
const flush = () => { if (!chunk.length) return;
  fs.writeFileSync(path.join(out, `${String(n).padStart(2,"0")}_episodes_${n - 1}.sql`), head + chunk.join(",\n") + ";\n");
  n++; chunk = []; size = 0; };
for (const id of Object.keys(db)) for (const e of db[id].episodes || []) {
  const r = `(${q(id)},${Number(e.number)},${q(e.title)},${q(e.thumbnail)},${q(e.duration)},${q(e.date)},${q(e.dubbingTeam)},${j(e.servers || [])})`;
  chunk.push(r); size += r.length; total++;
  if (size > 90000) flush();
}
flush();
console.log("anime:", ids.length, "episodes:", total, "files:", fs.readdirSync(out));
