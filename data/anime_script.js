// AniList's GraphQL API allows 90 requests/minute (vs Jikan's much stricter,
// often-overloaded limit) and looks up anime directly by MAL id (idMal), so the
// malId values already stored in the catalog need no changes. AniList is tried
// first; Jikan stays only as a fallback for the rare anime AniList lacks. This
// adapter reshapes AniList's response into Jikan's field layout so the rest of
// this file (genres, synopsis, images.jpg.large_image_url, etc.) needs no changes.
const ANILIST_QUERY = `query ($malId: Int) { Media(idMal: $malId, type: ANIME) {
    idMal title { romaji english } type status episodes score: averageScore
    description(asHtml: false) genres coverImage { extraLarge large } bannerImage }
}`;

function adaptAniListToJikanShape(media) {
    if (!media) return null;
    const poster = media.coverImage?.extraLarge || media.coverImage?.large || null;
    return {
        title: media.title?.romaji || media.title?.english,
        title_english: media.title?.english,
        type: media.type,
        status: media.status === 'RELEASING' ? 'Currently Airing' : media.status === 'FINISHED' ? 'Finished Airing' : media.status,
        score: typeof media.score === 'number' ? media.score / 10 : null,
        episodes: media.episodes,
        synopsis: media.description ? media.description.replace(/<[^>]+>/g, '') : null,
        genres: Array.isArray(media.genres) ? media.genres.map((name) => ({ name })) : [],
        images: { jpg: { large_image_url: poster, image_url: poster } },
    };
}

async function fetchFromAniList(malId, signal) {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { malId: Number(malId) } }),
        signal,
    });
    if (!response.ok) return null;
    const json = await response.json();
    return adaptAniListToJikanShape(json?.data?.Media);
}

// طلب واحد بس لكل أنمي بهذه الصفحة (لا طابور معقد، لا إعادة محاولة متكررة) — Jikan
// سيرفر عام مشترك، وإعادة المحاولة بقوة وقت الضغط عليه بتزيد المشكلة سوءاً بدل حلها.
async function fetchJikan(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('خطأ في جلب بيانات MAL:', error);
        return null;
    }
}

// دالة جلب البيانات الأساسية للأنمي
async function getAnimeDataFromMAL(malId) {
    const cacheKey = `anime_mal_${malId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            const now = new Date().getTime();
            if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
                return parsed.data;
            }
        } catch (e) { localStorage.removeItem(cacheKey); }
    }

    let data = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        data = await fetchFromAniList(malId, controller.signal);
    } catch (_) { /* fall through to Jikan */ }
    clearTimeout(timeoutId);

    if (!data) {
        const json = await fetchJikan(`https://api.jikan.moe/v4/anime/${malId}`);
        data = json?.data || null;
    }
    if (data) {
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: new Date().getTime(),
            data
        }));
        return data;
    }
    return null;
}

// شخصيات الأنمي: AniList أول (أسرع وأثبت من Jikan)، وJikan احتياطي لو فشل.
// نحوّل الشكل لنفس شكل Jikan عشان بقية الكود ما يتغير.
const ANILIST_CHARS_QUERY = `query ($malId: Int) { Media(idMal: $malId, type: ANIME) {
    characters(sort: FAVOURITES_DESC, perPage: 20) { edges { node { name { full } image { large medium } favourites } } } } }`;

async function fetchCharactersFromAniList(malId, signal) {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: ANILIST_CHARS_QUERY, variables: { malId: Number(malId) } }),
        signal,
    });
    if (!response.ok) return null;
    const json = await response.json();
    const edges = json?.data?.Media?.characters?.edges;
    if (!Array.isArray(edges)) return null;
    return edges
        .filter((edge) => edge?.node?.name?.full)
        .map((edge) => {
            const img = edge.node.image?.large || edge.node.image?.medium || '';
            return { favorites: edge.node.favourites || 0, character: { name: edge.node.name.full, images: { jpg: { image_url: img } } } };
        });
}

