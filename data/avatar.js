/* Shared initials avatar for AR anime profile surfaces. */
(function (global) {
    'use strict';

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function safeClass(value) {
        return String(value || '').split(/\s+/).filter(function (token) {
            return /^[a-zA-Z0-9_-]+$/.test(token);
        }).join(' ');
    }

    function initial(name) {
        var value = String(name == null ? '' : name).trim();
        if (!value) return '؟';
        if (global.Intl && typeof global.Intl.Segmenter === 'function') {
            try {
                var segment = new global.Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)[Symbol.iterator]().next();
                if (segment && segment.value && segment.value.segment) return segment.value.segment;
            } catch (_) { /* Use the code-point fallback below. */ }
        }
        return Array.from(value)[0] || '؟';
    }

    function normalizeImageUrl(value) {
        var raw = String(value == null ? '' : value).trim();
        if (!raw || /[\s<>"']/.test(raw)) return '';
        var candidate = raw;
        if (/^http:\/\//i.test(candidate)) candidate = 'https://' + candidate.slice(7);
        else if (/^https:\/\//i.test(candidate)) { /* Preserve an existing HTTPS URL as entered. */ }
        else if (/^\/\//.test(candidate)) candidate = 'https:' + candidate;
        else if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return '';
        else candidate = 'https://' + candidate;
        try {
            var parsed = new URL(candidate);
            return parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password ? candidate : '';
        } catch (_) {
            return '';
        }
    }

    function safeImageUrl(value) { return normalizeImageUrl(value); }

    function fallbackElement(name, imageClass, fallbackClass) {
        var span = document.createElement('span');
        span.className = safeClass(fallbackClass) || safeClass(imageClass);
        span.setAttribute('role', 'img');
        span.setAttribute('aria-label', 'الصورة الشخصية: ' + String(name || ''));
        span.textContent = initial(name);
        return span;
    }

    function fallbackForImage(image) {
        if (!image || !image.parentNode || !image.hasAttribute('data-ar-avatar')) return;
        var name = image.getAttribute('data-avatar-name') || '';
        var fallback = fallbackElement(name, image.getAttribute('data-avatar-image-class'), image.getAttribute('data-avatar-fallback-class'));
        image.replaceWith(fallback);
    }

    function create(name, url, imageClass, fallbackClass) {
        var label = String(name == null ? '' : name).trim();
        var src = safeImageUrl(url);
        if (!src) return fallbackElement(label, imageClass, fallbackClass);

        var image = document.createElement('img');
        image.className = safeClass(imageClass);
        image.setAttribute('data-ar-avatar', 'true');
        image.setAttribute('data-avatar-name', label);
        image.setAttribute('data-avatar-image-class', safeClass(imageClass));
        image.setAttribute('data-avatar-fallback-class', safeClass(fallbackClass));
        image.setAttribute('alt', 'صورة ' + label);
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', function () { fallbackForImage(image); }, { once: true });
        image.src = src;
        return image;
    }

    function markup(name, url, imageClass, fallbackClass) {
        var label = String(name == null ? '' : name).trim();
        var src = safeImageUrl(url);
        var imgClass = safeClass(imageClass);
        var fallback = safeClass(fallbackClass);
        if (!src) return fallbackElement(label, imgClass, fallback).outerHTML;
        return '<img class="' + escapeHtml(imgClass) + '" data-ar-avatar="true" data-avatar-name="' + escapeHtml(label) + '" data-avatar-image-class="' + escapeHtml(imgClass) + '" data-avatar-fallback-class="' + escapeHtml(fallback) + '" src="' + escapeHtml(src) + '" alt="' + escapeHtml('صورة ' + label) + '" loading="lazy" decoding="async">';
    }

    // Capture image errors so avatars created later with innerHTML also fall back.
    document.addEventListener('error', function (event) {
        var target = event.target;
        if (target && target.tagName === 'IMG' && target.hasAttribute('data-ar-avatar')) fallbackForImage(target);
    }, true);

    global.ARAnimeAvatar = {
        initial: initial,
        normalizeImageUrl: normalizeImageUrl,
        safeImageUrl: safeImageUrl,
        create: create,
        markup: markup
    };
})(window);
