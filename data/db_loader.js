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

    // لو الحلقة ما لها غلاف، نستخدم غلاف الأنمي نفسه
    const toEpisode = (e, animePoster) => ({
        number: Number(e.number), title: e.title, thumbnail: e.thumbnail || animePoster || undefined,
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
            const base = 'id,title,mal_id,is_hero';
            const filter = '&in_catalog=eq.true&order=sort_order.asc';
            let rows;
            try { rows = await rest('anime?select=' + base + ',poster,mal_type,mal_status,mal_score,mal_episodes' + filter); }
            catch (e) {
                // الأعمدة الجديدة ما انضافت بعد (patch_mal_columns.sql): نكمل بالأساسي
                try { rows = await rest('anime?select=' + base + filter); }
                catch (e2) { console.warn('DB.getCatalog fallback:', e2); }
            }
            if (rows) {
                return (cache.catalog = rows.map((r) => ({
                    id: r.id, title: r.title, malId: r.mal_id, isHero: r.is_hero,
                    poster: r.poster || undefined, malType: r.mal_type || undefined,
                    malStatus: r.mal_status || undefined, score: r.mal_score ? Number(r.mal_score) : undefined,
                    episodes: r.mal_episodes || undefined
                })));
            }
        }
        return typeof animeCatalog !== 'undefined' ? animeCatalog : [];
    }

    // الشخصيات المؤكَّدة من الإدارة (شخصية → مدبلج). لو الجدول ما انشأ بعد نتجاهله.
    let rolesCache = null;
    async function getRoles() {
        if (rolesCache) return rolesCache;
        try { rolesCache = await rest('character_roles?select=anime_id,character_name,dubber_id&limit=5000'); }
        catch (_) { rolesCache = []; }
        return rolesCache;
    }

    async function getAnime(id) {
        if (enabled) {
            try {
                const k = encodeURIComponent(id);
                const [a] = await rest('anime?select=*&id=eq.' + k);
                if (a) {
                    const eps = await rest('episodes?select=*&anime_id=eq.' + k + '&order=number.asc');
                    const anime = toAnime(a, eps.map((x) => toEpisode(x, a.poster)));
                    (await getRoles()).filter((r) => r.anime_id === id).forEach((r) => { anime.dubbedCharacters[r.character_name] = r.dubber_id; });
                    return anime;
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
                eps.forEach((e) => { if (out[e.anime_id]) out[e.anime_id].episodes.push(toEpisode(e, out[e.anime_id].poster)); });
                return (cache.all = out);
            } catch (e) { console.warn('DB.getAllAnime fallback:', e); }
        }
        return typeof animeDetailsDatabase !== 'undefined' ? animeDetailsDatabase : {};
    }

    // نسخة خفيفة (بدون حلقات): كافية لمحرك المؤدين والفرق اللي يقرأ الأدوار والشخصيات فقط
    async function getAnimeSlim() {
        const rows = await rest('anime?select=id,mal_id,dubbing_team,dubbed_characters&limit=1000');
        const out = {};
        rows.forEach((a) => { out[a.id] = { malId: a.mal_id, dubbingTeam: a.dubbing_team, dubbedCharacters: a.dubbed_characters || {}, episodes: [] }; });
        return out;
    }

    // مسار الملفات الثابتة القديمة (للرجوع الاحتياطي)
    const loaderSrc = (document.currentScript && document.currentScript.src) || '';
    const dataBase = loaderSrc.replace(/db_loader\.js.*$/, '');
    function loadStatic(file) {
        return new Promise((resolve) => {
            if (!dataBase) return resolve();
            const el = document.createElement('script');
            el.src = dataBase + file;
            el.onload = el.onerror = () => resolve();
            document.head.appendChild(el);
        });
    }

    let installed = null;
    // يجهّز المتغيرات العامة اللي تعتمد عليها بقية سكربتات الموقع.
    // لو Supabase شغّال: يعبّي animeDetailsDatabase (خفيفة) ويحدّث animeCatalog من القاعدة.
    // لو لا: يحمّل anime_db.js القديم كالسابق.
    function installSlim() {
        if (installed) return installed;
        installed = (async () => {
            if (enabled) {
                try {
                    const [slim, cat, roles] = await Promise.all([getAnimeSlim(), getCatalog(), getRoles()]);
                    roles.forEach((r) => { if (slim[r.anime_id]) slim[r.anime_id].dubbedCharacters[r.character_name] = r.dubber_id; });
                    window.animeDetailsDatabase = slim;
                    // خريطة (مجاني / بإعلانات) لكل أنمي — من الـ view، بدون تحميل الحلقات
                    try {
                        const acc = await rest('anime_access?select=id,is_free&limit=1000');
                        window.animeAccessMap = {};
                        acc.forEach((r) => { window.animeAccessMap[r.id] = !!r.is_free; });
                    } catch (_) { /* patch_catalog_speed.sql ما انشغل بعد */ }
                    if (typeof animeCatalog !== 'undefined' && Array.isArray(animeCatalog) && cat.length) {
                        animeCatalog.splice(0, animeCatalog.length, ...cat);
                    }
                    return;
                } catch (e) { console.warn('DB.installSlim fallback:', e); }
            }
            if (typeof animeDetailsDatabase === 'undefined') await loadStatic('anime_db.js');
        })();
        return installed;
    }

    window.DB = { enabled, getCatalog, getAnime, getAllAnime, getAnimeSlim, installSlim };
})();