async function getAnimeCharactersFromMAL(malId) {
    const cacheKey = `anime_chars_v2_${malId}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            if (new Date().getTime() - parsed.timestamp < 24 * 60 * 60 * 1000) return parsed.data;
        } catch (e) { localStorage.removeItem(cacheKey); }
    }

    let data = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try { data = await fetchCharactersFromAniList(malId, controller.signal); } catch (_) { /* نرجع لـ Jikan */ }
    clearTimeout(timeoutId);

    if (!data || !data.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const json = await fetchJikan(`https://api.jikan.moe/v4/anime/${malId}/characters`);
        data = json?.data || null;
    }
    if (data && data.length) {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: new Date().getTime(), data }));
        return data;
    }
    return null;
}

// دوال تحويل النصوص إلى العربية
function mapStatusToArabic(status) {
    if (!status) return "غير معروف";
    status = status.toLowerCase();
    if (status.includes("currently airing") || status.includes("ongoing")) return "مستمر";
    if (status.includes("finished") || status.includes("completed")) return "مكتمل";
    return "غير معروف";
}

function mapTypeToArabic(type) {
    if (!type) return "غير معروف";
    type = type.toUpperCase();
    if (type === "TV") return "مسلسل";
    if (type === "MOVIE") return "فيلم";
    if (type === "OVA" || type === "ONA") return "أوفا / أونا";
    if (type === "SPECIAL") return "حلقة خاصة";
    return type;
}

function getSeasonCollections(localData) {
    if (Array.isArray(localData.seasons) && localData.seasons.length) {
        return localData.seasons.map((season, index) => ({
            id: season.id || `season-${index + 1}`,
            title: season.title || season.name || `الموسم ${index + 1}`,
            episodes: Array.isArray(season.episodes) ? season.episodes : []
        }));
    }
    return [{ id: "season-1", title: "الموسم 1", episodes: localData.episodes || [] }];
}

function getProgressKey(animeId, seasonIndex, epIndex) {
    return `blackEchoProgress_${animeId}_${seasonIndex}_${epIndex}`;
}

function formatWatchTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function updateNavigationButtons() {
    const state = window.blackEchoWatchState;
    const prev = document.getElementById("prev-episode-btn");
    const next = document.getElementById("next-episode-btn");
    if (!state || !prev || !next) return;
    const first = state.seasonIndex === 0 && state.episodeIndex === 0;
    const lastSeason = state.seasons.length - 1;
    const lastEpisode = state.seasons[lastSeason].episodes.length - 1;
    const last = state.seasonIndex === lastSeason && state.episodeIndex === lastEpisode;
    prev.disabled = first;
    next.disabled = last;
}

function restoreSavedProgress(animeId, seasonIndex, epIndex) {
    const video = document.getElementById("video-element");
    const label = document.getElementById("watch-progress-label");
    const saved = Number(localStorage.getItem(getProgressKey(animeId, seasonIndex, epIndex)) || 0);
    if (saved > 5 && video) {
        video.addEventListener("loadedmetadata", () => {
            if (saved < video.duration - 8) video.currentTime = saved;
        }, { once: true });
        if (label) label.innerText = `استكمالاً من ${formatWatchTime(saved)}`;
    } else if (label) {
        label.innerText = "سيتم حفظ تقدم المشاهدة تلقائياً";
    }
}

window.playAdjacentEpisode = function(direction) {
    const state = window.blackEchoWatchState;
    if (!state) return;
    let seasonIndex = state.seasonIndex;
    let episodeIndex = state.episodeIndex + direction;
    while (seasonIndex >= 0 && seasonIndex < state.seasons.length) {
        const count = state.seasons[seasonIndex].episodes.length;
        if (episodeIndex >= 0 && episodeIndex < count) {
            renderSeason(seasonIndex);
            window.playEpisode(state.animeId, episodeIndex, seasonIndex, true);
            return;
        }
        if (direction > 0) { seasonIndex += 1; episodeIndex = 0; }
        else { seasonIndex -= 1; episodeIndex = seasonIndex >= 0 ? state.seasons[seasonIndex].episodes.length - 1 : -1; }
    }
};

