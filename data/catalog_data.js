const animeCatalog = [
    {
        id: "Attack on Titan: No Regrets",
        malId: 25781,
        isHero: false
    },
    {
        id: "jaadugar",
        malId: 61483,
        isHero: false
    },
    {
        id: "wind_breaker",
        malId: 54900,
        isHero: true // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    }
    ,
    {
        id: "Super Dragon Ball Heroes",
        malId: 37885,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
    {
        id: "Blue Lock",
        malId: 49596,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
    {
        id: "Blue Lock2",
        malId: 54865,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    }
];

function openAnime(animeId) {
    window.location.href = `anime.html?id=${animeId}`;
}
