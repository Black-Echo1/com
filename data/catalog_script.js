(() => {
    'use strict';

    const BATCH_SIZE = 8;
    const INITIAL_ITEMS = 12;
    const MAL_CACHE_TTL = 24 * 60 * 60 * 1000;
    const rootPrefix = /\/html(?:\/|$)/.test(window.location.pathname) ? '../' : './';
    const fallbackPoster = `${rootPrefix}icon-512.png`;
    window.fullCatalog = window.fullCatalog || [];

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function mapStatusToArabic(status) {
        if (!status) return 'غير معروف';
        const normalized = String(status).toLowerCase();
        if (normalized.includes('currently airing') || normalized.includes('ongoing')) return 'مستمر';
        if (normalized.includes('finished') || normalized.includes('completed')) return 'مكتمل';
        return 'غير معروف';
    }

    function mapTypeToArabic(type) {
        if (!type) return 'أنمي';
        const normalized = String(type).toUpperCase();
        if (normalized === 'TV') return 'مسلسل';
        if (normalized === 'MOVIE') return 'فيلم';
        if (normalized === 'OVA' || normalized === 'ONA') return 'أوفا / أونا';
        if (normalized === 'SPECIAL') return 'حلقة خاصة';
        return normalized;
    }

    // AniList's GraphQL API allows 90 requests/minute (vs Jikan's much stricter,
    // often-overloaded limit) and looks up anime directly by MAL id (idMal), so the
    // malId values already stored in catalog_data.js need no changes. AniList is
    // tried first; Jikan is kept only as a fallback for the rare anime AniList
    // doesn't have. A small adapter reshapes AniList's response into the same
    // field layout Jikan returns, so normalizeEntry() and the rest of this file
    // don't need to change at all.
    const ANILIST_QUERY = `query ($malId: Int) { Media(idMal: $malId, type: ANIME) {
        idMal title { romaji english } type status episodes score: averageScore
        coverImage { extraLarge large } bannerImage }
    }`;

    function adaptAniListToJikanShape(media) {
        if (!media) return null;
        const poster = media.coverImage?.extraLarge || media.coverImage?.large || null;
        return {
            title: media.title?.english || media.title?.romaji,
            type: media.type,
            status: media.status === 'RELEASING' ? 'Currently Airing' : media.status === 'FINISHED' ? 'Finished Airing' : media.status,
            score: typeof media.score === 'number' ? media.score / 10 : null,
            episodes: media.episodes,
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

    // Jikan's free public API is shared by everyone and gets overloaded (429/504)
    // independent of how careful this site is. Retrying aggressively on an already
    // overloaded server just makes things slower for everyone, including this page.
    // So: one request per anime, a wide gap between requests, and on failure the
    // card still renders immediately with its known title (no spinner, no retry
    // loop) — a later successful fetch (e.g. from cache on a repeat visit) will
    // fill in the poster/rating without the user ever seeing a delay.
    let _jikanQueue = Promise.resolve();
    const queueJikanFetch = (malId, signal) => {
        const run = () => fetch(`https://api.jikan.moe/v4/anime/${encodeURIComponent(malId)}`, { signal });
        const p = _jikanQueue.then(() => new Promise((resolve) => setTimeout(resolve, 1000)));
        _jikanQueue = p.catch(() => {});
        return p.then(run);
    };

    async function fetchFromJikan(malId, signal) {
        const response = await queueJikanFetch(malId, signal);
        if (!response.ok) return null;
        const json = await response.json();
        return json?.data || null;
    }

    async function getAnimeDataFromMAL(malId) {
        if (!malId) return null;
        const cacheKey = `anime_mal_${malId}`;
        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            if (cached?.data && Date.now() - cached.timestamp < MAL_CACHE_TTL) return cached.data;
        } catch (_) {
            localStorage.removeItem(cacheKey);
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            let data = null;
            try {
                data = await fetchFromAniList(malId, controller.signal);
            } catch (_) { /* fall through to Jikan */ }
            if (!data) data = await fetchFromJikan(malId, controller.signal);
            clearTimeout(timeout);
            if (data) localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
            return data;
        } catch (_) {
            return null;
        }
    }

    function normalizeEntry(source, apiData) {
        const poster = apiData?.images?.jpg?.large_image_url || apiData?.images?.jpg?.image_url || fallbackPoster;
        return {
            id: String(source.id),
            title: source.title || apiData?.title_english || apiData?.title || source.id,
            type: mapTypeToArabic(apiData?.type),
            status: mapStatusToArabic(apiData?.status),
            rating: apiData?.score || '—',
            poster,
            banner: apiData?.images?.jpg?.large_image_url || poster,
            episodes: apiData?.episodes || 0,
            isHero: Boolean(source.isHero)
        };
    }

    function renderAnimeCard(grid, anime) {
        if (!grid || grid.querySelector(`[data-anime-id="${CSS.escape(anime.id)}"]`)) return;
        const card = document.createElement('article');
        card.className = 'anime-card';
        card.dataset.animeId = anime.id;
        card.dataset.animeTitle = anime.title;
        card.dataset.animePoster = anime.poster;
        card.dataset.animeType = anime.type;
        card.dataset.animeStatus = anime.status;
        card.dataset.animeEpisodes = anime.episodes || 0;
        card.dataset.animeRating = anime.rating || '';
        const badgeClass = anime.status === 'مكتمل' ? 'completed' : '';
        card.innerHTML = `
            <div class="anime-card-image">
                <img src="${escapeHtml(anime.poster)}" alt="${escapeHtml(anime.title)}" loading="lazy" decoding="async">
                <span class="status-badge ${badgeClass}">${escapeHtml(anime.status)}</span>
                ${anime.episodes ? `<span class="episodes-badge"><i class="fa-solid fa-list-ol" aria-hidden="true"></i> ${escapeHtml(anime.episodes)} حلقة</span>` : ''}
            </div>
            <div class="card-info">
                <h3>${escapeHtml(anime.title)}</h3>
                <div class="card-stats"><span>${escapeHtml(anime.type)}</span><span><i class="fa-solid fa-star star-icon" aria-hidden="true"></i> ${escapeHtml(anime.rating)}</span></div>
            </div>`;
        card.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            window.location.href = `anime.html?id=${encodeURIComponent(anime.id)}`;
        });
        grid.appendChild(card);
        window.BlackEcho?.enhanceAnimeCard(card);
    }

    function renderHero(hero, anime) {
        if (!hero || !anime) return;
        hero.innerHTML = `
            <div class="hero-slide active" style="background-image:linear-gradient(0deg, rgba(7,8,12,.94), rgba(7,8,12,.18)), url('${escapeHtml(anime.banner)}')">
                <div class="hero-content">
                    <span class="hero-kicker">مختارات Black Echo</span>
                    <h1>${escapeHtml(anime.title)}</h1>
                    <div class="hero-meta"><span class="badge">${escapeHtml(anime.status)}</span><span class="type">${escapeHtml(anime.type)}</span><span class="rating"><i class="fa-solid fa-star"></i> ${escapeHtml(anime.rating)}</span></div>
                    <button class="hero-btn" type="button"><i class="fa-solid fa-play"></i> شاهد التفاصيل والحلقات</button>
                </div>
            </div>`;
        hero.querySelector('.hero-btn')?.addEventListener('click', () => { window.location.href = `anime.html?id=${encodeURIComponent(anime.id)}`; });
    }

    async function processEntry(source, grid, hero, state) {
        const hasCache = Boolean(localStorage.getItem(`anime_mal_${source.malId}`));
        const apiData = await getAnimeDataFromMAL(source.malId);
        const entry = normalizeEntry(source, apiData);
        window.fullCatalog.push(entry);
        window.BlackEcho?.rememberAnime(entry);
        renderAnimeCard(grid, entry);
        if (!state.heroRendered && (entry.isHero || window.fullCatalog.length === 1)) {
            renderHero(hero, entry);
            state.heroRendered = true;
        }
        if (!hasCache) await delay(240);
    }

    async function loadCatalogInBatches() {
        const grid = document.getElementById('recent-releases-grid');
        const hero = document.getElementById('hero-slider');
        const loader = document.getElementById('loader-wrapper');
        if (!grid || typeof animeCatalog === 'undefined' || !Array.isArray(animeCatalog)) {
            if (loader) loader.hidden = true;
            return;
        }
        const sources = animeCatalog.filter((entry) => entry?.id);
        const state = { next: 0, heroRendered: false, busy: false };
        grid.innerHTML = '';

        // Real lazy loading: only the anime actually visible on screen get requested.
        // A "sentinel" element sits after the grid; a new batch loads only once the
        // user scrolls it into view — never automatically in the background. This is
        // what keeps the number of Jikan requests proportional to what the visitor
        // actually scrolls through, instead of fetching the whole catalog regardless.
        const sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'height:1px;width:100%;grid-column:1/-1;';
        grid.after(sentinel);

        const processNextBatch = async (count) => {
            if (state.busy || state.next >= sources.length) return;
            state.busy = true;
            const batch = sources.slice(state.next, state.next + count);
            state.next += batch.length;
            for (const source of batch) await processEntry(source, grid, hero, state);
            if (loader) { loader.classList.add('loaded'); loader.hidden = true; }
            state.busy = false;
            if (state.next >= sources.length) observer.disconnect();
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) processNextBatch(BATCH_SIZE);
        }, { rootMargin: '600px' });
        observer.observe(sentinel);

        await processNextBatch(INITIAL_ITEMS);
        if (!state.heroRendered && window.fullCatalog[0]) renderHero(hero, window.fullCatalog[0]);
    }

    document.addEventListener('DOMContentLoaded', loadCatalogInBatches, { once: true });
})();
