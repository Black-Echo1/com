let currentLanguage = "";
let currentReleaseType = "SUB"; // الافتراضي مترجم

document.addEventListener("DOMContentLoaded", () => {
    // جلب البيانات الأساسية للفيلم
    document.getElementById("movie-display-title").innerText = projectDetailData.title;
    document.getElementById("movie-display-desc").innerText = projectDetailData.description;

    // 1. توليد تابات اللغات ديناميكياً بناءً على البيانات المتوفرة
    const langContainer = document.getElementById("langTabsContainer");
    const availableLanguages = Object.keys(projectDetailData.mediaSources);
    
    availableLanguages.forEach((lang, index) => {
        if(index === 0) currentLanguage = lang; // تعيين اللغة الأولى كافتراضية
        
        const tab = document.createElement("button");
        tab.className = `lang-tab ${index === 0 ? 'active' : ''}`;
        tab.id = `lang-tab-${lang}`;
        tab.innerText = lang === "ARABIC" ? "🇸🇩 ARABIC" : lang === "ENGLISH" ? "🇬🇧 ENGLISH" : lang;
        tab.onclick = () => selectLanguage(lang);
        langContainer.appendChild(tab);
    });

    // 2. تحديث قائمة الجودات والسيرفرات لأول مرة
    updateSourcesUI();
});

// دالة اختيار اللغة
function selectLanguage(lang) {
    currentLanguage = lang;
    document.querySelectorAll(".lang-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(`lang-tab-${lang}`).classList.add("active");
    updateSourcesUI();
}

// دالة اختيار نوع الإصدار (SUB / DUB)
function setReleaseType(type) {
    currentReleaseType = type;
    document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
    if(type === "SUB") document.getElementById("btn-sub").classList.add("active");
    if(type === "DUB") document.getElementById("btn-dub").classList.add("active");
    updateSourcesUI();
}

// تحديث لوحة السيرفرات بالكامل بناءً على اختيارات المستخدم
function updateSourcesUI() {
    const listContainer = document.getElementById("resolutionsList");
    listContainer.innerHTML = ""; // تصفية القائمة السابقة

    // الوصول للبيانات المطلوبة بناءً على التصفية الحالية
    const langData = projectDetailData.mediaSources[currentLanguage];
    if (!langData || !langData[currentReleaseType]) {
        listContainer.innerHTML = `<p class="no-source-msg">عذراً، هذا الخيار غير متوفر حالياً لهذه اللغة.</p>`;
        return;
    }

    const resolutions = langData[currentReleaseType];

    // المرور على كل جودة متوفرة (1080P, 720P...) وتوليد عناصرها
    Object.keys(resolutions).forEach(resolution => {
        const servers = resolutions[resolution];
        
        let resolutionBlock = document.createElement("div");
        resolutionBlock.className = "resolution-group";
        
        let title = document.createElement("h3");
        title.className = "resolution-title";
        title.innerText = resolution;
        resolutionBlock.appendChild(title);

        let serversContainer = document.createElement("div");
        serversContainer.className = "servers-list";

        servers.forEach(server => {
            const serverRow = `
                <div class="server-row">
                    <div class="server-info">
                        <span class="status-indicator"></span>
                        <span class="server-name">${server.serverName}</span>
                    </div>
                    <div class="server-actions">
                        <button class="action-btn play" onclick="playInActivePlayer('${server.playUrl}')">
                            مشاهدة ➔
                        </button>
                        <a href="${server.downloadUrl}" target="_blank" class="action-btn download">
                            تحميل ⬇
                        </a>
                    </div>
                </div>
            `;
            serversContainer.innerHTML += serverRow;
        });

        resolutionBlock.appendChild(serversContainer);
        listContainer.appendChild(resolutionBlock);
    });

    // تشغيل أول سيرفر تلقائياً في المشغل عند تغيير الإعدادات لسهولة الاستخدام
    try {
        const firstRes = Object.keys(resolutions)[0];
        const firstServer = resolutions[firstRes][0];
        playInActivePlayer(firstServer.playUrl);
    } catch(e) {
        document.getElementById("activeVideoPlayer").src = "";
    }
}

// دالة لتشغيل السيرفر المحدد داخل الآيفريم المدمج بالصفحة
function playInActivePlayer(url) {
    const player = document.getElementById("activeVideoPlayer");
    player.src = url;
}