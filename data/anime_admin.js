/* AR anime — admin-only anime and episode manager. Database writes are still guarded by Supabase RLS. */
(function () {
    'use strict';

    function mount(options) {
        var client = options.client;
        var toast = options.toast;
        var friendly = options.friendly || function (message) { return message; };
        var reload = options.reload || function () {};
        var animeList = [];
        var episodes = [];
        var selectedAnimeId = '';
        var editingEpisodeId = null;
        var episodesReady = false;
        var $ = function (id) { return document.getElementById(id); };

        var animeSelect = $('content-anime-select');
        var selectedCard = $('content-selected-card');
        var episodeList = $('content-episodes');
        var episodeFields = $('episode-fields');
        var episodeSave = $('episode-save-button');
        var newAnimeTitle = $('new-anime-title');
        var newAnimePoster = $('new-anime-poster');
        var newAnimeBanner = $('new-anime-banner');
        var newAnimeStory = $('new-anime-story');
        var episodeTitle = $('episode-title-input');
        var episodeUrl = $('episode-url-input');
        var episodeDownload = $('episode-download-input');
        var episodeDescription = $('episode-description-input');
        var episodeDuration = $('episode-duration-input');
        var episodeDate = $('episode-date-input');

        if (!animeSelect || !selectedCard || !episodeList || !episodeFields || !episodeSave) return null;

        function node(tag, className, text) {
            var el = document.createElement(tag);
            if (className) el.className = className;
            if (text != null) el.textContent = text;
            return el;
        }
        function selectedAnime() {
            return animeList.find(function (anime) { return anime.id === selectedAnimeId; }) || null;
        }
        function normalizeImage(value) {
            return window.ARAnimeAvatar && window.ARAnimeAvatar.normalizeImageUrl(value || '');
        }
        function safeHttps(value, label, required) {
            var text = String(value || '').trim();
            if (!text) {
                if (required) toast('أدخل ' + label + ' أولاً.', true);
                return required ? null : '';
            }
            try {
                var parsed = new URL(text);
                if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error('invalid');
                return parsed.href;
            } catch (_) {
                toast(label + ' لازم يكون رابط HTTPS صالحاً.', true);
                return null;
            }
        }
        function errorMessage(error) {
            var message = String(error && error.message || error || 'تعذّر الاتصال بقاعدة البيانات.');
            if (/description.*does not exist|column[^\n]*description|could not find[^\n]*description/i.test(message)) {
                return 'قاعدة البيانات تحتاج تحديثاً مرة واحدة. شغّل supabase/content_admin_system.sql في Supabase ثم أعد المحاولة.';
            }
            if (/row-level security|permission denied|not allowed/i.test(message)) {
                return 'صلاحية كتابة المحتوى غير مفعّلة. شغّل supabase/content_admin_system.sql؛ التعديل مخصص للأدمن العام.';
            }
            return friendly(message);
        }
        function showMessage(text, isError) {
            episodeList.replaceChildren(node('div', 'empty' + (isError ? ' err' : ''), text));
        }
        function setFormEnabled(enabled) {
            episodeFields.disabled = !enabled;
            episodeSave.disabled = !enabled;
        }
        function nextNumber() {
            var max = episodes.reduce(function (value, episode) {
                return Math.max(value, Number(episode.number) || 0);
            }, 0);
            return max + 1;
        }
        function resetEpisodeForm() {
            editingEpisodeId = null;
            var number = nextNumber();
            $('episode-number').value = String(number);
            episodeTitle.value = 'الحلقة ' + number;
            episodeUrl.value = '';
            episodeDownload.value = '';
            episodeDescription.value = '';
            episodeDuration.value = '';
            episodeDate.value = '';
            $('episode-form-title').textContent = 'إضافة حلقة';
            episodeSave.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> إضافة الحلقة';
            $('episode-cancel-edit').hidden = true;
        }
        function updateSelectedCard() {
            var anime = selectedAnime();
            if (!anime) {
                selectedCard.hidden = true;
                $('episode-poster-note').hidden = true;
                $('episode-no-poster').hidden = true;
                $('episode-poster-preview').removeAttribute('src');
                setFormEnabled(false);
                return;
            }
            selectedCard.hidden = false;
            $('content-selected-title').textContent = anime.title || anime.id;
            $('content-selected-id').textContent = anime.id;
            var visible = anime.in_catalog !== false;
            $('content-selected-status').textContent = visible ? 'ظاهر في مكتبة الأنمي' : 'مخفي من المكتبة';
            $('content-selected-status').className = 'content-catalog-state ' + (visible ? 'is-visible' : 'is-hidden');
            var visibility = $('content-visibility-toggle');
            visibility.className = visible ? '' : 'ok';
            visibility.innerHTML = visible
                ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i> إخفاء من المكتبة'
                : '<i class="fa-solid fa-eye" aria-hidden="true"></i> إظهار في المكتبة';
            var poster = normalizeImage(anime.poster);
            var selectedPoster = $('content-selected-poster');
            selectedPoster.hidden = !poster;
            if (poster) selectedPoster.src = poster; else selectedPoster.removeAttribute('src');
            var preview = $('episode-poster-preview');
            preview.hidden = !poster;
            if (poster) preview.src = poster; else preview.removeAttribute('src');
            $('episode-poster-note').hidden = !poster;
            $('episode-no-poster').hidden = !!poster;
            setFormEnabled(episodesReady && !!poster);
        }
        function safeAnchor(url, label) {
            if (!url) return null;
            try {
                var parsed = new URL(url);
                if (parsed.protocol !== 'https:') return null;
                var a = node('a', 'content-episode-link', label);
                a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
                return a;
            } catch (_) { return null; }
        }
        function getPrimaryServer(episode) {
            var servers = Array.isArray(episode.servers) ? episode.servers : [];
            return servers.find(function (server) { return server && server.url; }) || {};
        }
        function beginEdit(episode) {
            editingEpisodeId = episode.id;
            $('episode-number').value = String(episode.number);
            episodeTitle.value = episode.title || ('الحلقة ' + episode.number);
            var server = getPrimaryServer(episode);
            episodeUrl.value = server.url || '';
            episodeDownload.value = server.ouo_url || '';
            episodeDescription.value = episode.description || '';
            episodeDuration.value = episode.duration || '';
            episodeDate.value = /^\d{4}-\d{2}-\d{2}$/.test(episode.release_date || '') ? episode.release_date : '';
            $('episode-form-title').textContent = 'تعديل الحلقة ' + episode.number;
            episodeSave.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> حفظ التعديلات';
            $('episode-cancel-edit').hidden = false;
            $('episode-form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        function renderEpisodes() {
            episodeList.replaceChildren();
            $('content-episode-count').textContent = String(episodes.length);
            if (!episodes.length) {
                showMessage('لا توجد حلقات لهذا الأنمي بعد. أضف الأولى من النموذج.', false);
                return;
            }
            episodes.forEach(function (episode) {
                var row = node('article', 'content-episode-row');
                var poster = normalizeImage(episode.thumbnail) || normalizeImage((selectedAnime() || {}).poster);
                if (poster) {
                    var image = node('img', 'content-episode-thumbnail');
                    image.src = poster; image.alt = ''; image.loading = 'lazy'; row.appendChild(image);
                } else {
                    row.appendChild(node('div', 'content-episode-thumbnail content-episode-placeholder', '▶'));
                }
                var info = node('div', 'content-episode-info');
                info.appendChild(node('span', 'content-episode-number', 'الحلقة ' + episode.number));
                info.appendChild(node('strong', 'content-episode-title', episode.title || ('الحلقة ' + episode.number)));
                if (episode.description) info.appendChild(node('p', 'content-episode-description', episode.description));
                var server = getPrimaryServer(episode);
                var anchor = safeAnchor(server.url, 'فتح رابط المشاهدة');
                if (anchor) info.appendChild(anchor);
                var actions = node('div', 'content-episode-actions');
                var edit = node('button', '', 'تعديل'); edit.type = 'button';
                edit.addEventListener('click', function () { beginEdit(episode); });
                var remove = node('button', 'no', 'حذف'); remove.type = 'button';
                remove.addEventListener('click', function () { deleteEpisode(episode); });
                actions.append(edit, remove);
                row.append(info, actions);
                episodeList.appendChild(row);
            });
        }
        async function loadEpisodes() {
            var anime = selectedAnime();
            episodesReady = false;
            setFormEnabled(false);
            if (!anime) {
                episodes = [];
                $('content-episode-count').textContent = '0';
                showMessage('اختر أنمياً لعرض حلقاته.', false);
                return;
            }
            showMessage('جاري تحميل الحلقات...', false);
            var result = await client.from('episodes')
                .select('id,anime_id,number,title,description,thumbnail,duration,release_date,dubbing_team,servers')
                .eq('anime_id', anime.id).order('number', { ascending: true });
            if (result.error) {
                episodes = [];
                $('content-episode-count').textContent = '—';
                showMessage(errorMessage(result.error), true);
                updateSelectedCard();
                return;
            }
            episodes = result.data || [];
            episodesReady = true;
            renderEpisodes();
            resetEpisodeForm();
            updateSelectedCard();
        }
        async function setSelectedAnime(id) {
            selectedAnimeId = id || '';
            episodes = [];
            episodesReady = false;
            resetEpisodeForm();
            updateSelectedCard();
            await loadEpisodes();
        }
        async function refresh(list) {
            animeList = Array.isArray(list) ? list.slice() : [];
            $('content-anime-count').textContent = String(animeList.length);
            var previous = selectedAnimeId;
            animeSelect.replaceChildren();
            animeSelect.appendChild(new Option('اختر أنمياً...', ''));
            animeList.forEach(function (anime) {
                var label = (anime.title || anime.id) + (anime.in_catalog === false ? ' — مخفي' : '');
                animeSelect.appendChild(new Option(label, anime.id));
            });
            if (previous && animeList.some(function (anime) { return anime.id === previous; })) {
                selectedAnimeId = previous;
                animeSelect.value = previous;
                updateSelectedCard();
                await loadEpisodes();
            } else {
                selectedAnimeId = '';
                animeSelect.value = '';
                episodes = [];
                episodesReady = false;
                resetEpisodeForm();
                updateSelectedCard();
                await loadEpisodes();
            }
        }
        async function deleteEpisode(episode) {
            if (!window.confirm('حذف الحلقة ' + episode.number + ' نهائياً؟')) return;
            var result = await client.from('episodes').delete().eq('id', episode.id).eq('anime_id', selectedAnimeId);
            if (result.error) { toast(errorMessage(result.error), true); return; }
            toast('تم حذف الحلقة.');
            await reload();
        }
        async function saveEpisode() {
            var anime = selectedAnime();
            if (!anime) { toast('اختر أنمياً أولاً.', true); return; }
            var poster = normalizeImage(anime.poster);
            if (!poster) { toast('أضف صورة بوستر للأنمي أولاً؛ هي صورة الحلقة المصغّرة.', true); return; }
            var watchUrl = safeHttps(episodeUrl.value, 'رابط المشاهدة', true);
            if (!watchUrl) return;
            var downloadUrl = safeHttps(episodeDownload.value, 'رابط التحميل', false);
            if (downloadUrl === null) return;
            var title = episodeTitle.value.trim();
            var description = episodeDescription.value.trim();
            if (!title) title = 'الحلقة ' + (editingEpisodeId ? $('episode-number').value : nextNumber());
            if (title.length > 120) { toast('عنوان الحلقة يجب ألا يتجاوز 120 حرفاً.', true); return; }
            if (description.length > 1200) { toast('وصف الحلقة يجب ألا يتجاوز 1200 حرف.', true); return; }
            var existing = editingEpisodeId ? episodes.find(function (item) { return String(item.id) === String(editingEpisodeId); }) : null;
            var oldServers = existing && Array.isArray(existing.servers) ? existing.servers : [];
            var firstServer = { name: (oldServers[0] && oldServers[0].name) || 'السيرفر الرئيسي', url: watchUrl, ouo_url: downloadUrl || null };
            var payload = {
                anime_id: anime.id,
                number: editingEpisodeId ? Number(existing.number) : nextNumber(),
                title: title,
                description: description || null,
                thumbnail: poster,
                duration: episodeDuration.value.trim() || null,
                release_date: episodeDate.value || null,
                dubbing_team: null,
                servers: [firstServer].concat(oldServers.slice(1))
            };
            episodeSave.disabled = true;
            var result;
            if (editingEpisodeId) {
                result = await client.from('episodes').update(payload).eq('id', editingEpisodeId).eq('anime_id', anime.id).select('id').maybeSingle();
            } else {
                result = await client.from('episodes').insert(payload).select('id').single();
            }
            episodeSave.disabled = false;
            if (result.error) { toast(errorMessage(result.error), true); return; }
            if (editingEpisodeId && !result.data) { toast('لم يتم العثور على الحلقة للتعديل.', true); return; }
            toast(editingEpisodeId ? 'تم تحديث الحلقة.' : 'تمت إضافة الحلقة رقم ' + payload.number + '.');
            editingEpisodeId = null;
            await reload();
        }
        async function toggleCatalog() {
            var anime = selectedAnime(); if (!anime) return;
            var visible = anime.in_catalog !== false;
            var result = await client.from('anime').update({ in_catalog: !visible }).eq('id', anime.id).select('id').maybeSingle();
            if (result.error) { toast(errorMessage(result.error), true); return; }
            if (!result.data) { toast('تعذّر تحديث حالة ظهور الأنمي.', true); return; }
            toast(visible ? 'تم إخفاء الأنمي من المكتبة؛ بياناته وحلقاته محفوظة.' : 'تم إظهار الأنمي في المكتبة.');
            await reload();
        }
        async function deleteAnime() {
            var anime = selectedAnime(); if (!anime) return;
            var warning = 'حذف «' + (anime.title || anime.id) + '» نهائياً؟ سيتم حذف حلقاته وروابطها وأي ارتباطات مرتبطة به. لا يمكن التراجع عن ذلك.';
            if (!window.confirm(warning)) return;
            var result = await client.from('anime').delete().eq('id', anime.id).select('id').maybeSingle();
            if (result.error) { toast(errorMessage(result.error), true); return; }
            if (!result.data) { toast('لم يتم العثور على الأنمي للحذف.', true); return; }
            selectedAnimeId = '';
            toast('تم حذف الأنمي وحلقاته نهائياً.');
            await reload();
        }
        function slug(title) {
            var value = String(title || '').normalize('NFKC').toLocaleLowerCase('ar')
                .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/g, '');
            return value || ('anime-' + Date.now());
        }
        function updateIdPreview() {
            var base = slug(newAnimeTitle.value);
            var candidate = base; var suffix = 2;
            while (animeList.some(function (anime) { return anime.id === candidate; })) candidate = base + '-' + suffix++;
            $('new-anime-id-preview').textContent = newAnimeTitle.value.trim() ? candidate : '—';
        }
        async function addAnime() {
            var title = newAnimeTitle.value.trim();
            if (title.length < 2) { toast('اكتب اسم الأنمي (حرفان على الأقل).', true); return; }
            if (title.length > 120) { toast('اسم الأنمي يجب ألا يتجاوز 120 حرفاً.', true); return; }
            var poster = normalizeImage(newAnimePoster.value.trim());
            if (!poster) { toast('أدخل رابط بوستر صالحاً؛ يمكن كتابة النطاق دون https وسيُضاف تلقائياً.', true); return; }
            var banner = newAnimeBanner.value.trim() ? normalizeImage(newAnimeBanner.value.trim()) : null;
            if (newAnimeBanner.value.trim() && !banner) { toast('رابط الغلاف ليس صورة صالحة.', true); return; }
            var base = slug(title); var id = base; var suffix = 2;
            while (animeList.some(function (anime) { return anime.id === id; })) id = base + '-' + suffix++;
            var sortOrder = animeList.reduce(function (max, anime) { return Math.max(max, Number(anime.sort_order) || 0); }, 0) + 1;
            var result = await client.from('anime').insert({
                id: id, title: title, poster: poster, cover_banner: banner,
                story: newAnimeStory.value.trim() || null, sort_order: sortOrder,
                is_hero: false, in_catalog: true, dubbed_characters: {}
            }).select('id').single();
            if (result.error) { toast(errorMessage(result.error), true); return; }
            selectedAnimeId = id;
            newAnimeTitle.value = ''; newAnimePoster.value = ''; newAnimeBanner.value = ''; newAnimeStory.value = '';
            updateIdPreview();
            toast('تمت إضافة الأنمي إلى المكتبة.');
            await reload();
        }

        animeSelect.addEventListener('change', function () { setSelectedAnime(animeSelect.value); });
        $('content-visibility-toggle').addEventListener('click', toggleCatalog);
        $('content-delete-anime').addEventListener('click', deleteAnime);
        episodeSave.addEventListener('click', saveEpisode);
        $('episode-cancel-edit').addEventListener('click', function () { resetEpisodeForm(); });
        $('new-anime-save').addEventListener('click', addAnime);
        newAnimeTitle.addEventListener('input', updateIdPreview);

        return { refresh: refresh };
    }

    window.ARAnimeContentAdmin = { mount: mount };
})();
