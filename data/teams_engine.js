// ==========================================
// teams_engine.js
// محرك ربط الأنميات بالفرق تلقائياً
//
// يعمل فوق البنية الفعلية الموجودة عندك بدون أي تعديل هدّام:
//   - teamsDatabase[teamId] = { id, name, logo, banner, description, members[], producedAnime[] }  (teams.js)
//   - animeDetailsDatabase[animeId].dubbingTeam = "نص حر" (زي "دبلجة: فريق Black Echo")  (anime_db.js)
//
// المشكلة اللي بيحلها: dubbingTeam نص حر مش مفتاح فريق (teamId) ومش لازم
// يتطابق حرفياً مع team.name (فيه بادئة "دبلجة:" أحياناً، فروقات مسافات، إلخ).
// المحرك يحاول يربط النص ده بفريق مسجَّل فعلياً في teamsDatabase، ولو قدر،
// بيضيف الأنمي ده تلقائياً لقائمة "إنتاجات الفريق" في صفحة الفريق —
// من غير ما تحتاج تروح تعدّل producedAnime[] يدوياً في teams.js في كل مرة.
//
// أي anime عنده dubbingTeam بيتطابق (كامل أو جزئي) مع اسم فريق حقيقي
// هيتضاف تلقائياً. لو مفيش تطابق، الأنمي مبيتضافش لأي فريق (زي ما كان
// يحصل قبل كده بالظبط — مفيش تغيير في العرض غير الإضافة الجديدة).
// ==========================================
(function () {
    "use strict";

    function normalize(s) {
        return (s || "").toString().trim().toLowerCase();
    }

    // بيشيل كلمات زي "دبلجة:" أو "فريق" عشان يقرّب النص الحر من اسم الفريق الفعلي
    function stripNoiseWords(s) {
        return normalize(s)
            .replace(/دبلجة\s*:?/g, "")
            .replace(/فريق/g, "")
            .replace(/team/gi, "")
            .replace(/[:،,]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function prettifyTitle(animeId) {
        return animeId.replace(/_/g, " ").trim();
    }

    // فهرس: نص مطابق (اسم الفريق منضّف) -> teamId
    function buildTeamIndex() {
        const index = new Map();
        if (typeof teamsDatabase === "undefined") return index;
        Object.keys(teamsDatabase).forEach((teamId) => {
            const team = teamsDatabase[teamId];
            index.set(stripNoiseWords(teamId), teamId);
            if (team && team.name) index.set(stripNoiseWords(team.name), teamId);
        });
        return index;
    }

    let _teamIndex = null;
    function getTeamIndex() {
        if (!_teamIndex) _teamIndex = buildTeamIndex();
        return _teamIndex;
    }

    // يحاول تحويل نص dubbingTeam الحر إلى teamId مسجَّل فعلياً
    function resolveTeamId(rawText) {
        if (!rawText || typeof teamsDatabase === "undefined") return null;
        const text = stripNoiseWords(rawText);
        if (text.length < 2) return null;

        const index = getTeamIndex();
        if (index.has(text)) return index.get(text);

        for (const [key, teamId] of index.entries()) {
            if (key.length >= 3 && (key.includes(text) || text.includes(key))) {
                return teamId;
            }
        }
        return null;
    }

    // أول صورة حلقة متاحة كصورة غلاف احتياطية للأنمي (لو مفيش poster مخزّن حالياً)
    function firstEpisodeThumbnail(anime) {
        const ep = (anime.episodes || [])[0];
        return (ep && ep.thumbnail) || "";
    }

    // كل الأنميات المُستنتَجة تلقائياً من anime_db.js لفريق معيّن
    function getDerivedProductions(teamId) {
        const productions = [];
        if (typeof animeDetailsDatabase === "undefined") return productions;

        Object.keys(animeDetailsDatabase).forEach((animeId) => {
            const anime = animeDetailsDatabase[animeId];
            if (resolveTeamId(anime.dubbingTeam) === teamId) {
                productions.push({
                    id: animeId,
                    title: prettifyTitle(animeId),
                    poster: firstEpisodeThumbnail(anime),
                    source: "dubbingTeam"
                });
            }
        });
        return productions;
    }

    // يدمج producedAnime[] اليدوية الموجودة فعلاً مع أي إنتاجات جديدة مُستنتَجة
    // من anime_db.js، بدون تكرار (نفس الـ id بيتحسب مرة واحدة بس)
    function getTeamAggregate(teamId) {
        const team = (typeof teamsDatabase !== "undefined" && teamsDatabase[teamId]) || null;
        const manual = ((team && team.producedAnime) || [])
            .filter((a) => a.id && a.title)
            .map((a) => ({ id: a.id, title: a.title, poster: a.poster || "", source: "manual" }));

        const derived = getDerivedProductions(teamId).filter((d) => {
            return !manual.some((m) => normalize(m.id) === normalize(d.id));
        });

        return {
            producedAnime: manual.concat(derived),
            productionCount: manual.length + derived.length
        };
    }

    window.TeamsEngine = {
        resolveTeamId,
        getDerivedProductions,
        getTeamAggregate
    };
})();