// دالة جلب البيانات الأساسية للأنمي
async function getAnimeDataFromMAL(malId) {
    const cacheKey = `anime_mal_${malId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            const now = new Date().getTime();
            if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
                return parsed.data;
            }
        } catch (e) { localStorage.removeItem(cacheKey); }
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); 
        
        const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error("Network error");
        const json = await response.json();
        
        if (json.data) {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: new Date().getTime(),
                data: json.data
            }));
            return json.data;
        }
    } catch (error) {
        console.error("خطأ في جلب بيانات MAL:", error);
    }
    return null; 
}

// دالة جلب شخصيات الأنمي
async function getAnimeCharactersFromMAL(malId) {
    const cacheKey = `anime_chars_${malId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            const now = new Date().getTime();
            if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
                return parsed.data;
            }
        } catch (e) { localStorage.removeItem(cacheKey); }
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); 
        
        const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/characters`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error("Network error");
        const json = await response.json();
        
        if (json.data) {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: new Date().getTime(),
                data: json.data
            }));
            return json.data;
        }
    } catch (error) {
        console.error("خطأ في جلب بيانات الشخصيات:", error);
    }
    return null; 
}

// دوال تحويل النصوص إلى العربية
function mapStatusToArabic(status) {
    if (!status) return "غير معروف";
    status = status.toLowerCase();
    if (status.includes("currently airing") || status.includes("ongoing")) return "مستمر";
    if (status.includes("finished") || status.includes("completed")) return "مكتمل";
    return "غير معروف";
}

function mapTypeToArabic(type) {
    if (!type) return "غير معروف";
    type = type.toUpperCase();
    if (type === "TV") return "مسلسل";
    if (type === "MOVIE") return "فيلم";
    if (type === "OVA" || type === "ONA") return "أوفا / أونا";
    if (type === "SPECIAL") return "حلقة خاصة";
    return type;
}

// دالة تشغيل الفيديو
// دالة تشغيل الفيديو
window.playEpisode = function(animeId, epIndex) {
    const epData = animeDetailsDatabase[animeId].episodes[epIndex];
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    const titleElement = document.getElementById("playing-episode-title");
    const serversContainer = document.getElementById("servers-container");

    if (playerContainer && iframe && epData.servers && epData.servers.length > 0) {
        // 1. تشغيل السيرفر الأول كافتراضي باستخدام الرابط المباشر للمشاهدة
        const defaultPlayUrl = epData.servers[0].direct_url || epData.servers[0].url;
        changeServer(defaultPlayUrl);
        titleElement.innerText = `جاري تشغيل: ${epData.title}`;
        
        serversContainer.innerHTML = "";
        
        // 2. إنشاء أزرار سيرفرات المشاهدة
        epData.servers.forEach((server, index) => {
            const btn = document.createElement("button");
            btn.className = `server-btn ${index === 0 ? 'active' : ''}`;
            btn.innerText = server.name;
            btn.onclick = (e) => {
                document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // تحديث الـ iframe بالرابط المباشر عند تغيير السيرفر
                changeServer(server.direct_url || server.url);
            };
            serversContainer.appendChild(btn);
        });

        // 3. إضافة زر "تحميل الحلقة" وربطه بموقع ouo.io
        // نأخذ رابط التحميل من السيرفر الأول (أو يمكنك تخصيصه كما تشاء)
        const downloadUrl = epData.servers[0].ouo_url || epData.servers[0].url;
        
        const downloadBtn = document.createElement("a");
        downloadBtn.href = downloadUrl;
        downloadBtn.target = "_blank"; // لفتح الرابط في نافذة جديدة دون إغلاق الموقع
        downloadBtn.className = "download-action-btn"; // كلاس لسهولة التعديل في الـ CSS
        downloadBtn.innerHTML = "📥 تحميل الحلقة";
        
        // تنسيق برمجي للزر ليبرز عن باقي سيرفرات المشاهدة (يمكنك نقله لملف الـ CSS)
        downloadBtn.style.cssText = "background-color: #2ea043; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-right: 15px; display: inline-block; cursor: pointer; transition: 0.3s;";
        
        // إضافة تأثير بسيط عند مرور الماوس
        downloadBtn.onmouseover = () => downloadBtn.style.opacity = "0.8";
        downloadBtn.onmouseout = () => downloadBtn.style.opacity = "1";

        serversContainer.appendChild(downloadBtn);

        // 4. إظهار المشغل والنزول إليه
        playerContainer.style.display = "block";
        playerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        alert("لا توجد سيرفرات متاحة لهذه الحلقة حالياً.");
    }
};

function changeServer(url) {
    const iframe = document.getElementById("video-iframe");
    iframe.src = url;
}

window.closeInlinePlayer = function() {
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    playerContainer.style.display = "none";
    iframe.src = ""; 
};

// دالة لترجمة النصوص من الإنجليزية إلى العربية باستخدام جوجل
async function translateToArabic(text) {
    if (!text) return "لا تتوفر قصة حالياً.";
    
    let cleanText = text.replace("[Written by MAL Rewrite]", "").trim();
    
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(cleanText)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        let translatedText = "";
        for (let i = 0; i < data[0].length; i++) {
            translatedText += data[0][i][0];
        }
        return translatedText;
    } catch (error) {
        console.error("خطأ في الترجمة:", error);
        return cleanText; 
    }
}

// تجهيز الصفحة عند التحميل
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || 'wind_breaker'; 
    const localData = animeDetailsDatabase[animeId];

    if (!localData) {
        document.getElementById("anime-title").innerText = "الأنمي غير موجود في قاعدة بياناتنا";
        return;
    }

    document.getElementById("anime-title").innerText = "جاري تحميل البيانات...";
    const apiData = await getAnimeDataFromMAL(localData.malId);

    const title = localData.title || (apiData ? (apiData.title_english || apiData.title) : "اسم الأنمي");
    const poster = apiData ? (apiData.images?.jpg?.large_image_url || localData.poster) : localData.poster;
    const coverBanner = localData.coverBanner || poster;
    const status = apiData ? mapStatusToArabic(apiData.status) : "غير معروف";
    const type = apiData ? mapTypeToArabic(apiData.type) : "غير معروف";
    const rating = apiData && apiData.score ? `★ ${apiData.score}` : "★ -";
    
    // === [ترجمة القصة تلقائياً عند عدم توفرها محلياً] ===
    let rawStory = "";
    if (localData.story && localData.story.trim() !== "") {
        rawStory = localData.story;
    } else if (apiData && apiData.synopsis) {
        document.getElementById("anime-story").innerText = "جاري ترجمة القصة...";
        rawStory = await translateToArabic(apiData.synopsis);
    } else {
        rawStory = "لا تتوفر قصة حالياً.";
    }
    
    // === [كود التصنيفات مع إضافة فريق الدبلجة] ===
    let genres = apiData && apiData.genres ? apiData.genres.map(g => g.name) : [];
    
    if (localData.dubbingTeam && localData.dubbingTeam.trim() !== "") {
        genres.unshift(localData.dubbingTeam);
    }
    
    document.getElementById("anime-cover").style.backgroundImage = `url('${coverBanner}')`;
    document.getElementById("anime-poster-img").src = poster;
    document.getElementById("anime-title").innerText = title;
    document.getElementById("anime-status").innerText = status;
    document.getElementById("anime-type").innerText = type;
    document.getElementById("anime-rating").innerText = rating;
    document.getElementById("ep-count").innerText = `${localData.episodes.length} حلقة`;

    const storyContainer = document.getElementById("anime-story");
    const limit = 250; 
    if (rawStory.length > limit) {
        const shortStory = rawStory.substring(0, limit) + "... ";
        storyContainer.innerHTML = `
            <span id="story-text">${shortStory}</span>
            <span id="read-more-btn" style="color: var(--accent-red); cursor: pointer; font-weight: bold; margin-right: 5px; text-decoration: underline;">اقرأ المزيد</span>
        `;
        document.getElementById("read-more-btn").addEventListener("click", function() {
            const textSpan = document.getElementById("story-text");
            if (this.innerText === "اقرأ المزيد") {
                textSpan.innerText = rawStory;
                this.innerText = "عرض أقل";
            } else {
                textSpan.innerText = shortStory;
                this.innerText = "اقرأ المزيد";
            }
        });
    } else {
        storyContainer.innerText = rawStory;
    }

    const genresContainer = document.getElementById("anime-genres");
    if(genresContainer) {
        genresContainer.innerHTML = ""; 
        genres.forEach((genre, index) => {
            if(index === 0 && localData.dubbingTeam) {
                genresContainer.innerHTML += `<span class="dub-team-tag" style="background-color: var(--accent-grey);">${genre}</span>`;
            } else {
                genresContainer.innerHTML += `<span>${genre}</span>`;
            }
        });
    }

    const episodesGrid = document.getElementById("episodes-grid");
    episodesGrid.innerHTML = ""; 
    localData.episodes.forEach((ep, index) => {
        const epCard = `
            <div class="ep-card" onclick="playEpisode('${animeId}', ${index})" style="cursor: pointer;">
                <div class="ep-thumb-container">
                    <img src="${ep.thumbnail}" alt="${ep.title}">
                    <span class="ep-duration">${ep.duration}</span>
                    <div class="ep-play-overlay">▶</div>
                </div>
                <div class="ep-card-info">
                    <h4>${ep.title}</h4>
                    <p>تاريخ النشر: ${ep.date}</p>
                </div>
            </div>
        `;
        episodesGrid.innerHTML += epCard;
    });

    const charactersContainer = document.getElementById("anime-characters"); 
    
    if (charactersContainer) {
        charactersContainer.innerHTML = "جاري تحميل الشخصيات...";
        const charsApiData = await getAnimeCharactersFromMAL(localData.malId);
        
        if (charsApiData && charsApiData.length > 0) {
            charactersContainer.innerHTML = ""; 
            
            const topCharacters = charsApiData.sort((a, b) => b.favorites - a.favorites).slice(0, 20);
            
            topCharacters.forEach(charData => {
                const charNameMAL = charData.character.name;
                const charImage = charData.character.images.jpg.image_url;

                const dubbedNamesDict = localData.dubbedCharacters || {};
                const rawOverride = dubbedNamesDict[charNameMAL];

                // نحاول ربط النص الموجود في dubbedCharacters بمؤدٍ مسجَّل فعلياً في dubbers_data.js
                // (يعمل بدون أي تعديل هدّام: لو ماقدرش يربطها، تتعرض كترجمة نص عادية زي الأول تماماً)
                const resolved = (typeof window.ActorsEngine !== "undefined")
                    ? window.ActorsEngine.resolveCharacterDisplay(rawOverride, charNameMAL)
                    : { displayName: rawOverride || charNameMAL, actorId: null, linked: false };

                const finalName = resolved.displayName;
                const linkOpen = resolved.linked ? `<a href="actor.html?id=${encodeURIComponent(resolved.actorId)}" style="text-decoration:none; color:inherit;">` : "";
                const linkClose = resolved.linked ? `</a>` : "";
                const dubberBadge = resolved.linked ? `<span style="display:block; font-size:10px; color:var(--he-red-2,#ff3b3b); margin-top:2px;">🎙️ صفحة المؤدي</span>` : "";

                const charCard = `
                    <div class="character-card" style="display: inline-block; width: 120px; margin: 10px; text-align: center;">
                        ${linkOpen}
                        <img src="${charImage}" alt="${finalName}" style="width: 100px; height: 150px; object-fit: cover; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                        <h5 style="margin-top: 8px; font-size: 13px; word-wrap: break-word;">${finalName}</h5>
                        ${dubberBadge}
                        ${linkClose}
                    </div>
                `;
                charactersContainer.innerHTML += charCard;
            });
        } else {
            charactersContainer.innerHTML = "لا توجد بيانات للشخصيات.";
        }
    }
});
