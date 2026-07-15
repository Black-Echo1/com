// دالة محسنة لجلب البيانات - إذا فشل الاتصال ستستمر الصفحة في العمل


async function getAnimeDataFromMAL(malId) {
    const cacheKey = `anime_mal_${malId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    // محاولة التحقق من الكاش
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
        // إضافة timeout بسيط للـ fetch لضمان عدم تعليق الصفحة
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 ثواني حد أقصى
        
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
    return null; // تعود بقيمة فارغة بدلاً من تعليق البرنامج
}

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || 'death_note'; 
    const localData = animeDetailsDatabase[animeId];

    if (!localData) {
        document.getElementById("anime-title").innerText = "الأنمي غير موجود في قاعدة بياناتنا";
        return;
    }

    // جلب البيانات مع توفير قيم افتراضية في حال فشل الـ API
    const apiData = await getAnimeDataFromMAL(localData.malId);

    // إذا فشل الـ API، نستخدم البيانات المحلية المتاحة فقط
    const title = localData.title || (apiData ? (apiData.title_english || apiData.title) : "اسم الأنمي");
    const poster = apiData ? (apiData.images?.jpg?.large_image_url || localData.poster) : localData.poster;
    const coverBanner = localData.coverBanner || poster;
    const status = apiData ? mapStatusToArabic(apiData.status) : "غير معروف";
    const type = apiData ? mapTypeToArabic(apiData.type) : "غير معروف";
    const rating = apiData && apiData.score ? `★ ${apiData.score}` : "★ -";
    const rawStory = localData.story || (apiData ? apiData.synopsis : "لا تتوفر قصة حالياً.");
    
    // تعبئة البيانات (بدون شرط انتظار الـ API)
    document.getElementById("anime-cover").style.backgroundImage = `url('${coverBanner}')`;
    document.getElementById("anime-poster-img").src = poster;
    document.getElementById("anime-title").innerText = title;
    document.getElementById("anime-status").innerText = status;
    document.getElementById("anime-type").innerText = type;
    document.getElementById("anime-rating").innerText = rating;
    document.getElementById("ep-count").innerText = `${localData.episodes.length} حلقة`;

    // ... (باقي الكود الخاص بالقصة والحلقات كما هو)
    // لاحظ: إذا كانت القصة غير موجودة تماماً، نضع نصاً افتراضياً
    const storyContainer = document.getElementById("anime-story");
    storyContainer.innerText = rawStory; 
    
    // (أعد وضع كود "اقرأ المزيد" وتوليد الحلقات هنا كما في الكود السابق)
});

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

// دالة تشغيل الفيديو المدمج وحظر الإعلانات
window.playEpisode = function(videoLink, episodeTitle) {
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    const titleElement = document.getElementById("playing-episode-title");

    if (playerContainer && iframe) {
        iframe.src = videoLink;
        if (titleElement) {
            titleElement.innerText = `جاري تشغيل: ${episodeTitle}`;
        }
        playerContainer.style.display = "block";
        playerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || 'death_note'; 

    const localData = animeDetailsDatabase[animeId];

    if (!localData) {
        document.getElementById("anime-title").innerText = "الأنمي غير موجود";
        return;
    }

    document.getElementById("anime-title").innerText = "جاري تحميل البيانات...";

    const apiData = await getAnimeDataFromMAL(localData.malId);

    if (!apiData) {
        document.getElementById("anime-title").innerText = "فشل تحميل البيانات من MAL";
        return;
    }

    const title = localData.title || apiData.title_english || apiData.title;
    const poster = apiData.images?.jpg?.large_image_url || localData.poster;
    const coverBanner = localData.coverBanner || poster; 
    const status = mapStatusToArabic(apiData.status);
    const type = mapTypeToArabic(apiData.type);
    const rating = apiData.score ? `★ ${apiData.score}` : "★ غير متوفر";
    const rawStory = localData.story || apiData.synopsis || "لا توجد قصة متوفرة حالياً.";
    const genres = apiData.genres?.map(g => g.name) || [];

    document.getElementById("anime-cover").style.backgroundImage = `url('${coverBanner}')`;
    document.getElementById("anime-poster-img").src = poster;
    document.getElementById("anime-title").innerText = title;
    document.getElementById("anime-status").innerText = status;
    document.getElementById("anime-type").innerText = type;
    document.getElementById("anime-rating").innerText = rating;
    document.getElementById("ep-count").innerText = `${localData.episodes.length} حلقة`;

    // نظام "اقرأ المزيد" التلقائي للقصة
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
    genresContainer.innerHTML = ""; 
    genres.forEach(genre => {
        genresContainer.innerHTML += `<span>${genre}</span>`;
    });

    // توليد الحلقات وتفعيل دالة تشغيل الفيديو عند الضغط
    const episodesGrid = document.getElementById("episodes-grid");
    episodesGrid.innerHTML = ""; 
    localData.episodes.forEach(ep => {
        const epCard = `
            <div class="ep-card" onclick="playEpisode('${ep.videoLink}', '${ep.title}')" style="cursor: pointer;">
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
});