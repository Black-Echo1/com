(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const openBtn = $('open-apply');
    const card = $('apply-card');
    const cancelBtn = $('cancel-apply');
    const submitBtn = $('submit-apply');
    const teamSelect = $('apply-team');
    const msg = $('apply-msg');
    if (!openBtn || !card) return;

    // تعبئة القائمة المنسدلة من data/team_contacts.js — إضافة فريق جديد هناك
    // تظهر هنا تلقائياً بدون أي تعديل على هذا الملف.
    const teams = Array.isArray(window.TEAM_CONTACTS) ? window.TEAM_CONTACTS : [];
    if (teamSelect) {
        if (!teams.length) {
            teamSelect.innerHTML = '<option value="">لا توجد فرق متاحة حالياً</option>';
            teamSelect.disabled = true;
        } else {
            teamSelect.innerHTML = teams.map((team) => `<option value="${team.id}">${team.name}</option>`).join('');
        }
    }

    openBtn.addEventListener('click', () => {
        card.hidden = !card.hidden;
        if (!card.hidden) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    cancelBtn?.addEventListener('click', () => { card.hidden = true; msg.textContent = ''; });

    function getClient() {
        const config = window.SUPABASE_CONFIG;
        if (!config?.url || !config?.anonKey) return null;
        if (typeof window.supabase === 'undefined') return null; // مكتبة supabase-js غير محمّلة
        return window.supabase.createClient(config.url, config.anonKey);
    }

    submitBtn?.addEventListener('click', async () => {
        const name = $('apply-name').value.trim();
        const contact = $('apply-contact').value.trim();
        const teamId = teamSelect?.value || '';
        const team = teams.find((t) => t.id === teamId) || null;
        const target = $('apply-target').value.trim();
        const details = $('apply-details').value.trim();
        const fileInput = $('apply-file');
        const file = fileInput?.files?.[0] || null;

        if (!name || !contact || !team || !target) {
            msg.textContent = 'الرجاء تعبئة اسمك، وسيلة التواصل، اختيار الفريق، وعنوان الفرصة.';
            return;
        }

        const client = getClient();
        if (!client) {
            msg.textContent = 'خدمة الإرسال غير مفعّلة على الموقع حالياً. تواصل بنا عبر القنوات المتاحة بصفحة الدعم.';
            return;
        }

        submitBtn.disabled = true;
        msg.textContent = 'جارٍ الإرسال...';

        try {
            let fileUrl = null;
            let fileName = null;
            if (file) {
                if (file.size > 15 * 1024 * 1024) {
                    msg.textContent = 'حجم الملف كبير جداً (الحد الأقصى 15 ميجابايت).';
                    submitBtn.disabled = false;
                    return;
                }
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `applications/${Date.now()}_${safeName}`;
                const { error: uploadError } = await client.storage
                    .from('talent-applications')
                    .upload(path, file, { cacheControl: '3600', upsert: false });
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = client.storage.from('talent-applications').getPublicUrl(path);
                fileUrl = publicUrlData?.publicUrl || null;
                fileName = file.name;
            }

            // ينده Edge Function اسمها "send-application-email" — راجع التعليمات
            // المرفقة لإنشائها وربطها بخدمة إرسال إيميل (Resend مثلاً).
            const { error: fnError } = await client.functions.invoke('send-application-email', {
                body: {
                    name, contact, target, details, fileUrl, fileName,
                    teamId: team.id, teamName: team.name, teamEmail: team.email,
                    submittedAt: new Date().toISOString(),
                },
            });
            if (fnError) throw fnError;

            msg.textContent = 'تم إرسال طلبك بنجاح! سيتم التواصل معك قريباً.';
            ['apply-name', 'apply-contact', 'apply-target', 'apply-details'].forEach((id) => { $(id).value = ''; });
            if (fileInput) fileInput.value = '';
        } catch (error) {
            console.error('خطأ في إرسال الطلب:', error);
            msg.textContent = 'حدث خطأ أثناء الإرسال. حاول مرة أخرى أو تواصل معنا مباشرة.';
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
