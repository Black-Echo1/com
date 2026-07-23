const animeCatalog = [
    {
        id: "Attack on Titan: No Regrets",
        title: "Attack on Titan: No Regrets", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 25781,
        isHero: false
    },
    {
        id: "jaadugar",
        title: "Jaadugar", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 61483,
        isHero: false
    },
    {
        id: "wind breaker",
        title: "Wind Breaker", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 54900,
        isHero: true // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    }
    ,
    {
        id: "Super Dragon Ball Heroes",
        title: "Super Dragon Ball Heroes", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 37885,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
    {
        id: "Blue Lock",
        title: "Blue Lock", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 49596,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
    {
        id: "Blue Lock2",
        title: "Blue Lock 2", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 54865,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
    {
        id: "Jujutsu Kaisen",
        title: "Jujutsu Kaisen", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 40748,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
    {
        id: "Jujutsu-Kaisen-2",
        title: "Jujutsu Kaisen 2", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 51009,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
     {
        id: "Jujutsu-Kaisen-3",
        title: "Jujutsu Kaisen 3", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 57658,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
   {
        id: "Yu☆Gi☆Oh! Sevens",
        title: "Yu☆Gi☆Oh! Sevens", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 40145,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },{
        id: "Ore dake Level Up na Ken Solo Leveling",
        title: "Ore dake Level Up na Ken, Solo Leveling", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 52299,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },{
        id: "Solo Leveling Season 2",
        title: "Solo Leveling Season 2s", // <-- أضف هذا السطر ليتعرف عليه البحث
        malId: 58567,
        isHero: false // هذا الأنمي سيظهر في البانر الكبير بالأعلى
    },
];

function openAnime(animeId) {
    window.location.href = `anime.html?id=${animeId}`;
}