window.playEpisode = function(animeId, epIndex, seasonIndex = 0, keepScroll = false) {
    const state = window.blackEchoWatchState;
    const season = state?.seasons?.[seasonIndex];
    const epData = season?.episodes?.[epIndex];
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    const video = document.getElementById("video-element");
    const titleElement = document.getElementById("playing-episode-title");
    const serversContainer = document.getElementById("servers-container");

    if (playerContainer && epData?.servers?.length) {
        window.blackEchoWatchState = { ...state, animeId, seasonIndex, episodeIndex: epIndex };
        document.querySelectorAll('.ep-card.is-playing').forEach((card) => card.classList.remove('is-playing'));
        document.querySelector(`[data-episode-index="${epIndex}"]`)?.classList.add('is-playing');
        localStorage.setItem(`blackEchoLastEpisode_${animeId}`, JSON.stringify({ seasonIndex, epIndex }));
        titleElement.innerText = `جاري تشغيل: ${epData.title}`;
        serversContainer.innerHTML = "";
        epData.servers.forEach((server, index) => {
            const btn = document.createElement("button");
            btn.className = `server-btn ${index === 0 ? 'active' : ''}`;
            btn.innerText = server.name;
            btn.onclick = () => {
                document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                changeServer(server.direct_url || server.url);
            };
            serversContainer.appendChild(btn);
        });
        const downloadBtn = document.createElement("a");
        downloadBtn.href = epData.servers[0].ouo_url || epData.servers[0].url;
        downloadBtn.target = "_blank";
        downloadBtn.rel = "noopener noreferrer";
        downloadBtn.className = "download-action-btn";
        downloadBtn.innerHTML = "📥 تحميل الحلقة";
        serversContainer.appendChild(downloadBtn);
        serversContainer.appendChild(buildServerHelp());
        playerContainer.hidden = false;
        playerContainer.style.display = "block";
        updateNavigationButtons();
        restoreSavedProgress(animeId, seasonIndex, epIndex);
        changeServer(epData.servers[0].direct_url || epData.servers[0].url);
        if (!keepScroll) {
            window.setTimeout(() => {
                playerContainer.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                playerContainer.focus({ preventScroll: true });
            }, 40);
        }
    } else alert("لا توجد سيرفرات متاحة لهذه الحلقة حالياً.");
};

// سيرفرات كثيرة تحتاج تفتح نافذة (إعلان/تفعيل) عشان يشتغل المشغّل؛ وضعنا الافتراضي يمنع النوافذ للأمان.
// "وضع التوافق" يسمح بها لهذا الجهاز فقط، و"فتح في صفحة مستقلة" يفتح السيرفر كصفحة كاملة.
const BE_SANDBOX_STRICT = "allow-scripts allow-same-origin allow-presentation";
const BE_SANDBOX_COMPAT = BE_SANDBOX_STRICT + " allow-popups allow-forms";
function beCompatOn() { try { return sessionStorage.getItem("be-compat") === "1"; } catch (_) { return false; } }

function buildServerHelp() {
    const box = document.createElement("div");
    box.className = "server-help";
    const msg = document.createElement("p");
    msg.textContent = "السيرفر ما اشتغل؟ جرّب:";
    const compat = document.createElement("button");
    compat.type = "button";
    compat.textContent = beCompatOn() ? "وضع التوافق: مفعّل ✓" : "وضع التوافق";
    compat.addEventListener("click", () => {
        try { sessionStorage.setItem("be-compat", "1"); } catch (_) {}
        compat.textContent = "وضع التوافق: مفعّل ✓";
        if (window.__beServerUrl) changeServer(window.__beServerUrl);
    });
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "فتح في صفحة مستقلة";
    open.addEventListener("click", () => { if (window.__beServerUrl) window.open(window.__beServerUrl, "_blank", "noopener,noreferrer"); });
    const tip = document.createElement("small");
    tip.textContent = "وإذا استمرت المشكلة: عطّل مانع الإعلانات (أو دروع المتصفح) لهذا الموقع، أو جرّب سيرفر ثاني.";
    box.append(msg, compat, open, tip);
    return box;
}

