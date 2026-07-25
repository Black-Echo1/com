// ================= إعدادات التحميل التدريجي =================
const BATCH_SIZE = 10; // عدد الأنميات التي تُحمّل وتُعرض دفعة واحدة قبل الانتقال للدفعة التالية

// يبقى عاماً حتى يقدر البحث الفوري يقرأ منه أثناء التحميل
let fullCatalog = [];

// ================= جلب بيانات الأنمي من MAL (مع تخزين مؤقت) =================
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
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
        if (!response.ok) throw new Error("Network error");
        const json = await response.json();
        const animeData = json.data;

        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: new Date().getTime(),
            data: animeData
        }));

        return animeData;
    } catch (error) {
        console.error("خطأ في جلب بيانات MAL للكتالوج:", error);
        return null;
    }
}

// ================= دوال تحويل النصوص إلى العربية =================
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
    return type;
}

// ================= رسم كرت أنمي واحد وإضافته للشبكة =================
function renderAnimeCard(grid, anime) {
    const badgeColor = anime.status === "مكتمل" ? "#2ea043" : "#ff6b35";

    const animeCard = document.createElement("div");
    animeCard.className = "anime-card";
    animeCard.style.cursor = "pointer";
    animeCard.innerHTML = `
        <div class="anime-card-image" style="position: relative; overflow: hidden; border-radius: 8px; height: 280px; margin-bottom: 15px;">
            <img src="${anime.poster}" alt="${anime.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
            <div class="badge" style="position: absolute; top: 10px; right: 10px; background: ${badgeColor}; color: white; padding: 5px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                ${anime.status}
            </div>
        </div>
        <h3 style="font-size: 1rem; margin-bottom: 8px; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${anime.title}</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #bbb;">
            <span>${anime.type}</span>
            <span>⭐ ${anime.rating}</span>
        </div>
    `;

    animeCard.addEventListener("click", () => openAnime(anime.id));
    grid.appendChild(animeCard);
}

// ================= رسم البانر الكبير =================
function renderHero(hero, heroAnime) {
    if (!hero || !heroAnime) return;
    hero.innerHTML = `
        <div style="background-image: url('${heroAnime.banner}'); background-size: cover; background-position: center; border-radius: 12px; height: 350px; display: flex; align-items: flex-end; padding: 30px; position: relative; margin-bottom: 40px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to top, rgba(9,10,15,1), transparent); border-radius: 12px;"></div>
            <div style="position: relative; z-index: 1;">
                <h1 style="font-size: 2.5rem; margin-bottom: 15px; color: #fff; text-shadow: 2px 2px 5px #000;">${heroAnime.title}</h1>
                <button onclick="openAnime('${heroAnime.id}')" style="background: var(--accent-red); color: white; border: none; padding: 10px 25px; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 1rem; transition: 0.3s;">شاهد التفاصيل والحلقات</button>
            </div>
        </div>
    `;
}

// ================= التحميل التدريجي: أول 10 ثم 10 التالية وهكذا =================
async function loadCatalogInBatches() {
    const grid = document.getElementById("recent-releases-grid");
    const hero = document.getElementById("hero-slider");
    const loader = document.getElementById("loader-wrapper");

    if (typeof animeCatalog === 'undefined') {
        console.error("تنبيه: ملف catalog_data.js لم يتم تحميله بشكل صحيح!");
        if (loader) loader.style.display = "none";
        return;
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));
    let heroRendered = false;

    if (grid) grid.innerHTML = "";

    for (let start = 0; start < animeCatalog.length; start += BATCH_SIZE) {
        const batch = animeCatalog.slice(start, start + BATCH_SIZE);

        for (const anime of batch) {
            const cacheKey = `anime_mal_${anime.malId}`;
            const hasCache = localStorage.getItem(cacheKey) !== null;

            const apiData = await getAnimeDataFromMAL(anime.malId);

            if (apiData) {
                const entry = {
                    id: anime.id,
                    title: anime.title || apiData.title_english || apiData.title,
                    type: mapTypeToArabic(apiData.type),
                    status: mapStatusToArabic(apiData.status),
                    rating: apiData.score ? apiData.score : "N/A",
                    poster: apiData.images?.jpg?.large_image_url || "",
                    banner: apiData.images?.jpg?.large_image_url || "",
                    isHero: anime.isHero
                };

                fullCatalog.push(entry);

                // إخفاء شاشة التحميل بمجرد ظهور أول دفعة
                if (loader) loader.style.display = "none";

                if (grid) renderAnimeCard(grid, entry);

                if (entry.isHero && !heroRendered) {
                    renderHero(hero, entry);
                    heroRendered = true;
                }
            }

            // تأخير بسيط لمنع الحظر من الـ API (فقط للطلبات غير المخزّنة مؤقتاً)
            if (!hasCache) {
                await delay(350);
            }
        }

        // فسحة صغيرة بين كل دفعة وأخرى قبل تحميل الدفعة التالية
        await delay(50);
    }

    // إن لم يوجد أي عنصر isHero محدد، استخدم أول عنصر توفر كبانر
    if (!heroRendered && fullCatalog.length > 0) {
        renderHero(hero, fullCatalog[0]);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadCatalogInBatches();
});

// ================= نظام البحث الفوري مع الصور المصغرة =================
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const dropdown = document.getElementById("search-results-dropdown");

    if (searchInput && dropdown) {
        searchInput.addEventListener("input", function () {
            const query = this.value.trim().toLowerCase();
            dropdown.innerHTML = "";

            if (query.length === 0) {
                dropdown.style.display = "none";
                return;
            }

            const matches = [];

            // البحث داخل الكتالوج المحمّل حتى الآن (يشمل ما وصل عبر التحميل التدريجي)
            if (fullCatalog && fullCatalog.length > 0) {
                fullCatalog.forEach(anime => {
                    const animeTitle = anime.title.toLowerCase();
                    const animeId = anime.id.toLowerCase();

                    if (animeTitle.includes(query) || animeId.includes(query)) {
                        matches.push(anime);
                    }
                });
            }

            if (matches.length > 0) {
                dropdown.style.display = "block";
                matches.forEach(anime => {
                    const item = document.createElement("div");
                    item.className = "search-item";

                    item.innerHTML = `
                        <img src="${anime.poster}" alt="${anime.title}">
                        <span>${anime.title}</span>
                    `;

                    item.onclick = () => {
                        window.location.href = `anime.html?id=${anime.id}`;
                    };
                    dropdown.appendChild(item);
                });
            } else {
                dropdown.style.display = "block";
                dropdown.innerHTML = `<div class="search-item" style="color: #888; cursor: default; justify-content: center;">لا توجد نتائج مطابقة</div>`;
            }
        });

        // إخفاء القائمة المنسدلة عند النقر خارجها
        document.addEventListener("click", (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = "none";
            }
        });
    }
});