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

// دالة تشغيل الفيديو الجديدة الداعمة للسيرفرات
window.playEpisode = function(animeId, epIndex) {
    const epData = animeDetailsDatabase[animeId].episodes[epIndex];
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    const titleElement = document.getElementById("playing-episode-title");
    const serversContainer = document.getElementById("servers-container");

    if (playerContainer && iframe && epData.servers && epData.servers.length > 0) {
        // تشغيل السيرفر الأول افتراضياً
        changeServer(epData.servers[0].url);
        titleElement.innerText = `جاري تشغيل: ${epData.title}`;
        
        // توليد أزرار السيرفرات
        serversContainer.innerHTML = "";
        epData.servers.forEach((server, index) => {
            const btn = document.createElement("button");
            btn.className = `server-btn ${index === 0 ? 'active' : ''}`;
            btn.innerText = server.name;
            btn.onclick = (e) => {
                // إزالة التفعيل من باقي الأزرار
                document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                changeServer(server.url);
            };
            serversContainer.appendChild(btn);
        });

        playerContainer.style.display = "block";
        playerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        alert("لا توجد سيرفرات متاحة لهذه الحلقة حالياً.");
    }
};

// دالة مساعدة لتغيير السيرفر
function changeServer(url) {
    const iframe = document.getElementById("video-iframe");
    iframe.src = url;
}

// دالة إغلاق المشغل
window.closeInlinePlayer = function() {
    const playerContainer = document.getElementById("video-player-container");
    const iframe = document.getElementById("video-iframe");
    playerContainer.style.display = "none";
    iframe.src = ""; 
};

// الكود المدمج لتجهيز الصفحة عند التحميل (بدلاً من دالتين منفصلتين)
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || 'death_note'; 
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
    const rawStory = localData.story || (apiData ? apiData.synopsis : "لا تتوفر قصة حالياً.");
    const genres = apiData && apiData.genres ? apiData.genres.map(g => g.name) : [];
    
    // تعبئة البيانات الأساسية
    document.getElementById("anime-cover").style.backgroundImage = `url('${coverBanner}')`;
    document.getElementById("anime-poster-img").src = poster;
    document.getElementById("anime-title").innerText = title;
    document.getElementById("anime-status").innerText = status;
    document.getElementById("anime-type").innerText = type;
    document.getElementById("anime-rating").innerText = rating;
    document.getElementById("ep-count").innerText = `${localData.episodes.length} حلقة`;

    // نظام "اقرأ المزيد"
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

    // التصنيفات (Genres)
    const genresContainer = document.getElementById("anime-genres");
    if(genresContainer) {
        genresContainer.innerHTML = ""; 
        genres.forEach(genre => {
            genresContainer.innerHTML += `<span>${genre}</span>`;
        });
    }

    // توليد الحلقات وتمرير (معرف الأنمي ورقم الحلقة) بدلاً من الرابط النصي
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
});