function changeServer(url) {
    const iframe = document.getElementById("video-iframe");
    const video = document.getElementById("video-element");
    window.__beServerUrl = url;
    const isDirectVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
    if (isDirectVideo && video) {
        iframe.hidden = true;
        video.hidden = false;
        video.src = url;
        video.load();
    } else {
        video.hidden = true;
        video.pause();
        video.removeAttribute("src");
        iframe.hidden = false;
        iframe.setAttribute("sandbox", beCompatOn() ? BE_SANDBOX_COMPAT : BE_SANDBOX_STRICT);
        iframe.src = url;
    }
}

window.closeInlinePlayer = function() {
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    const video = document.getElementById("video-element");
    playerContainer.hidden = true;
    playerContainer.style.display = "none";
    iframe.src = "";
    video.pause();
    video.removeAttribute("src");
};

window.renderSeason = function(seasonIndex) {
    const state = window.blackEchoWatchState;
    const season = state?.seasons?.[seasonIndex];
    const episodesGrid = document.getElementById("episodes-grid");
    const tabs = document.getElementById("season-tabs");
    if (!season || !episodesGrid) return;
    state.seasonIndex = seasonIndex;
    episodesGrid.innerHTML = season.episodes.map((ep, index) => `
        <div class="ep-card" data-episode-index="${index}" onclick="playEpisode('${state.animeId}', ${index}, ${seasonIndex})" style="cursor:pointer;">
            <div class="ep-thumb-container">
                <img loading="lazy" decoding="async" src="${ep.thumbnail}" alt="${ep.title}">
                <span class="ep-duration">${ep.duration || ""}</span>
                <div class="ep-play-overlay"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="ep-card-info"><h4>${ep.title}</h4><p>تاريخ النشر: ${ep.date || "غير محدد"}</p></div>
        </div>`).join("");
    document.getElementById("ep-count").innerText = `${season.episodes.length} حلقة`;
    tabs?.querySelectorAll("button").forEach((button, index) => button.classList.toggle("active", index === seasonIndex));
    const saved = JSON.parse(localStorage.getItem(`blackEchoLastEpisode_${state.animeId}`) || "null");
    if (saved?.seasonIndex === seasonIndex) document.querySelector(`[data-episode-index="${saved.epIndex}"]`)?.classList.add("is-playing");
};

function setupProgressTracking() {
    const video = document.getElementById("video-element");
    if (!video) return;
    let lastSaved = 0;
    const save = () => {
        const state = window.blackEchoWatchState;
        if (!state || !video.duration || !Number.isFinite(video.currentTime)) return;
        const now = Date.now();
        if (now - lastSaved < 2500 && !video.ended) return;
        lastSaved = now;
        const key = getProgressKey(state.animeId, state.seasonIndex, state.episodeIndex);
        if (video.ended || video.currentTime >= video.duration - 8) localStorage.removeItem(key);
        else localStorage.setItem(key, String(Math.floor(video.currentTime)));
        const value = document.getElementById("watch-progress-value");
        if (value) value.innerText = video.ended ? "تمت المشاهدة" : formatWatchTime(video.currentTime);
    };
    video.addEventListener("timeupdate", save);
    video.addEventListener("pause", save);
    video.addEventListener("ended", save);
    window.addEventListener("beforeunload", save);
}

// دالة لترجمة النصوص من الإنجليزية إلى العربية باستخدام جوجل
async function translateToArabic(text) {
    if (!text) return "لا تتوفر قصة حالياً.";
    
    let cleanText = text.replace("[Written by MAL Rewrite]", "").trim();
    
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(cleanText)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        let translatedText = "";
        for (let i = 0; i < data[0].length; i++) {
            translatedText += data[0][i][0];
        }
        return translatedText;
    } catch (error) {
        console.error("خطأ في الترجمة:", error);
        return cleanText; 
    }
}

