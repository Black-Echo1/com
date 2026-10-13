/* تعليقات الأنمي: القراءة للجميع، والكتابة للمسجلين، والحذف للمالك أو مشرف الموقع. */
(function () {
    'use strict';
    var cfg = window.SUPABASE_CONFIG || {};
    var client = null;
    var animeId = '';
    var list = null;
    var form = null;
    var textarea = null;
    var message = null;
    var count = null;
    var currentUser = null;
    var isStaff = false;
    var BLOCKED_WORDS = ['اغتصاب','بز','بزاز','بظر','بيضان','تمص','ثدي','جماع','حلمة','خنثي','خول','زب','سحاق','سحاقية','سكس','شاذ','شرج','شرموطة','شهوة','طيز','عاهرة','عرص','فرج','قحبة','قضيب','كس','لبوة','لحس','لعق','لواط','لوطي','مبادل','متناك','متناكة','مص','مفلقسة','نيك','خرا','زق'];
    function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]; }); }
    function normalize(value) { return String(value || '').toLowerCase().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه'); }
    function containsBlockedWord(value) { var text = normalize(value); return BLOCKED_WORDS.find(function (word) { return text.indexOf(normalize(word)) !== -1; }) || ''; }
    function relativeDate(value) { try { return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch (_) { return ''; } }
    function displayName(user) { var meta = user && user.user_metadata || {}; return meta.full_name || meta.name || meta.user_name || (user && user.email ? user.email.split('@')[0] : 'عضو'); }
    function setMessage(text, ok) { if (!message) return; message.textContent = text || ''; message.className = 'anime-comments-message' + (ok ? ' is-ok' : ''); }
    function render(rows, user) {
        if (!list) return;
        count.textContent = String(rows.length);
        if (!rows.length) { list.innerHTML = '<p class="anime-comments-empty">كن أول من يشارك رأيه في هذا الأنمي.</p>'; return; }
        list.innerHTML = rows.map(function (row) {
            var mine = user && row.user_id === user.id;
            var canDelete = mine || isStaff;
            return '<article class="anime-comment" data-comment-id="' + esc(row.id) + '"><div class="anime-comment-avatar"><i class="fa-solid fa-user" aria-hidden="true"></i></div><div class="anime-comment-body"><div class="anime-comment-head"><strong>' + esc(row.author_name || 'عضو') + '</strong><time>' + esc(relativeDate(row.created_at)) + '</time></div><p>' + esc(row.content).replace(/\n/g, '<br>') + '</p>' + (canDelete ? '<button type="button" class="anime-comment-delete" data-delete-comment="' + esc(row.id) + '"><i class="fa-solid fa-trash-can" aria-hidden="true"></i> حذف التعليق</button>' : '') + '</div></article>';
        }).join('');
        list.querySelectorAll('[data-delete-comment]').forEach(function (button) { button.addEventListener('click', function () { removeComment(button.dataset.deleteComment); }); });
    }
    async function load(user) {
        var result = await client.from('anime_comments').select('id,user_id,author_name,content,created_at').eq('anime_id', animeId).order('created_at', { ascending: false }).limit(100);
        if (result.error) { setMessage('التعليقات غير متاحة حالياً. تأكد من تشغيل ترحيل التعليقات في Supabase.'); return; }
        render(result.data || [], user);
    }
    async function removeComment(id) {
        if (!window.confirm(isStaff ? 'هل تريد حذف هذا التعليق من الموقع؟' : 'هل تريد حذف تعليقك؟')) return;
        var result = await client.from('anime_comments').delete().eq('id', id);
        if (result.error) { setMessage('ليس لديك صلاحية حذف هذا التعليق أو حدث خطأ.'); return; }
        setMessage('تم حذف التعليق.', true);
        load(currentUser);
    }
    async function submit(event) {
        event.preventDefault();
        var content = textarea.value.trim();
        if (content.length < 2 || content.length > 1000) { setMessage('اكتب رأياً من حرفين إلى ١٠٠٠ حرف.'); return; }
        var blocked = containsBlockedWord(content);
        if (blocked) { setMessage('لا يمكن نشر التعليق لأنه يحتوي على كلمة غير مسموحة.'); return; }
        var session = (await client.auth.getSession()).data.session;
        if (!session) { setMessage('سجّل الدخول حتى تتمكن من كتابة تعليق.'); return; }
        form.querySelector('button[type="submit"]').disabled = true;
        var result = await client.from('anime_comments').insert({ anime_id: animeId, user_id: session.user.id, author_name: displayName(session.user), content: content });
        form.querySelector('button[type="submit"]').disabled = false;
        if (result.error) { setMessage(/COMMENT_BLOCKED_WORD/i.test(result.error.message || '') ? 'لا يمكن نشر التعليق لأنه يحتوي على كلمة غير مسموحة.' : 'تعذر نشر التعليق. حاول مرة أخرى.'); return; }
        textarea.value = ''; setMessage('تم نشر رأيك.', true); load(session.user);
    }
    async function init() {
        var section = document.getElementById('anime-comments');
        if (!section || !cfg.url || !cfg.anonKey || !window.supabase) return;
        animeId = new URLSearchParams(window.location.search).get('id') || ''; if (!animeId) return;
        client = window.supabase.createClient(cfg.url, cfg.anonKey);
        list = document.getElementById('anime-comments-list'); form = document.getElementById('anime-comment-form'); textarea = document.getElementById('anime-comment-text'); message = document.getElementById('anime-comments-message'); count = document.getElementById('anime-comments-count');
        form.addEventListener('submit', submit);
        var session = (await client.auth.getSession()).data.session; currentUser = session && session.user;
        if (currentUser) { var staff = await client.rpc('is_staff'); isStaff = !staff.error && staff.data === true; } else setMessage('القراءة متاحة للجميع، وسجّل الدخول لكتابة رأيك.');
        await load(currentUser);
        client.auth.onAuthStateChange(function (_, nextSession) { currentUser = nextSession && nextSession.user; isStaff = false; if (currentUser) client.rpc('is_staff').then(function (staff) { isStaff = !staff.error && staff.data === true; load(currentUser); }); else { setMessage('سجّل الدخول حتى تتمكن من كتابة تعليق.'); load(null); } });
    }
    document.addEventListener('DOMContentLoaded', init);
})();
