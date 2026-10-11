/**
 * people_loader.js — يجهّز dubbersDatabase و teamsDatabase من Supabase (بطلب واحد).
 * مهم: يحمَّل بشكل متزامن عمداً، عشان صفحات المدبلجين والفرق والمؤدين (اللي تقرأ هذي المتغيرات
 * مباشرة) تشتغل بدون أي تعديل. البيانات صغيرة، فالتأخير بسيط.
 * لو Supabase ما اشتغل: الفرق الأساسية تظهر بدون أعضاء، وقائمة المدبلجين فاضية.
 * أمان: كل النصوص تتحوّل لرموز HTML آمنة، وأي رابط صورة لازم يبدأ بـ https://
 */
var dubbersDatabase = {};
var teamsDatabase = {};
(function () {
    var cfg = window.SUPABASE_CONFIG || {};
    var FALLBACK_TEAMS = [{"id": "team_alpha", "name": "فريق BLACK ECHO", "logo": "https://files.catbox.moe/qgtary.jpeg", "banner": "https://files.catbox.moe/qgtary.jpeg", "description": "Black Echo فريق عربي يسعى إلى إعادة تقديم الأنمي بدبلجة عربية احترافية، مع الاهتمام بالجودة، وتطوير المواهب، وصناعة أعمال تليق بالجمهور العربي."}, {"id": "team_shadow", "name": "دوبلاج (اكاتسكي)", "logo": "https://files.catbox.moe/bijb9i", "banner": "https://i.ibb.co/nMB9Ddkh/image.png", "description": "فريق الأكنسكي هو فريق متخصص في الدوبلاج، يهدف إلى تقديم أعمال صوتية احترافية وخاصة في مجال الأنمي، مع أداء مميز يعكس مشاعر الشخصيات ويقدم تجربة ممتعة للجمهور العربي."}, {"id": "noor_shadow", "name": "دوبلاج (نور شادو)", "logo": "https://i.ibb.co/99dTkJ6X/image.jpg", "banner": "https://i.ibb.co/99dTkJ6X/image.jpg", "description": "فريق نور شادو هو فريق متخصص في الدوبلاج، يهدف إلى تقديم أعمال صوتية احترافية وخاصة في مجال الأنمي، مع أداء مميز يعكس مشاعر الشخصيات ويقدم تجربة ممتعة للجمهور العربي."}];

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function safeUrl(v) {
        if (window.ARAnimeAvatar) return window.ARAnimeAvatar.normalizeImageUrl(v);
        var raw = String(v == null ? '' : v).trim();
        if (!raw || /[\s<>"']/.test(raw)) return '';
        if (/^http:\/\//i.test(raw)) raw = 'https://' + raw.slice(7);
        else if (/^https:\/\//i.test(raw)) { /* Keep the stored HTTPS URL. */ }
        else if (/^\/\//.test(raw)) raw = 'https:' + raw;
        else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
        else raw = 'https://' + raw;
        try {
            var parsed = new URL(raw);
            return parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password ? raw : '';
        } catch (_) { return ''; }
    }

    function build(teams, dubbers, members) {
        var byId = {};
        (dubbers || []).forEach(function (d) {
            byId[d.id] = d;
            dubbersDatabase[d.id] = {
                name: esc(d.name), role: esc(d.role || 'مؤدي أصوات'), logo: safeUrl(d.logo), banner: safeUrl(d.banner),
                bio: esc(d.bio || ''), social_url: safeUrl(d.social_url), roles: []
            };
        });
        (teams || []).forEach(function (t) {
            teamsDatabase[t.id] = {
                id: t.id, name: esc(t.name), logo: safeUrl(t.logo), banner: safeUrl(t.banner || t.logo),
                description: esc(t.description || ''), members: [], producedAnime: []
            };
        });
        (members || []).forEach(function (m) {
            var team = teamsDatabase[m.team_id], d = byId[m.dubber_id];
            if (!team || !d) return;
            team.members.push({ id: d.id, name: esc(d.name), role: esc(m.role || d.role || 'مؤدي أصوات'), displayLevel: esc(m.display_level || ''), avatar: safeUrl(d.logo) });
        });
    }

    var ok = false;
    if (cfg.url && cfg.anonKey) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/get_people', false);
            xhr.setRequestHeader('apikey', cfg.anonKey);
            xhr.setRequestHeader('Authorization', 'Bearer ' + cfg.anonKey);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send('{}');
            if (xhr.status >= 200 && xhr.status < 300) {
                var data = JSON.parse(xhr.responseText);
                build(data.teams, data.dubbers, data.members);
                ok = true;
            }
        } catch (e) { console.warn('people_loader:', e); }
    }
    if (!ok) build(FALLBACK_TEAMS, [], []);
    window.PEOPLE_FROM_DB = ok;
})();