// تجهيز الصفحة عند التحميل
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || 'wind_breaker'; 
    await DB.installSlim(); // يجهّز بيانات المؤدين للمحرك
    const localData = await DB.getAnime(animeId);

    if (!localData) {
        document.getElementById("anime-title").innerText = "الأنمي غير موجود في قاعدة بياناتنا";
        return;
    }

    document.getElementById("anime-title").innerText = "جاري تحميل البيانات...";
    const apiData = await getAnimeDataFromMAL(localData.malId);

    const title = localData.title || (apiData ? (apiData.title_english || apiData.title) : "اسم الأنمي");
    const poster = apiData ? (apiData.images?.jpg?.large_image_url || localData.poster) : localData.poster;
    const coverBanner = localData.coverBanner || poster;
    const status = apiData ? mapStatusToArabic(apiData.status) : "غير معروف";
    const type = apiData ? mapTypeToArabic(apiData.type) : "غير معروف";
    const rating = apiData && apiData.score ? `★ ${apiData.score}` : "★ -";
    
    // === [ترجمة القصة تلقائياً عند عدم توفرها محلياً] ===
    let rawStory = "";
    if (localData.story && localData.story.trim() !== "") {
        rawStory = localData.story;
    } else if (apiData && apiData.synopsis) {
        document.getElementById("anime-story").innerText = "جاري ترجمة القصة...";
        rawStory = await translateToArabic(apiData.synopsis);
    } else {
        rawStory = "لا تتوفر قصة حالياً.";
    }
    
    // === [كود التصنيفات مع إضافة فريق الدبلجة] ===
    let genres = apiData && apiData.genres ? apiData.genres.map(g => g.name) : [];
    
    if (localData.dubbingTeam && localData.dubbingTeam.trim() !== "") {
        genres.unshift(localData.dubbingTeam);
    }
    
    document.getElementById("anime-cover").style.backgroundImage = `url('${coverBanner}')`;
    document.getElementById("anime-poster-img").src = poster;
    document.getElementById("anime-title").innerText = title;
    document.getElementById("anime-status").innerText = status;
    document.getElementById("anime-type").innerText = type;
    document.getElementById("anime-rating").innerText = rating;
    const seasons = getSeasonCollections(localData);
    window.blackEchoWatchState = { animeId, seasons, seasonIndex: 0, episodeIndex: 0 };
    const seasonTabs = document.getElementById("season-tabs");
    if (seasonTabs) {
        seasonTabs.innerHTML = seasons.map((season, index) => `<button type="button" class="season-tab ${index === 0 ? "active" : ""}" onclick="renderSeason(${index})"><i class="fa-solid fa-layer-group"></i> ${season.title}</button>`).join("");
    }

    const storyContainer = document.getElementById("anime-story");
    const limit = 250; 
    if (rawStory.length > limit) {
        const shortStory = rawStory.substring(0, limit) + "... ";
        storyContainer.innerHTML = `
            <span id="story-text">${shortStory}</span>
            <span id="read-more-btn" style="color: var(--accent-red); cursor: pointer; font-weight: bold; margin-right: 5px; text-decoration: underline;">اقرأ المزيد</span>
        `;
        document.getElementById("read-more-btn").addEventListener("click", function() {
            const textSpan = document.getElementById("story-text");
            if (this.innerText === "اقرأ المزيد") {
                textSpan.innerText = rawStory;
                this.innerText = "عرض أقل";
            } else {
                textSpan.innerText = shortStory;
                this.innerText = "اقرأ المزيد";
            }
        });
    } else {
        storyContainer.innerText = rawStory;
    }

    const genresContainer = document.getElementById("anime-genres");
    if(genresContainer) {
        genresContainer.innerHTML = ""; 
        genres.forEach((genre, index) => {
            if(index === 0 && localData.dubbingTeam) {
                genresContainer.innerHTML += `<span class="dub-team-tag" style="background-color: var(--accent-grey);">${genre}</span>`;
            } else {
                genresContainer.innerHTML += `<span>${genre}</span>`;
            }
        });
    }

    renderSeason(0);
    setupProgressTracking();

    const charactersContainer = document.getElementById("anime-characters"); 
    
    if (charactersContainer) {
        const dubbed = localData.dubbedCharacters || {};
        const normName = (n) => String(n).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').sort().join(' ');
        const dubbedByNorm = new Map(Object.keys(dubbed).map((k) => [normName(k), dubbed[k]]));
        const cards = new Map(); // اسم الشخصية (مطبَّع) -> { slot, hasImg }
        charactersContainer.innerHTML = "";

        const setImage = (charName, url) => {
            const c = cards.get(normName(charName));
            if (!c || c.hasImg || !url) return;
            const img = document.createElement("img");
            img.loading = "lazy"; img.decoding = "async"; img.src = url; img.alt = charName;
            img.style.cssText = "width:100px;height:150px;object-fit:cover;display:block;";
            c.slot.textContent = ""; c.slot.appendChild(img); c.hasImg = true;
        };

        const makeCard = (charName, charImage) => {
            const raw = dubbed[charName] !== undefined ? dubbed[charName] : dubbedByNorm.get(normName(charName));
            const resolved = (typeof window.ActorsEngine !== "undefined")
                ? window.ActorsEngine.resolveCharacterDisplay(raw, charName)
                : { displayName: raw || charName, actorId: null, linked: false };

            const card = document.createElement("div");
            card.className = "character-card";
            card.style.cssText = "display:inline-block;width:120px;margin:10px;text-align:center;vertical-align:top;";
            const slot = document.createElement("div");
            slot.textContent = "🎭";
            slot.style.cssText = "width:100px;height:150px;margin:0 auto;border-radius:8px;overflow:hidden;background:#15151b;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 8px rgba(0,0,0,0.2);";
            const title = document.createElement("h5");
            title.style.cssText = "margin-top:8px;font-size:13px;word-wrap:break-word;";
            title.textContent = charName;
            card.append(slot, title);

            if (resolved.linked) {
                // مدبلج مسجّل ومؤكَّد: اسمه تحت الشخصية برابط صفحته
                const link = document.createElement("a");
                link.href = "actor.html?id=" + encodeURIComponent(resolved.actorId);
                link.style.cssText = "display:block;font-size:11px;color:var(--he-red-2,#ff3b3b);margin-top:2px;text-decoration:none;";
                link.textContent = "🎙️ " + resolved.displayName;
                card.appendChild(link);
            } else {
                // اسم قديم مكتوب بالبيانات (غير مسجّل بالموقع): نعرضه نصاً تحت الشخصية بدون رابط
                if (raw) {
                    const label = document.createElement("span");
                    label.style.cssText = "display:block;font-size:11px;color:#a0a0ad;margin-top:2px;";
                    label.textContent = "🎙️ " + raw;
                    card.appendChild(label);
                }
                if (window.RoleClaims) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.textContent = "🎙️ دبلجتها؟";
                    btn.style.cssText = "margin-top:6px;font-size:11px;padding:4px 8px;border-radius:8px;border:1px solid #2a2a33;background:#15151b;color:#c9c9d3;cursor:pointer;font-family:inherit;";
                    btn.addEventListener("click", () => window.RoleClaims.open({ animeId, animeTitle: localData.title || animeId, characterName: charName, characterImage: charImage }));
                    card.appendChild(btn);
                }
            }
            charactersContainer.appendChild(card);
            cards.set(normName(charName), { slot, hasImg: false });
            if (charImage) setImage(charName, charImage);
        };

        // 1) الشخصيات المعروفة من بياناتنا تظهر فوراً مع أسماء مؤديها، بدون انتظار MAL
        Object.keys(dubbed).forEach((charName) => makeCard(charName, null));

        // 2) بقية الشخصيات (وصور كل الشخصيات) تجي من MAL لما تجهز
        const note = document.createElement("p");
        note.textContent = "جاري تحميل بقية الشخصيات...";
        note.style.cssText = "width:100%;color:#7d7d8a;font-size:13px;margin:6px 10px;";
        charactersContainer.appendChild(note);
        let charsApiData = null;
        try { charsApiData = await getAnimeCharactersFromMAL(localData.malId); } catch (e) { console.warn("characters:", e); }
        note.remove();

        if (charsApiData && charsApiData.length > 0) {
            charsApiData.sort((a, b) => b.favorites - a.favorites).slice(0, 20).forEach((charData) => {
                const name = charData.character.name;
                const image = charData.character.images.jpg.image_url;
                if (cards.has(normName(name))) setImage(name, image); else makeCard(name, image);
            });
        } else if (!cards.size) {
            charactersContainer.textContent = "لا توجد بيانات للشخصيات حالياً.";
        }
    }
});
