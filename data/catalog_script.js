document.addEventListener("DOMContentLoaded", () => {
    const heroContainer = document.getElementById("hero-slider");
    const gridContainer = document.getElementById("recent-releases-grid");

    // توليد الأنميات في الشبكة
    animeCatalog.forEach(anime => {
        // التحقق من حالة الأنمي لتغيير لون الشارة (أخضر أو أحمر)
        let badgeClass = anime.status === "مكتمل" ? "status-badge completed" : "status-badge";
        let statusText = anime.status === "مكتمل" ? "مكتمل" : "مستمر (On Going)";

        // إذا كان الأنمي هو الهيرو (البانر الكبير)
        if(anime.isHero && heroContainer.innerHTML === "") {
            heroContainer.innerHTML = `
                <div class="hero-slide" style="background-image: linear-gradient(to top, #090a0f, transparent), url('${anime.banner}')" onclick="openAnime('${anime.id}')">
                    <div class="hero-content">
                        <h1>${anime.title}</h1>
                        <p style="color: #ccc;">${anime.type} • ⭐️ ${anime.rating}</p>
                    </div>
                </div>
            `;
        }

        // بناء بطاقات الأنمي المصغرة
        const cardHTML = `
            <div class="anime-card" onclick="openAnime('${anime.id}')">
                <div class="card-poster">
                    <span class="${badgeClass}">${statusText}</span>
                    <img src="${anime.poster}" alt="${anime.title}">
                    <span class="episodes-badge">${anime.episodes}</span>
                </div>
                <div class="card-info">
                    <h3>${anime.title}</h3>
                    <div class="card-stats">
                        <span><span class="star-icon">★</span> ${anime.rating}</span>
                        <span>(${anime.views} مشاهدة)</span>
                    </div>
                </div>
            </div>
        `;
        gridContainer.innerHTML += cardHTML;
    });
});

// دالة الانتقال لصفحة المشاهدة عند النقر على الأنمي
// استبدل الدالة القديمة بهذه
function openAnime(animeId) {
    window.location.href = `watch.html?id=${animeId}`;
}