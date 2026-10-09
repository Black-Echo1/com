/**
 * db_loader.js — طبقة قراءة البيانات من Supabase مع رجوع تلقائي للملفات الثابتة.
 * لو supabase_config.js فاضي أو فشل الاتصال، الموقع يكمل بالملفات القديمة (anime_db.js / catalog_data.js).
 *
 * الاستخدام داخل أي صفحة (بعد supabase_config.js):
 *   const catalog = await DB.getCatalog();   // قائمة خفيفة بدون حلقات (للرئيسية والكتالوج)
 *   const anime   = await DB.getAnime(id);   // أنمي واحد مع حلقاته وسيرفراته
 *   const all     = await DB.getAllAnime();  // كل الأنميات بشكل animeDetailsDatabase القديم
 */
(function () {
    const cfg = window.SUPABASE_CONFIG || {};
    const enabled = !!(cfg.url && cfg.anonKey);
    const cache = {};

    async function rest(path) {
        const res = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + path, {
            headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }
        });
        if (!res.ok) throw new Error('Supabase ' + res.status);
        return res.json();
    }

    const toEpisode = (e) => ({
        number: Number(e.number), title: e.title, thumbnail: e.thumbnail,
        duration: e.duration, date: e.release_date, dubbingTeam: e.dubbing_team || undefined,
        servers: e.servers || []
    });
    const toAnime = (a, episodes) => ({
        title: a.title || undefined, malId: a.mal_id, dubbingTeam: a.dubbing_team,
        dubbedCharacters: a.dubbed_characters || {}, poster: a.poster || undefined,
        coverBanner: a.cover_banner || undefined, story: a.story || undefined,
        episodes: episodes || []
    });

    async function getCatalog() {
        if (cache.catalog) return cache.catalog;
        if (enabled) {
            try {
                const rows = await rest('anime?select=id,title,mal_id,is_hero&in_catalog=eq.true&order=sort_order.asc');
                return (cache.catalog = rows.map((r) => ({ id: r.id, title: r.title, malId: r.mal_id, isHero: r.is_hero })));
            } catch (e) { console.warn('DB.getCatalog fallback:', e); }
        }
        return typeof animeCatalog !== 'undefined' ? animeCatalog : [];
    }

    async function getAnime(id) {
        if (enabled) {
            try {
                const k = encodeURIComponent(id);
                const [a] = await rest('anime?select=*&id=eq.' + k);
                if (a) {
                    const eps = await rest('episodes?select=*&anime_id=eq.' + k + '&order=number.asc');
                    return toAnime(a, eps.map(toEpisode));
                }
            } catch (e) { console.warn('DB.getAnime fallback:', e); }
        }
        return typeof animeDetailsDatabase !== 'undefined' ? animeDetailsDatabase[id] || null : null;
    }

    async function getAllAnime() {
        if (cache.all) return cache.all;
        if (enabled) {
            try {
                const [anime, eps] = await Promise.all([
                    rest('anime?select=*&limit=1000'),
                    rest('episodes?select=*&order=anime_id.asc,number.asc&limit=10000')
                ]);
                const out = {};
                anime.forEach((a) => { out[a.id] = toAnime(a, []); });
                eps.forEach((e) => { if (out[e.anime_id]) out[e.anime_id].episodes.push(toEpisode(e)); });
                return (cache.all = out);
            } catch (e) { console.warn('DB.getAllAnime fallback:', e); }
        }
        return typeof animeDetailsDatabase !== 'undefined' ? animeDetailsDatabase : {};
    }

    window.DB = { enabled, getCatalog, getAnime, getAllAnime };
})();
