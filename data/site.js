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

    const readAuthSession = () => {
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
                const saved = safeParse(localStorage.getItem(key), null);
                const session = saved?.currentSession || saved;
                if (session?.access_token && session?.user?.id) return session;
            }
        } catch (_) {}
        return null;
    };

    const loadSupabaseConfig = () => {
        if (window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey) return Promise.resolve(window.SUPABASE_CONFIG);
        if (window.__arAnimeConfigPromise) return window.__arAnimeConfigPromise;
        window.__arAnimeConfigPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = assetPath('data/supabase_config.js');
            script.onload = () => resolve(window.SUPABASE_CONFIG || null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });
        return window.__arAnimeConfigPromise;
    };

    const getNavRole = async (session) => {
        if (!session) return { signedIn: false, isAdmin: false, isStaff: false };
        const cacheKey = `arAnimeNavRole:${session.user.id}`;
        try {
            const cached = safeParse(sessionStorage.getItem(cacheKey), null);
            if (cached && cached.expiresAt > Date.now()) return { signedIn: true, isAdmin: !!cached.isAdmin, isStaff: !!cached.isStaff };
        } catch (_) {}
        try {
            const cfg = await loadSupabaseConfig();
            if (!cfg?.url || !cfg?.anonKey) return { signedIn: true, isAdmin: false, isStaff: false };
            const base = String(cfg.url).replace(/\/+$/, '');
            const headers = { apikey: cfg.anonKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
            const check = async (name) => {
                const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: '{}', cache: 'no-store' });
                if (!response.ok) return false;
                return (await response.json()) === true;
            };
            const [isAdmin, isStaff] = await Promise.all([check('is_admin'), check('is_staff')]);
            const role = { signedIn: true, isAdmin, isStaff: isStaff || isAdmin };
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ isAdmin: role.isAdmin, isStaff: role.isStaff, expiresAt: Date.now() + 30000 })); } catch (_) {}
            return role;
        } catch (_) { return { signedIn: true, isAdmin: false, isStaff: false }; }
    };

    const renderMobileNav = (nav, role) => {
        const prefix = pageIsInsideHtml ? '' : 'html/';
        const route = window.location.pathname.split('/').pop() || 'index.html';
        const items = [
            { id: 'home', href: pageIsInsideHtml ? '../index.html' : './index.html', icon: 'fa-house', label: 'الرئيسية', active: route === '' || route === 'index.html' },
            { id: 'browse', href: `${prefix}browse.html`, icon: 'fa-compass', label: 'الأنميات', active: ['browse.html','anime.html','watch.html','details.html','free.html','ads.html'].includes(route) },
            { id: 'teams', href: `${prefix}teams.html`, icon: 'fa-people-group', label: 'الفرق', active: ['teams.html','team-details.html'].includes(route) },
            { id: 'dubbers', href: `${prefix}dubbers.html`, icon: 'fa-microphone-lines', label: 'المدبلجون', active: ['dubbers.html','actor.html'].includes(route) },
            { id: 'account', href: `${prefix}account.html`, icon: 'fa-user', label: role.signedIn ? 'حسابي' : 'دخول', active: route === 'account.html' }
        ];
        if (role.isStaff) {
            items.splice(3, 1); // استبدال المدبلجين بلوحة الإدارة مع إبقاء مكتبة الأنمي وخمسة أزرار.
            items.push({ id: 'admin', href: `${prefix}admin.html`, icon: role.isAdmin ? 'fa-shield-halved' : 'fa-gauge-high', label: role.isAdmin ? 'الإدارة' : 'لوحتي', active: route === 'admin.html' });
        }
        nav.className = `be-mobile-nav${role.isStaff ? ' has-staff' : ''}`;
        nav.setAttribute('aria-label', 'التنقل الرئيسي');
        nav.replaceChildren();
        items.forEach((item) => {
            const link = document.createElement('a');
            link.href = item.href;
            link.setAttribute('aria-label', item.label);
            if (item.active) { link.classList.add('is-current'); link.setAttribute('aria-current', 'page'); }
            const icon = document.createElement('i'); icon.className = `fa-solid ${item.icon}`; icon.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span'); text.textContent = item.label;
            link.append(icon, text); nav.appendChild(link);
        });
    };

    let mobileNavRefreshId = 0;
    const setupMobileNav = () => {
        document.querySelectorAll('.admin-mobile-nav').forEach((node) => node.remove());
        let nav = document.querySelector('.be-mobile-nav');
        if (!nav) nav = document.createElement('nav');
        if (!nav.isConnected) document.body.appendChild(nav);
        const session = readAuthSession();
        const refreshId = ++mobileNavRefreshId;
        renderMobileNav(nav, { signedIn: !!session, isAdmin: false, isStaff: false });
        if (session) getNavRole(session).then((role) => { if (refreshId === mobileNavRefreshId) renderMobileNav(nav, role); });
    };

    const setupHeader = () => {
        const header = document.querySelector('.main-header');
        if (!header) return;
        setupSearch();
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
            // آخر عنصر في القائمة
            nav.insertAdjacentHTML('beforeend', `<a data-support-link="true" href="${prefix}support.html"><i class="fa-solid fa-hand-holding-heart"></i> ادعمنا</a>`);
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

    const setupAppInstall = () => {
        if (document.querySelector('.be-app-install')) return;
        const style = document.createElement('style');
        style.id = 'be-app-install-style';
        style.textContent = `
            .be-app-install{position:fixed!important;right:20px!important;bottom:20px!important;z-index:1305!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;min-width:158px!important;min-height:48px!important;padding:11px 17px!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:15px!important;background:linear-gradient(135deg,#fb4756,#c81425)!important;color:#fff!important;box-shadow:0 14px 34px -18px rgba(229,9,20,.85),inset 0 1px 0 rgba(255,255,255,.2)!important;font-family:inherit!important;font-size:.86rem!important;font-weight:900!important;line-height:1.2!important;cursor:pointer!important;transition:transform .18s ease,filter .18s ease!important}
            .be-app-install:hover{transform:translateY(-2px)!important;filter:brightness(1.08)!important}
            .be-app-install:focus-visible,.be-install-close:focus-visible{outline:3px solid rgba(255,255,255,.8);outline-offset:3px}
            .be-app-install[hidden],.be-install-guide[hidden]{display:none!important}
            .be-app-install i{font-size:1rem}
            .be-install-guide{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;padding:20px;background:rgba(3,5,9,.76);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
            .be-install-card{position:relative;width:min(100%,430px);padding:27px 24px 23px;border:1px solid rgba(255,255,255,.12);border-radius:23px;background:linear-gradient(145deg,#191c27,#0e1118);box-shadow:0 28px 80px -30px #000;color:#f5f6fa;direction:rtl;text-align:right}
            .be-install-close{position:absolute;top:12px;left:12px;width:38px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.06);color:#fff;font-size:1.25rem;cursor:pointer}
            .be-install-kicker{display:inline-flex;align-items:center;gap:8px;margin:0 0 8px;color:#ff7c85;font-size:.73rem;font-weight:900}
            .be-install-card h2{margin:0 0 8px;color:#fff;font-size:1.25rem;font-weight:900}
            .be-install-intro{margin:0 0 14px;color:#aeb4c2;font-size:.85rem;line-height:1.8}
            .be-install-steps{display:grid;gap:9px;margin:0;padding:0;list-style:none;counter-reset:install-step}
            .be-install-steps li{position:relative;min-height:43px;padding:10px 45px 10px 12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.035);color:#e4e7ee;font-size:.8rem;line-height:1.65;counter-increment:install-step}
            .be-install-steps li:before{content:counter(install-step);position:absolute;right:10px;top:9px;width:25px;height:25px;display:grid;place-items:center;border-radius:9px;background:rgba(229,9,20,.16);color:#ff7e87;font-weight:900}
            .be-install-footnote{margin:13px 0 0;color:#8f97a8;font-size:.72rem;line-height:1.65}
            @media(max-width:768px){.be-app-install{right:12px!important;bottom:calc(76px + env(safe-area-inset-bottom,0px))!important;min-width:148px!important;min-height:46px!important;padding:10px 14px!important;border-radius:14px!important;font-size:.8rem!important}.be-install-card{padding:25px 19px 20px;border-radius:20px}}
            @media(prefers-reduced-motion:reduce){.be-app-install{transition:none!important}}
        `;
        document.head.appendChild(style);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'be-app-install';
        button.setAttribute('aria-label', 'تثبيت تطبيق AR anime');
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i><span>تثبيت التطبيق</span>';
        const guide = document.createElement('div');
        guide.className = 'be-install-guide';
        guide.hidden = true;
        guide.setAttribute('role', 'dialog');
        guide.setAttribute('aria-modal', 'true');
        guide.setAttribute('aria-labelledby', 'be-install-title');
        guide.innerHTML = '<section class="be-install-card"><button type="button" class="be-install-close" aria-label="إغلاق">×</button><p class="be-install-kicker"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> AR ANIME · APP</p><h2 id="be-install-title">ثبّت AR anime على جهازك</h2><p class="be-install-intro">أضف الموقع إلى شاشتك الرئيسية لتفتحه كتطبيق وتصل إليه بسرعة.</p><ol class="be-install-steps"></ol><p class="be-install-footnote">إذا لم يظهر خيار التثبيت، افتح الموقع في المتصفح الأساسي وحدّث الصفحة مرة واحدة.</p></section>';
        document.body.append(button, guide);

        let deferredPrompt = null;
        const isInstalled = () => {
            try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
            catch (_) { return window.navigator.standalone === true; }
        };
        button.hidden = isInstalled();

        const closeGuide = () => {
            guide.hidden = true;
            button.setAttribute('aria-expanded', 'false');
            button.focus();
        };
        const showGuide = () => {
            const ua = window.navigator.userAgent || '';
            const isIOS = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
            const isAndroid = /Android/i.test(ua);
            const steps = isIOS
                ? ['افتح الموقع في Safari.', 'اضغط زر المشاركة أسفل الشاشة أو أعلاها.', 'اختر «إضافة إلى الشاشة الرئيسية»، ثم اضغط «إضافة».']
                : isAndroid
                    ? ['افتح قائمة المتصفح (⋮).', 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».', 'وافق على التثبيت؛ سيظهر AR anime بين تطبيقاتك.']
                    : ['افتح قائمة المتصفح.', 'اختر «تثبيت AR anime» أو «تثبيت الموقع كتطبيق».', 'ثبّت الاختصار لفتح الموقع كتطبيق مستقل.'];
            const list = guide.querySelector('.be-install-steps');
            list.replaceChildren(...steps.map((text) => { const item = document.createElement('li'); item.textContent = text; return item; }));
            guide.hidden = false;
            button.setAttribute('aria-expanded', 'true');
            guide.querySelector('.be-install-close').focus();
        };

        button.addEventListener('click', async () => {
            if (!deferredPrompt) { showGuide(); return; }
            const promptEvent = deferredPrompt;
            deferredPrompt = null;
            button.disabled = true;
            try {
                await promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                if (choice?.outcome === 'accepted') button.hidden = true;
            } catch (_) { showGuide(); }
            finally { button.disabled = false; }
        });
        const closeButton = guide.querySelector('.be-install-close');
        closeButton.addEventListener('click', closeGuide);
        guide.addEventListener('click', (event) => { if (event.target === guide) closeGuide(); });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !guide.hidden) closeGuide(); });
        window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredPrompt = event; });
        window.addEventListener('appinstalled', () => { button.hidden = true; guide.hidden = true; });
    };

    const registerServiceWorker = () => {
        if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
        window.addEventListener('load', () => navigator.serviceWorker.register(`${rootPrefix}sw.js`).catch(() => {}), { once: true });
    };

    const lockMobileZoom = () => {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
            document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
        });
        document.addEventListener('touchmove', (event) => {
            if (event.touches && event.touches.length > 1) event.preventDefault();
        }, { passive: false });
    };

    const boot = () => {
        lockMobileZoom();
        setupHeader();
        setupMobileNav();
        setupAppInstall();
        window.addEventListener('ar-anime:auth-changed', setupMobileNav);
        window.addEventListener('focus', setupMobileNav);
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
