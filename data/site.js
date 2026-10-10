(() => {
    'use strict';

    const pageIsInsideHtml = /\/html(?:\/|$)/.test(window.location.pathname);
    const rootPrefix = pageIsInsideHtml ? '../' : './';
    const catalogScriptUrl = `${rootPrefix}data/catalog_data.js`;
    const favoritesKey = 'blackEchoFavorites';
    const ratingsKey = 'blackEchoRatings';
    const metadataKey = 'blackEchoAnimeMeta';

    const safeParse = (value, fallback) => {
        try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
    };

    const getFavorites = () => safeParse(localStorage.getItem(favoritesKey), []);
    const getRatings = () => safeParse(localStorage.getItem(ratingsKey), {});
    const getMetadata = () => safeParse(localStorage.getItem(metadataKey), {});

    const setFavorites = (items) => localStorage.setItem(favoritesKey, JSON.stringify([...new Set(items)]));
    const setRatings = (items) => localStorage.setItem(ratingsKey, JSON.stringify(items));

    const htmlEscape = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));

    const assetPath = (path) => `${rootPrefix}${path}`;
    const animePath = (id) => `${rootPrefix}html/anime.html?id=${encodeURIComponent(id)}`;

    const isFavorite = (id) => getFavorites().includes(String(id));
    const getRating = (id) => Number(getRatings()[String(id)] || 0);

    const rememberAnime = (entry) => {
        if (!entry || !entry.id) return;
        const metadata = getMetadata();
        const previous = metadata[String(entry.id)] || {};
        metadata[String(entry.id)] = {
            ...previous,
            id: String(entry.id),
            title: entry.title || previous.title || String(entry.id),
            poster: entry.poster || previous.poster || '',
            type: entry.type || previous.type || 'أنمي',
            status: entry.status || previous.status || 'غير معروف',
            episodes: entry.episodes || previous.episodes || entry.episodeCount || previous.episodes || 0,
            rating: entry.rating || previous.rating || 'N/A'
        };
        localStorage.setItem(metadataKey, JSON.stringify(metadata));
    };

    const updateFavoriteCount = () => {
        document.querySelectorAll('[data-favorites-count]').forEach((node) => {
            node.textContent = String(getFavorites().length);
        });
    };

    const renderStars = (id, target) => {
        if (!target) return;
        const selected = getRating(id);
        target.innerHTML = '';
        target.setAttribute('aria-label', selected ? `تقييمك ${selected} من 5` : 'قيّم هذا الأنمي');
        for (let value = 1; value <= 5; value += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `be-star ${value <= selected ? 'is-selected' : ''}`;
            button.setAttribute('aria-label', `قيّم ${value} من 5`);
            button.textContent = value <= selected ? '★' : '☆';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const ratings = getRatings();
                ratings[String(id)] = value;
                setRatings(ratings);
                renderStars(id, target);
                document.dispatchEvent(new CustomEvent('blackecho:rating', { detail: { id: String(id), value } }));
            });
            target.appendChild(button);
        }
    };

    const enhanceAnimeCard = (card) => {
        if (!card || card.dataset.beEnhanced === 'true' || !card.dataset.animeId) return;
        card.dataset.beEnhanced = 'true';
        const id = String(card.dataset.animeId);
        const title = card.dataset.animeTitle || card.querySelector('h3, h4')?.textContent?.trim() || id;
        const image = card.querySelector('img');
        rememberAnime({
            id,
            title,
            poster: card.dataset.animePoster || image?.currentSrc || image?.src || '',
            type: card.dataset.animeType || '',
            status: card.dataset.animeStatus || '',
            episodes: card.dataset.animeEpisodes || 0,
            rating: card.dataset.animeRating || ''
        });

        const imageWrap = card.querySelector('.he-card-img-wrap, .anime-card-image, .card-poster, .be-card-image');
        if (imageWrap && !imageWrap.querySelector('.be-favorite-button')) {
            const favoriteButton = document.createElement('button');
            favoriteButton.type = 'button';
            favoriteButton.className = `be-favorite-button ${isFavorite(id) ? 'is-active' : ''}`;
            favoriteButton.setAttribute('aria-label', isFavorite(id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
            favoriteButton.innerHTML = `<i class="fa-solid fa-heart" aria-hidden="true"></i>`;
            favoriteButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const favorites = getFavorites();
                const index = favorites.indexOf(id);
                if (index >= 0) favorites.splice(index, 1); else favorites.push(id);
                setFavorites(favorites);
                favoriteButton.classList.toggle('is-active', index < 0);
                favoriteButton.setAttribute('aria-label', index < 0 ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
                updateFavoriteCount();
                document.dispatchEvent(new CustomEvent('blackecho:favorites', { detail: { id, active: index < 0 } }));
            });
            imageWrap.appendChild(favoriteButton);
        }

        const body = card.querySelector('.he-card-body, .card-info, .be-card-body') || card;
        if (!body.querySelector('.be-rating')) {
            const rating = document.createElement('div');
            rating.className = 'be-rating';
            body.appendChild(rating);
            renderStars(id, rating);
        }
    };

    const enhanceAllCards = (root = document) => {
        root.querySelectorAll?.('[data-anime-id]').forEach(enhanceAnimeCard);
    };

    const ensureCatalog = () => {
        if (typeof animeCatalog !== 'undefined' && Array.isArray(animeCatalog)) return Promise.resolve(animeCatalog);
        if (window.__blackEchoCatalogPromise) return window.__blackEchoCatalogPromise;
        window.__blackEchoCatalogPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${catalogScriptUrl}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(typeof animeCatalog !== 'undefined' ? animeCatalog : []), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = catalogScriptUrl;
            script.async = true;
            script.onload = () => resolve(typeof animeCatalog !== 'undefined' ? animeCatalog : []);
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return window.__blackEchoCatalogPromise;
    };

    const getSearchItems = (query) => {
        const normalized = query.toLocaleLowerCase('ar').trim();
        const loaded = Array.isArray(window.fullCatalog) ? window.fullCatalog : [];
        const raw = typeof animeCatalog !== 'undefined' && Array.isArray(animeCatalog) ? animeCatalog : [];
        const source = [...loaded, ...raw.map((entry) => ({ ...entry, poster: entry.poster || '' }))];
        const unique = new Map();
        source.forEach((entry) => {
            if (!entry?.id) return;
            const title = String(entry.title || entry.id);
            if (!title.toLocaleLowerCase('ar').includes(normalized) && !String(entry.id).toLocaleLowerCase('ar').includes(normalized)) return;
            unique.set(String(entry.id), { ...entry, title });
        });
        return [...unique.values()].slice(0, 8);
    };

    const renderSearchResults = (input, dropdown) => {
        const query = input.value.trim();
        dropdown.innerHTML = '';
        if (!query) {
            dropdown.hidden = true;
            dropdown.style.display = 'none';
            return;
        }
        const matches = getSearchItems(query);
        dropdown.hidden = false;
        dropdown.style.display = 'block';
        if (!matches.length) {
            dropdown.innerHTML = '<div class="search-empty">لا توجد نتائج مطابقة حالياً</div>';
            return;
        }
        matches.forEach((entry) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'search-item';
            item.innerHTML = `${entry.poster ? `<img src="${htmlEscape(entry.poster)}" alt="" loading="lazy">` : '<span class="search-item-icon"><i class="fa-solid fa-film"></i></span>'}<span>${htmlEscape(entry.title)}</span>`;
            item.addEventListener('click', () => { window.location.href = animePath(entry.id); });
            dropdown.appendChild(item);
        });
    };

    const setupSearch = () => {
        const header = document.querySelector('.main-header');
        if (!header) return;
        let container = header.querySelector('.search-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'search-container';
            container.innerHTML = '<i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i><input type="search" id="search-input" placeholder="ابحث عن أنمي..." autocomplete="off" enterkeyhint="search"><div id="search-results-dropdown" class="search-dropdown" hidden></div>';
            const menu = header.querySelector('.menu-icon');
            header.insertBefore(container, menu || header.querySelector('nav'));
        }
        const input = container.querySelector('#search-input');
        const dropdown = container.querySelector('#search-results-dropdown');
        if (!input || !dropdown || input.dataset.beSearchBound === 'true') return;
        input.dataset.beSearchBound = 'true';
        let timer;
        input.addEventListener('focus', () => { ensureCatalog().catch(() => {}); });
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                renderSearchResults(input, dropdown);
                if (input.value.trim() && !getSearchItems(input.value).length) ensureCatalog().then(() => renderSearchResults(input, dropdown)).catch(() => {});
            }, 80);
        });
        document.addEventListener('click', (event) => {
            if (!container.contains(event.target)) {
                dropdown.hidden = true;
                dropdown.style.display = 'none';
            }
        });
    };

    const setupHeader = () => {
        const header = document.querySelector('.main-header');
        if (!header) return;
        setupSearch();
        if (!document.querySelector('.be-mobile-nav')) {
            const mobileNav = document.createElement('nav');
            mobileNav.className = 'be-mobile-nav';
            const prefix = pageIsInsideHtml ? '' : 'html/';
            mobileNav.innerHTML = `<a href="${prefix}../index.html" class="is-current"><i class="fa-solid fa-house"></i><span>الرئيسية</span></a><a href="${prefix}browse.html"><i class="fa-solid fa-compass"></i><span>تصفح</span></a><a href="${prefix}favorites.html"><i class="fa-solid fa-bookmark"></i><span>قائمتي</span></a><a href="${prefix}dubbers.html"><i class="fa-solid fa-microphone-lines"></i><span>المدبلجون</span></a>`;
            document.body.appendChild(mobileNav);
        }
        if (!header.querySelector('[data-favorites-link]')) {
            const link = document.createElement('a');
            link.href = pageIsInsideHtml ? 'favorites.html' : 'html/favorites.html';
            link.className = 'header-favorites-link';
            link.dataset.favoritesLink = 'true';
            link.innerHTML = '<i class="fa-solid fa-heart" aria-hidden="true"></i><span>المفضلة</span><b data-favorites-count>0</b>';
            const menu = header.querySelector('.menu-icon');
            header.insertBefore(link, menu || header.querySelector('nav'));
        }
        updateFavoriteCount();

        const menuButton = header.querySelector('.menu-icon');
        const nav = header.querySelector('#navMenu');
        if (!menuButton || !nav || menuButton.dataset.beMenuBound === 'true') return;
        if (!nav.querySelector('[data-support-link]')) {
            const prefix = pageIsInsideHtml ? '' : 'html/';
            const anchor = nav.querySelector('a[href*="teams.html"]');
            anchor?.insertAdjacentHTML('afterend', `<a data-support-link="true" href="${prefix}support.html"><i class="fa-solid fa-hand-holding-heart"></i> ادعمنا</a>`);
        }
        menuButton.dataset.beMenuBound = 'true';
        const closeButton = nav.querySelector('.close-btn');
        let backdrop = document.querySelector('.nav-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('button');
            backdrop.type = 'button';
            backdrop.className = 'nav-backdrop';
            backdrop.setAttribute('aria-label', 'إغلاق القائمة');
            document.body.appendChild(backdrop);
        }
        const closeMenu = () => {
            nav.classList.remove('active');
            backdrop.classList.remove('is-visible');
            document.body.classList.remove('menu-open');
            menuButton.setAttribute('aria-expanded', 'false');
        };
        const openMenu = () => {
            nav.classList.add('active');
            backdrop.classList.add('is-visible');
            document.body.classList.add('menu-open');
            menuButton.setAttribute('aria-expanded', 'true');
        };
        menuButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            nav.classList.contains('active') ? closeMenu() : openMenu();
        });
        closeButton?.addEventListener('click', closeMenu);
        backdrop.addEventListener('click', closeMenu);
        nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
    };

    const setupScrollHeader = () => {
        const header = document.querySelector('.main-header');
        if (!header) return;
        const update = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
        update();
        window.addEventListener('scroll', update, { passive: true });
    };

    const setupDetailActions = () => {
        const titleNode = document.getElementById('anime-title');
        const info = document.querySelector('.anime-info');
        const id = new URLSearchParams(window.location.search).get('id');
        if (!titleNode || !info || !id || info.querySelector('.be-detail-actions')) return;
        const actions = document.createElement('div');
        actions.className = 'be-detail-actions';
        actions.innerHTML = `<button type="button" class="be-detail-favorite"><i class="fa-solid fa-heart"></i><span></span></button><div class="be-detail-rating"><span>تقييمك المحلي:</span><div class="be-rating"></div></div>`;
        info.appendChild(actions);
        const favorite = actions.querySelector('.be-detail-favorite');
        const update = () => {
            const active = isFavorite(id);
            favorite.classList.toggle('is-active', active);
            favorite.querySelector('span').textContent = active ? 'محفوظ في المفضلة' : 'أضف إلى المفضلة';
            renderStars(id, actions.querySelector('.be-rating'));
            rememberAnime({ id, title: titleNode.textContent.trim() });
        };
        favorite.addEventListener('click', () => {
            const favorites = getFavorites();
            const index = favorites.indexOf(id);
            if (index >= 0) favorites.splice(index, 1); else favorites.push(id);
            setFavorites(favorites);
            updateFavoriteCount();
            update();
        });
        update();
        const observer = new MutationObserver(update);
        observer.observe(titleNode, { childList: true, characterData: true, subtree: true });
    };

    const renderFavoritesPage = () => {
        const grid = document.getElementById('favorites-grid');
        if (!grid) return;
        const metadata = getMetadata();
        const raw = typeof animeCatalog !== 'undefined' && Array.isArray(animeCatalog) ? animeCatalog : [];
        const favorites = getFavorites();
        const cards = favorites.map((id) => metadata[id] || raw.find((entry) => String(entry.id) === String(id)) || { id, title: id }).filter(Boolean);
        const empty = document.getElementById('favorites-empty');
        grid.innerHTML = '';
        if (!cards.length) {
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;
        cards.forEach((entry) => {
            const card = document.createElement('article');
            card.className = 'anime-card favorite-card';
            card.dataset.animeId = String(entry.id);
            card.dataset.animeTitle = entry.title || entry.id;
            card.dataset.animePoster = entry.poster || '';
            card.dataset.animeType = entry.type || '';
            card.dataset.animeStatus = entry.status || '';
            card.innerHTML = `<div class="anime-card-image"><img src="${htmlEscape(entry.poster || assetPath('icon-512.png'))}" alt="${htmlEscape(entry.title || entry.id)}" loading="lazy"><span class="status-badge">${htmlEscape(entry.status || 'محفوظ')}</span></div><div class="card-info"><h3>${htmlEscape(entry.title || entry.id)}</h3><div class="card-stats"><span>${htmlEscape(entry.type || 'أنمي')}</span><span>${entry.episodes ? `${htmlEscape(entry.episodes)} حلقة` : 'مفضلة'}</span></div></div>`;
            card.addEventListener('click', (event) => { if (!event.target.closest('button')) window.location.href = animePath(entry.id); });
            grid.appendChild(card);
        });
        enhanceAllCards(grid);
    };

    const registerServiceWorker = () => {
        if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
        window.addEventListener('load', () => navigator.serviceWorker.register(`${rootPrefix}sw.js`).catch(() => {}), { once: true });
    };

    const boot = () => {
        setupHeader();
        setupScrollHeader();
        setupDetailActions();
        enhanceAllCards();
        renderFavoritesPage();
        document.querySelectorAll('img:not([loading])').forEach((img) => img.setAttribute('loading', 'lazy'));
        const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) enhanceAllCards(node);
        })));
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('blackecho:favorites', renderFavoritesPage);
        registerServiceWorker();
    };

    const toggleFavorite = (id) => {
        const favorites = getFavorites();
        const index = favorites.indexOf(String(id));
        if (index >= 0) favorites.splice(index, 1); else favorites.push(String(id));
        setFavorites(favorites);
        updateFavoriteCount();
        document.dispatchEvent(new CustomEvent('blackecho:favorites', { detail: { id: String(id), active: index < 0 } }));
        return index < 0;
    };
    window.BlackEcho = { assetPath, animePath, getFavorites, isFavorite, getRating, rememberAnime, enhanceAnimeCard, renderStars, renderFavoritesPage, toggleFavorite };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();


/* Analytics + CMS-override calls removed: this build runs as a fully static
   site with no backend, so these API-dependent blocks were dropped rather
   than left to fail silently on every page load. */
