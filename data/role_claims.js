/**
 * role_claims.js — نافذة "أنا دبلجت هذي الشخصية".
 * تحمّل مكتبة supabase-js فقط عند الضغط على الزر (ما تبطّئ الصفحة).
 * الاستخدام: RoleClaims.open({ animeId, animeTitle, characterName, characterImage })
 */
(function () {
    'use strict';
    var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
    var client = null;

    function loadClient() {
        return new Promise(function (resolve, reject) {
            var cfg = window.SUPABASE_CONFIG || {};
            if (!cfg.url || !cfg.anonKey) return reject(new Error('NO_CONFIG'));
            function make() { client = client || window.supabase.createClient(cfg.url, cfg.anonKey); resolve(client); }
            if (window.supabase) return make();
            var s = document.createElement('script');
            s.src = SDK; s.onload = make; s.onerror = function () { reject(new Error('SDK')); };
            document.head.appendChild(s);
        });
    }

    function el(tag, css, text) {
        var e = document.createElement(tag);
        if (css) e.style.cssText = css;
        if (text != null) e.textContent = text;
        return e;
    }

    function open(info) {
        var overlay = el('div', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,sans-serif;');
        var box = el('div', 'width:100%;max-width:420px;background:#15151b;border:1px solid #2a2a33;border-radius:16px;padding:22px;color:#fff;direction:rtl;');
        box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
        box.appendChild(el('h3', 'margin:0 0 6px;font-size:1.1rem;', 'طلب تأكيد شخصية'));
        box.appendChild(el('p', 'margin:0 0 14px;color:#a0a0ad;font-size:.88rem;line-height:1.7;',
            'الأنمي: ' + info.animeTitle + ' — الشخصية: ' + info.characterName + '. بعد مراجعة الإدارة تنضاف لك.'));
        var lab = el('label', 'display:block;font-size:.82rem;color:#c9c9d3;margin-bottom:6px;font-weight:700;', 'رابط يثبت دبلجتك (اختياري): مقطع، تغريدة، حلقة...');
        var inp = el('input', 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #2a2a33;background:#0f0f14;color:#fff;font:inherit;direction:ltr;');
        inp.type = 'url'; inp.placeholder = 'https://...';
        var msg = el('div', 'min-height:1.2em;margin-top:12px;font-size:.85rem;line-height:1.7;');
        var row = el('div', 'display:flex;gap:8px;margin-top:14px;');
        var send = el('button', 'flex:1;padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#ff2b36,#e50914);color:#fff;font:inherit;font-weight:900;cursor:pointer;', 'إرسال الطلب');
        var cancel = el('button', 'padding:11px 16px;border-radius:10px;border:1px solid #2a2a33;background:#0f0f14;color:#c9c9d3;font:inherit;cursor:pointer;', 'إغلاق');
        send.type = 'button'; cancel.type = 'button';
        row.appendChild(send); row.appendChild(cancel);
        box.appendChild(lab); box.appendChild(inp); box.appendChild(msg); box.appendChild(row);
        overlay.appendChild(box); document.body.appendChild(overlay);
        function close() { overlay.remove(); }
        cancel.onclick = close;
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        function say(t, ok) { msg.textContent = t; msg.style.color = ok ? '#4ade80' : '#ff6b6b'; }

        send.onclick = async function () {
            var proof = inp.value.trim();
            if (proof && !/^https:\/\/[^\s<>"']+$/i.test(proof)) { say('الرابط لازم يبدأ بـ https://'); return; }
            send.disabled = true; say('');
            try {
                var c = await loadClient();
                var sess = (await c.auth.getSession()).data.session;
                if (!sess) {
                    var next = location.pathname.split('/').pop() + location.search;
                    location.href = 'account.html?next=' + encodeURIComponent(next);
                    return;
                }
                var r = await c.from('role_claims').insert({
                    user_id: sess.user.id, anime_id: info.animeId,
                    character_name: info.characterName, proof_url: proof || null,
                    character_image: /^https:\/\//i.test(info.characterImage || '') ? info.characterImage : null
                });
                if (r.error) {
                    var m = r.error.message || '';
                    if (/NOT_DUBBER/.test(m)) m = 'لازم يتقبل طلب انضمامك كمدبلج أول (من صفحة حسابي).';
                    else if (/duplicate|one_pending/i.test(m)) m = 'قدّمت على هذي الشخصية قبل، وطلبك قيد المراجعة.';
                    else m = 'ما قدرنا نرسل الطلب: ' + m;
                    say(m); send.disabled = false; return;
                }
                say('وصل طلبك! بنراجعه ونضيف الشخصية لك.', true);
                send.style.display = 'none'; cancel.textContent = 'تم';
            } catch (e) {
                say(e && e.message === 'NO_CONFIG' ? 'الخدمة غير مفعّلة بعد.' : 'تعذّر الاتصال، جرّب مرة ثانية.');
                send.disabled = false;
            }
        };
    }
    window.RoleClaims = { open: open };
})();
