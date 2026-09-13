(() => {
    'use strict';
    const catalogById = new Map((typeof animeCatalog !== 'undefined' ? animeCatalog : []).map((item) => [String(item.id), item]));
    const root = '../';
    const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
    const isDirectVideoUrl = (url) => /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(String(url || '')) || /archive\.org\/download\//i.test(String(url || ''));
    const getAccess = (anime) => {
        const seasons = Array.isArray(anime.seasons) && anime.seasons.length ? anime.seasons : [{ episodes: anime.episodes || [] }];
        const servers = seasons.flatMap((season) => (season.episodes || []).flatMap((episode) => episode.servers || []));
        const hasDirect = servers.some((server) => Boolean(server.direct_url) || isDirectVideoUrl(server.url));
        return hasDirect ? 'free' : 'ads';
    };
    const getPoster = (anime) => anime.poster || catalogById.get(String(anime.id))?.poster || `${root}icon-512.png`;
    const getTitle = (anime) => anime.title || catalogById.get(String(anime.id))?.title || String(anime.id).replace(/_/g, ' ');
    const render = () => {
        const grid = document.getElementById('access-grid');
        if (!grid || typeof animeDetailsDatabase === 'undefined') return;
        const requested = document.body.dataset.access;
        const entries = Object.entries(animeDetailsDatabase).map(([id, anime]) => ({ id, anime, access: getAccess(anime) })).filter((entry) => entry.access === requested);
        const count = document.getElementById('access-count');
        if (count) count.textContent = `${entries.length} عمل`;
        grid.innerHTML = entries.length ? entries.map(({ id, anime, access }) => {
            const episodes = anime.episodes?.length || 0;
            return `<a class="access-card" href="anime.html?id=${encodeURIComponent(id)}"><div class="access-poster"><img src="${esc(getPoster({ ...anime, id }))}" alt="${esc(getTitle({ ...anime, id }))}" loading="lazy"><span class="access-badge ${access}"><i class="fa-solid ${access === 'free' ? 'fa-bolt' : 'fa-rectangle-ad'}"></i> ${access === 'free' ? 'مجاني بدون إعلانات' : 'يتضمن إعلانات'}</span><span class="access-play"><i class="fa-solid fa-play"></i></span></div><div class="access-card-body"><h3>${esc(getTitle({ ...anime, id }))}</h3><span>${episodes} حلقة</span></div></a>`;
        }).join('') : '<div class="access-empty">لا توجد أعمال في هذه القائمة حالياً.</div>';
    };
    document.addEventListener('DOMContentLoaded', render, { once: true });
})();
