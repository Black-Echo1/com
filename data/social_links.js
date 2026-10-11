/* Identify a social platform from the saved profile URL. */
(function () {
    'use strict';

    var domains = {
        tiktok: ['tiktok.com'],
        instagram: ['instagram.com'],
        youtube: ['youtube.com', 'youtu.be'],
        telegram: ['t.me', 'telegram.me'],
        discord: ['discord.com', 'discord.gg'],
        x: ['x.com', 'twitter.com']
    };

    function inferPlatform(value) {
        try {
            var host = new URL(String(value)).hostname.toLowerCase().replace(/^www\./, '');
            var keys = Object.keys(domains);
            for (var i = 0; i < keys.length; i += 1) {
                var list = domains[keys[i]];
                for (var j = 0; j < list.length; j += 1) {
                    if (host === list[j] || host.endsWith('.' + list[j])) return keys[i];
                }
            }
        } catch (_) {}
        return null;
    }

    function collect(profile) {
        profile = profile || {};
        var links = Object.assign({}, profile.socials || profile.socialLinks || {});
        var savedUrl = profile.social_url;
        if (savedUrl) {
            var platform = inferPlatform(savedUrl) || 'website';
            if (!links[platform]) links[platform] = savedUrl;
        }
        return links;
    }

    window.ARAnimeSocialLinks = { inferPlatform: inferPlatform, collect: collect };
})();
