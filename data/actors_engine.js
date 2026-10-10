// ==========================================
// actors_engine.js
// محرك ربط الشخصيات بالمؤدين تلقائياً
//
// يعمل فوق البنية الفعلية الموجودة عندك بدون أي تعديل هدّام:
//   - dubbersDatabase[handle] = { name, role, logo, roles: [...] }  (dubbers_data.js)
//   - animeDetailsDatabase[animeId].dubbedCharacters = { "اسم الشخصية": "نص حر" } (anime_db.js)
//
// المشكلة اللي بيحلها: النص الحر في dubbedCharacters مش لازم يكون نفس
// مفتاح المؤدي (handle) بالظبط — أحياناً يكون اسمه الحقيقي، وأحياناً يكون
// مجرد ترجمة عربية لاسم الشخصية نفسها من غير أي علاقة بمؤدٍ (زي بعض
// أنميات Blue Lock / Dragon Ball Heroes الحالية). المحرك يحاول يربط
// النص ده بمؤدٍ فعلي، ولو ماقدرش، يسيب النص يتعرض عادي كترجمة بدون رابط.
//
// النتيجة: أي حلقة تضيف فيها dubbedCharacters بيبقى فيها اسم مؤدٍ حقيقي
// (سواء مفتاحه أو اسمه بالظبط) هتتربط تلقائياً بصفحة المؤدي، من غير ما
// تحتاج تكتب roles[] يدوياً في dubbers_data.js تاني. أي roles[] موجودة
// فعلاً بتفضل شغالة وبتتدمج تلقائياً مع أي حاجة جديدة من anime_db.js
// (مفيش تكرار في العرض حتى لو نفس الدور موجود في المكانين).
// ==========================================
(function () {
    "use strict";

    function normalize(s) {
        return (s || "").toString().trim().toLocaleLowerCase('ar');
    }

    function compact(s) {
        return normalize(s).replace(/[|،,;:/\\()[\]{}]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function identityKey(s) {
        return compact(s).replace(/[^\p{L}\p{N}]+/gu, '');
    }

    // يجعل معرّف الأنمي (المفتاح) صالحاً كعنوان عرض إن لم يوجد عنوان آخر
    function prettifyTitle(animeId) {
        return animeId.replace(/_/g, " ").trim();
    }

    // فهرس: نص مطابق (مفتاح المؤدي أو اسمه) -> مفتاح المؤدي (handle)
    function buildHandleIndex() {
        const index = new Map();
        if (typeof dubbersDatabase === "undefined") return index;
        Object.keys(dubbersDatabase).forEach((handle) => {
            const profile = dubbersDatabase[handle];
            const values = [handle, profile && profile.name].filter(Boolean);
            values.forEach((value) => {
                index.set(normalize(value), handle);
                index.set(compact(value), handle);
                index.set(identityKey(value), handle);
            });
        });
        return index;
    }

    let _handleIndex = null;
    function getHandleIndex() {
        if (!_handleIndex) _handleIndex = buildHandleIndex();
        return _handleIndex;
    }

    // يحاول تحويل نص حر (من dubbedCharacters) إلى معرّف مؤدٍ مسجَّل فعلياً
    function resolveHandle(rawText) {
        if (!rawText || typeof dubbersDatabase === "undefined") return null;
        const text = normalize(rawText);
        if (text.length < 2) return null;

        const index = getHandleIndex();
        const candidates = [text, compact(text), identityKey(text)].filter(Boolean);
        for (const candidate of candidates) {
            if (index.has(candidate)) return index.get(candidate);
        }

        // مطابقة مرنة للأسماء المختصرة، مع إزالة الفواصل والشرطات والمسافات الزائدة.
        for (const [key, handle] of index.entries()) {
            if (key.length >= 3 && candidates.some((candidate) => key.includes(candidate) || candidate.includes(key))) {
                return handle;
            }
        }
        return null;
    }

    // ==========================================
    // طبقة صور الشخصيات من Jikan (MAL API)
    // بتاخد malId + اسم الشخصية بالإنجليزي/الياباني الأصلي (زي "Sakura, Haruka")
    // وتربطه بصورة الشخصية من MAL. النتائج بتتخزن في localStorage عشان
    // ما نضربش الـ API تاني في كل زيارة (Jikan limit ~3 req/sec, no key needed).
    // ==========================================
    const JIKAN_CACHE_KEY = "he_char_image_cache_v2"; // v2: تجاهل الكاش القديم اللي ممكن يكون محفوظ فيه فشل
    const JIKAN_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // أسبوعين

    function loadImageCache() {
        try {
            const raw = localStorage.getItem(JIKAN_CACHE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function saveImageCache(cache) {
        try { localStorage.setItem(JIKAN_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
    }

    // طابور بسيط بيحترم rate limit بتاع Jikan (طلب كل ~400ms)
    let _jikanQueue = Promise.resolve();
    function queueJikanFetch(url) {
        const run = () => fetch(url).then((r) => {
            if (!r.ok) throw new Error("jikan http " + r.status);
            return r.json();
        });
        const p = _jikanQueue.then(() => new Promise((resolve) => {
            setTimeout(() => resolve(run().catch(() => null)), 400);
        }));
        _jikanQueue = p.catch(() => {});
        return p;
    }

    function normalizeCharKey(s) {
        return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
    }

    // شخصيات AniList بنفس شكل Jikan (صفحتين × 25 = أشهر 50 شخصية)
    async function fetchAniListCharacters(malId) {
        try {
            const query = `query ($malId: Int) { Media(idMal: $malId, type: ANIME) {
                a: characters(sort: FAVOURITES_DESC, page: 1, perPage: 25) { nodes { name { full } image { large medium } } }
                b: characters(sort: FAVOURITES_DESC, page: 2, perPage: 25) { nodes { name { full } image { large medium } } } } }`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ query, variables: { malId: Number(malId) } }), signal: controller.signal
            });
            clearTimeout(timer);
            if (!res.ok) return null;
            const media = (await res.json())?.data?.Media;
            const nodes = [...(media?.a?.nodes || []), ...(media?.b?.nodes || [])];
            return nodes.filter((n) => n?.name?.full).map((n) => ({ character: { name: n.name.full, images: { jpg: { image_url: n.image?.large || n.image?.medium || '' } } } }));
        } catch (_) { return null; }
    }

    // مطابقة الاسم بغض النظر عن ترتيبه ("Tachibana, Kotoha" = "Kotoha Tachibana")
    function charTokens(s) {
        return (s || '').toString().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean).sort();
    }

    // بيرجع Promise<string> (رابط الصورة أو "" لو ماتلاقاش)
    async function fetchCharImage(malId, charName) {
        if (!malId || !charName) return "";
        const cache = loadImageCache();
        const cacheKey = `${malId}::${normalizeCharKey(charName)}`;
        const cached = cache[cacheKey];
        if (cached && (Date.now() - cached.ts) < JIKAN_CACHE_TTL_MS) {
            return cached.url || "";
        }

        const animeCacheKey = `anime_chars::${malId}`;
        let list = cache[animeCacheKey] && (Date.now() - cache[animeCacheKey].ts) < JIKAN_CACHE_TTL_MS
            ? cache[animeCacheKey].data
            : null;

        if (!list) {
            // AniList أول (أسرع وأثبت)، وJikan احتياطي
            list = await fetchAniListCharacters(malId);
            if (!list || !list.length) {
                const data = await queueJikanFetch(`https://api.jikan.moe/v4/anime/${malId}/characters`);
                list = (data && data.data) || [];
            }
            // لو فشل الجلب (قائمة فاضية) ما نحفظ شي، عشان فشل مؤقت ما يعطّل الصور أسبوعين
            if (!list || !list.length) return "";
            cache[animeCacheKey] = { data: list, ts: Date.now() };
            saveImageCache(cache);
        }

        const target = normalizeCharKey(charName);
        const tTokens = charTokens(charName);
        const sameTokens = (a, b) => a.length && a.length === b.length && a.every((t, i) => t === b[i]);
        let match = list.find((entry) => normalizeCharKey(entry.character && entry.character.name) === target)
            || list.find((entry) => sameTokens(charTokens(entry.character && entry.character.name), tTokens));
        if (!match) {
            // مطابقة جزئية احتياطية: كل كلمات الاسم الأقصر موجودة بالأطول
            match = list.find((entry) => {
                const eTokens = charTokens(entry.character && entry.character.name);
                if (!eTokens.length || !tTokens.length) return false;
                const [short, long] = eTokens.length <= tTokens.length ? [eTokens, tTokens] : [tTokens, eTokens];
                return short.length >= 1 && short.every((t) => long.includes(t));
            });
        }

        const url = (match && match.character && match.character.images &&
            match.character.images.jpg && match.character.images.jpg.image_url) || "";

        // الصورة الموجودة نحفظها أسبوعين، وعدم الإيجاد ساعة فقط
        cache[cacheKey] = { url, ts: url ? Date.now() : Date.now() - (JIKAN_CACHE_TTL_MS - 60 * 60 * 1000) };
        saveImageCache(cache);
        return url;
    }

    // كل الأدوار المُستنتَجة تلقائياً من anime_db.js لمؤدٍ معيّن
    // ملاحظة: charImage بترجع فاضية فوراً (مزامنة) وبتتملى لاحقاً عن طريق
    // hydrateRoleImages بعد استدعاء Jikan (لأن الجلب async)
    function getAliasHandles(handle) {
        if (typeof dubbersDatabase === 'undefined') return [handle];
        const profile = dubbersDatabase[handle] || {};
        const key = identityKey(profile.name || handle);
        return Object.keys(dubbersDatabase).filter((candidate) => {
            const item = dubbersDatabase[candidate] || {};
            return identityKey(item.name || candidate) === key;
        });
    }

    function getDerivedRoles(handle) {
        const roles = [];
        if (typeof animeDetailsDatabase === "undefined") return roles;
        const aliases = new Set(getAliasHandles(handle));
        Object.keys(animeDetailsDatabase).forEach((animeId) => {
            const anime = animeDetailsDatabase[animeId];
            const dc = anime.dubbedCharacters || {};
            Object.keys(dc).forEach((charName) => {
                const resolved = resolveHandle(dc[charName]);
                if (resolved && aliases.has(resolved)) {
                    roles.push({
                        charName: charName,
                        animeId: animeId,
                        animeTitle: anime.title || prettifyTitle(animeId),
                        malId: anime.malId || null,
                        charImage: (anime.characterImages && anime.characterImages[charName]) || "",
                        source: "dubbedCharacters"
                    });
                }
            });
        });
        const unique = new Map();
        roles.forEach((role) => unique.set(`${normalize(role.animeId)}::${normalize(role.charName)}`, role));
        return [...unique.values()];
    }

    // بتاخد مصفوفة roles (زي اللي بترجع من getActorAggregate) وبتملى charImage
    // لكل دور ماله malId عن طريق Jikan، وبتنده onUpdate(role, index) كل ما صورة توصل
    // عشان الصفحة تقدر تحدّث الكارت في الـ DOM مباشرة بدل ما تستنى الكل
    function hydrateRoleImages(roles, onUpdate) {
        roles.forEach((role, i) => {
            if (role.charImage || !role.malId) return; // عنده صورة يدوية بالفعل أو مفيش malId
            fetchCharImage(role.malId, role.charName).then((url) => {
                if (url) {
                    role.charImage = url;
                    if (typeof onUpdate === "function") onUpdate(role, i);
                }
            });
        });
    }

    // يدمج roles[] اليدوية الموجودة فعلاً مع أي أدوار جديدة مُستنتَجة من anime_db.js، بدون تكرار
    function getActorAggregate(handle) {
        const profile = (typeof dubbersDatabase !== "undefined" && dubbersDatabase[handle]) || null;
        const manualRoles = getAliasHandles(handle).flatMap((alias) => ((dubbersDatabase && dubbersDatabase[alias] && dubbersDatabase[alias].roles) || []))
            .filter((r) => r.charName && r.animeTitle)
            .map((r) => ({
                charName: r.charName.trim(),
                animeId: r.animeId || r.animeTitle,
                animeTitle: r.animeTitle,
                charImage: r.charImage || "",
                source: "manual"
            }));

        const derived = getDerivedRoles(handle).filter((d) => {
            return !manualRoles.some((m) =>
                normalize(m.animeId) === normalize(d.animeId) && normalize(m.charName) === normalize(d.charName)
            );
        });

        const combined = manualRoles.concat(derived);
        const animeIds = new Set(combined.map((r) => normalize(r.animeId)));

        return {
            roles: combined,
            workCount: animeIds.size,
            characterCount: combined.length
        };
    }

    const profileDescriptions = [
        'صوت شغوف يضيف احتراماً وصدقاً لكل شخصية يؤديها.',
        'مؤدٍ محترف يوازن بين الإحساس، وضوح النطق، وروح المشهد.',
        'موهبة واعدة تتطور بثبات وتتعامل مع الدبلجة كفن مسؤول.',
        'حضور صوتي مميز يشارك بحماس في بناء تجربة عربية أصيلة.',
        'أداء متزن يدل على تقدير كبير للعمل الجماعي وثقافة الدبلجة.',
        'صوت مجتهد يثبت أن التفاصيل الصغيرة تصنع شخصية لا تُنسى.'
    ];

    function profileDescription(handle, name) {
        const seed = Array.from(`${handle}:${name}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return profileDescriptions[seed % profileDescriptions.length];
    }

    function getActorProfile(handle) {
        const stored = (typeof dubbersDatabase !== "undefined" && dubbersDatabase[handle]) || null;
        const aggregate = getActorAggregate(handle);
        const tier = aggregate.characterCount >= 3 || /مخرج|قائد|مكساج/.test((stored && stored.role) || '') ? 'محترف' : 'متوسط';
        const name = (stored && stored.name) || handle;
        return {
            id: handle,
            name,
            role: (stored && stored.role) || "مؤدي أصوات",
            logo: (stored && stored.logo) || "",
            description: (stored && stored.bio) ? stored.bio : profileDescription(handle, name),
            tier,
            isAutoGenerated: !stored
        };
    }

    function getAllActorIds() {
        return typeof dubbersDatabase !== "undefined" ? Object.keys(dubbersDatabase) : [];
    }

    // تُستخدم من صفحة الأنمي: بالنظر لنص dubbedCharacters الحر، ترجع بيانات جاهزة للعرض والربط
    function resolveCharacterDisplay(rawText, fallbackText) {
        const handle = resolveHandle(rawText);
        if (handle) {
            const profile = getActorProfile(handle);
            return { displayName: profile.name, actorId: handle, linked: true };
        }
        // ماقدرناش نربطه بمؤدٍ مسجَّل — نعرضه كترجمة نص فقط بدون رابط (زي ما كان يحصل قبل كده بالظبط)
        return { displayName: rawText || fallbackText, actorId: null, linked: false };
    }

    window.ActorsEngine = {
        resolveHandle,
        getDerivedRoles,
        getActorAggregate,
        getActorProfile,
        getAliasHandles,
        getAllActorIds,
        resolveCharacterDisplay,
        fetchCharImage,
        hydrateRoleImages
    };
})();