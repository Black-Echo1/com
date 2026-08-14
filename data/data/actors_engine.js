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
        return (s || "").toString().trim().toLowerCase();
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
            index.set(normalize(handle), handle);
            if (profile && profile.name) index.set(normalize(profile.name), handle);
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
        if (index.has(text)) return index.get(text);

        // مطابقة جزئية (احتياطية) لحالات زي " Makoto_san" مقابل "ماكوتو_سان | Makoto_san"
        for (const [key, handle] of index.entries()) {
            if (key.length >= 3 && (key.includes(text) || text.includes(key))) {
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
    const JIKAN_CACHE_KEY = "he_char_image_cache_v1";
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
            const data = await queueJikanFetch(`https://api.jikan.moe/v4/anime/${malId}/characters`);
            list = (data && data.data) || [];
            cache[animeCacheKey] = { data: list, ts: Date.now() };
            saveImageCache(cache);
        }

        const target = normalizeCharKey(charName);
        let match = list.find((entry) => normalizeCharKey(entry.character && entry.character.name) === target);
        if (!match) {
            // مطابقة جزئية احتياطية (زي "Sakura Haruka" من غير فاصلة)
            match = list.find((entry) => {
                const n = normalizeCharKey(entry.character && entry.character.name);
                return n && (n.includes(target) || target.includes(n));
            });
        }

        const url = (match && match.character && match.character.images &&
            match.character.images.jpg && match.character.images.jpg.image_url) || "";

        cache[cacheKey] = { url, ts: Date.now() };
        saveImageCache(cache);
        return url;
    }

    // كل الأدوار المُستنتَجة تلقائياً من anime_db.js لمؤدٍ معيّن
    // ملاحظة: charImage بترجع فاضية فوراً (مزامنة) وبتتملى لاحقاً عن طريق
    // hydrateRoleImages بعد استدعاء Jikan (لأن الجلب async)
    function getDerivedRoles(handle) {
        const roles = [];
        if (typeof animeDetailsDatabase === "undefined") return roles;

        Object.keys(animeDetailsDatabase).forEach((animeId) => {
            const anime = animeDetailsDatabase[animeId];
            const dc = anime.dubbedCharacters || {};
            Object.keys(dc).forEach((charName) => {
                if (resolveHandle(dc[charName]) === handle) {
                    roles.push({
                        charName: charName,
                        animeId: animeId,
                        animeTitle: prettifyTitle(animeId),
                        malId: anime.malId || null,
                        charImage: "",
                        source: "dubbedCharacters"
                    });
                }
            });
        });
        return roles;
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
        const manualRoles = ((profile && profile.roles) || [])
            .filter((r) => r.charName && r.animeTitle)
            .map((r) => ({
                charName: r.charName,
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

    function getActorProfile(handle) {
        const stored = (typeof dubbersDatabase !== "undefined" && dubbersDatabase[handle]) || null;
        return {
            id: handle,
            name: (stored && stored.name) || handle,
            role: (stored && stored.role) || "مؤدي أصوات",
            logo: (stored && stored.logo) || "",
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
        getAllActorIds,
        resolveCharacterDisplay,
        fetchCharImage,
        hydrateRoleImages
    };
})();