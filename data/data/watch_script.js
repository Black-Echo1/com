let currentProject = null;
let currentEpIndex = 0;
let currentLanguage = "";
let currentReleaseType = "DUB"; // جعلنا الدبلجة هي الأساسي لفريقكم

document.addEventListener("DOMContentLoaded", () => {
    // 1. معرفة الأنمي المختار من الرابط (مثال: watch.html?id=death_note)
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || 'death_note'; // الافتراضي للتجربة
    
    currentProject = projectsDB[projectId];
    
    if(!currentProject) {
        document.getElementById("project-title").innerText = "المشروع غير متوفر";
        return;
    }

    // تعبئة العناوين
    document.getElementById("project-title").innerText = currentProject.title;
    document.getElementById("project-desc").innerText = currentProject.description;

    // 2. التحقق مما إذا كان مسلسلاً لعرض شريط الحلقات
    if (currentProject.isSeries) {
        document.getElementById("episodes-section").style.display = "block";
        buildEpisodesSlider();
    }

    // تحميل السيرفرات للحلقة الأولى كبداية
    loadEpisodeData(0);
});

// بناء شريط الحلقات الأفقي
function buildEpisodesSlider() {
    const epContainer = document.getElementById("episodesList");
    epContainer.innerHTML = "";

    currentProject.episodes.forEach((ep, index) => {
        let activeClass = index === 0 ? "active" : "";
        
        let epCard = `
            <div class="ep-slide-card ${activeClass}" id="ep-card-${index}" onclick="loadEpisodeData(${index})">
                <div class="ep-thumb">
                    <img src="${ep.thumbnail}" alt="حلقة ${ep.epNumber}">
                    <span class="ep-num">${ep.epNumber}</span>
                </div>
                <h4>${ep.title}</h4>
            </div>
        `;
        epContainer.innerHTML += epCard;
    });
}

// تحميل بيانات السيرفرات واللغات بناءً على الحلقة المختارة
function loadEpisodeData(index) {
    currentEpIndex = index;
    
    // تمييز الحلقة المختارة في التصميم
    if (currentProject.isSeries) {
        document.querySelectorAll(".ep-slide-card").forEach(el => el.classList.remove("active"));
        const activeCard = document.getElementById(`ep-card-${index}`);
        if(activeCard) activeCard.classList.add("active");
        
        // تحديث عنوان الفيديو ليظهر رقم الحلقة
        document.getElementById("project-title").innerText = `${currentProject.title} - ${currentProject.episodes[index].title}`;
    }

    // تحديث اللغات المتاحة لهذه الحلقة تحديداً
    const episodeData = currentProject.episodes[currentEpIndex];
    const langContainer = document.getElementById("langTabsContainer");
    langContainer.innerHTML = "";
    
    const availableLanguages = Object.keys(episodeData.sources);
    
    availableLanguages.forEach((lang, i) => {
        if(i === 0) currentLanguage = lang; 
        
        const tab = document.createElement("button");
        tab.className = `lang-tab ${i === 0 ? 'active' : ''}`;
        tab.id = `lang-tab-${lang}`;
        tab.innerText = lang === "ARABIC" ? "🇸🇩 ARABIC" : lang;
        tab.onclick = () => selectLanguage(lang);
        langContainer.appendChild(tab);
    });

    updateSourcesUI();
}

function selectLanguage(lang) {
    currentLanguage = lang;
    document.querySelectorAll(".lang-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(`lang-tab-${lang}`).classList.add("active");
    updateSourcesUI();
}

function setReleaseType(type) {
    currentReleaseType = type;
    document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(`btn-${type.toLowerCase()}`).classList.add("active");
    updateSourcesUI();
}

function updateSourcesUI() {
    const listContainer = document.getElementById("resolutionsList");
    listContainer.innerHTML = ""; 

    const episodeData = currentProject.episodes[currentEpIndex];
    const langData = episodeData.sources[currentLanguage];
    
    if (!langData || !langData[currentReleaseType]) {
        listContainer.innerHTML = `<p class="no-source-msg">هذه الحلقة غير متوفرة بهذا الإصدار حالياً.</p>`;
        document.getElementById("activeVideoPlayer").src = "";
        return;
    }

    const resolutions = langData[currentReleaseType];
    let isFirstServerSet = false;

    Object.keys(resolutions).forEach(resolution => {
        let block = `<div class="resolution-group"><h3 class="resolution-title">${resolution}</h3><div class="servers-list">`;
        
        resolutions[resolution].forEach((server, sIdx) => {
            // تشغيل أول سيرفر تلقائياً
            if(!isFirstServerSet) {
                document.getElementById("activeVideoPlayer").src = server.playUrl;
                isFirstServerSet = true;
            }

            block += `
                <div class="server-row">
                    <div class="server-info"><span class="status-indicator"></span><span class="server-name">${server.serverName}</span></div>
                    <div class="server-actions">
                        <button class="action-btn play" onclick="document.getElementById('activeVideoPlayer').src='${server.playUrl}'">مشاهدة ➔</button>
                        <a href="${server.downloadUrl}" target="_blank" class="action-btn download">تحميل ⬇</a>
                    </div>
                </div>
            `;
        });
        
        block += `</div></div>`;
        listContainer.innerHTML += block;
    });
}