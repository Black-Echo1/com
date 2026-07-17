const ENABLE_ADS = false; 

document.addEventListener("DOMContentLoaded", () => {
    // 1. تحميل مقاطع التدريب (لصفحات الشباب والفتيات)
    const grid = document.getElementById("video-grid");
    if (grid) {
        const category = grid.getAttribute("data-category");
        const videos = videosData[category] || [];
        
        videos.forEach((video, index) => {
            const linkWithSubs = `https://drive.google.com/uc?export=download&id=${video.downloadWithSubsId}`;
            const linkNoSubs = `https://drive.google.com/uc?export=download&id=${video.downloadNoSubsId}`;
            
            grid.innerHTML += `
                <div class="video-card">
                    <div class="smart-thumbnail" onclick="triggerAdAndPlay('${category}', ${index}, 'training')">
                        <img src="${video.thumbnail}" alt="${video.title}">
                        <div class="play-overlay">تشغيل المشهد</div>
                    </div>
                    <h3>${video.title}</h3>
                    <div class="download-buttons-holder">
                        <a href="${linkWithSubs}" class="download-btn btn-subs">تحميل (مترجم)</a>
                        <a href="${linkNoSubs}" class="download-btn btn-no-subs">تحميل (خام)</a>
                    </div>
                </div>
            `;
        });
    }

    // 2. تحميل مقاطع المسابقة (لصفحة المسابقات)
    const compGrid = document.getElementById("competition-grid");
    if (compGrid) {
        document.getElementById("comp-week-title").innerText = competitionData.weekTitle;
        const participants = competitionData.participants;

        participants.forEach((p, index) => {
            // التحقق من التصويت المحلي لتهيئة الزر
            let hasVoted = localStorage.getItem(`voted_for_${p.id}`) ? true : false;
            let btnClass = hasVoted ? "vote-btn voted" : "vote-btn";
            let btnText = hasVoted ? "تم التصويت ✔" : "صوّت الآن";
            
            // قراءة عدد الأصوات الوهمي/الابتدائي من الداتا (سيتغير لاحقاً بربط فايربيس)
            let currentVotes = p.initialVotes + (hasVoted ? 1 : 0);

            compGrid.innerHTML += `
                <div class="video-card comp-card">
                    <div class="smart-thumbnail" onclick="playCompVideo(${index})">
                        <img src="${p.thumbnail}" alt="${p.name}">
                        <div class="play-overlay">مشاهدة الأداء</div>
                    </div>
                    <h3>${p.name}</h3>
                    <div class="vote-section">
                        <span class="vote-count" id="count_${p.id}">${currentVotes} صوت</span>
                        <button class="${btnClass}" id="btn_${p.id}" onclick="castVote('${p.id}', ${currentVotes})">${btnText}</button>
                    </div>
                </div>
            `;
        });
    }
});

// دوال المسابقة
function playCompVideo(index) {
    let videoModal = document.getElementById("videoModal");
    let videoFrame = document.getElementById("mainVideoFrame");
    let serverTabs = document.getElementById("server-tabs");
    
    if (serverTabs) serverTabs.style.display = "none"; // لا نحتاج لسيرفرات متعددة في المسابقة
    
    const participant = competitionData.participants[index];
    if(videoModal && videoFrame) {
        videoFrame.src = participant.videoUrl;
        videoFrame.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
        videoFrame.setAttribute("allowfullscreen", "true");
        videoModal.style.display = "flex";
    }
}

function castVote(participantId, currentVotes) {
    // التحقق مما إذا كان العضو قد صوّت لأي شخص في هذه المسابقة
    let hasVotedAny = localStorage.getItem("voted_this_week");
    let btn = document.getElementById(`btn_${participantId}`);
    let countSpan = document.getElementById(`count_${participantId}`);

    if (hasVotedAny) {
        alert("لقد قمت بالتصويت بالفعل في مسابقة هذا الأسبوع! لا يمكن التصويت مرتين.");
        return;
    }

    // تسجيل التصويت
    localStorage.setItem("voted_this_week", "true");
    localStorage.setItem(`voted_for_${participantId}`, "true");
    
    // تحديث الواجهة
    btn.classList.add("voted");
    btn.innerText = "تم التصويت ✔";
    countSpan.innerText = `${currentVotes + 1} صوت`;
    
    alert("تم تسجيل صوتك بنجاح! شكراً لمشاركتك.");
}

// دوال التدريب (المكتبة)
let currentCategory = "", currentIndex = null;

function triggerAdAndPlay(category, index, type) {
    currentCategory = category; currentIndex = index;
    if (ENABLE_ADS) { /* كود الإعلانات المجمد */ } else { openVideo(); }
}

function openVideo() {
    let videoModal = document.getElementById("videoModal");
    let serverContainer = document.getElementById("server-tabs");
    let videoFrame = document.getElementById("mainVideoFrame");
    serverContainer.style.display = "flex";
    
    const video = videosData[currentCategory][currentIndex];
    serverContainer.innerHTML = "";
    
    let firstServerUrl = "";
    Object.keys(video.servers).forEach((serverName, idx) => {
        const serverUrl = video.servers[serverName];
        if(idx === 0) firstServerUrl = serverUrl;
        
        const btn = document.createElement("button");
        btn.innerText = serverName;
        btn.className = `server-btn ${idx === 0 ? 'active' : ''}`;
        btn.onclick = () => {
            videoFrame.src = serverUrl;
            document.querySelectorAll(".server-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        };
        serverContainer.appendChild(btn);
    });

    if(videoModal && videoFrame) {
        videoFrame.src = firstServerUrl;
        videoFrame.setAttribute("allow", "autoplay; fullscreen");
        videoModal.style.display = "flex";
    }
}

function closeVideo() {
    let videoModal = document.getElementById("videoModal");
    let videoFrame = document.getElementById("mainVideoFrame");
    if(videoModal && videoFrame) {
        videoModal.style.display = "none";
        videoFrame.src = "";
    }
}// ==========================================
// نظام كورس الدبلجة (توليد قائمة الدروس العمودية)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const courseList = document.getElementById("course-list");
    
    if (courseList) {
        // تحديث عنوان ووصف الكورس في الواجهة
        document.getElementById("course-main-title").innerText = courseData.courseTitle;
        document.getElementById("course-main-desc").innerText = courseData.courseDescription;
        
        const lessons = courseData.lessons;
        
        lessons.forEach((lesson, index) => {
            // التحقق مما إذا كان المستخدم قد فتح الدرس سابقاً (لتحويل الزر إلى "أكمل")
            let hasStarted = localStorage.getItem(`started_${lesson.id}`);
            let btnClass = hasStarted ? "play-btn continue" : "play-btn";
            let btnText = hasStarted ? "أكمل المشاهدة ⏸" : "شاهد الآن ▶";
            let progressHtml = hasStarted ? `<div class="progress-bar"><div class="progress-fill" style="width: 45%;"></div></div>` : "";

            const lessonHTML = `
                <div class="episode-card" onclick="playLesson('${lesson.id}', '${lesson.videoUrl}', ${index})">
                    <div class="ep-thumbnail">
                        <img src="${lesson.thumbnail}" alt="${lesson.title}">
                        <span class="ep-time">${lesson.duration}</span>
                    </div>
                    <div class="ep-info">
                        <h3>${lesson.title}</h3>
                        <p>${lesson.description}</p>
                        ${progressHtml}
                    </div>
                    <div class="ep-action">
                        <button class="${btnClass}" id="btn_${lesson.id}">${btnText}</button>
                    </div>
                </div>
            `;
            courseList.innerHTML += lessonHTML;
        });
    }
});

// دالة تشغيل الدرس
function playLesson(lessonId, videoUrl, index) {
    // تسجيل أن المستخدم بدأ بمشاهدة هذا الدرس
    localStorage.setItem(`started_${lessonId}`, "true");
    
    // تحديث شكل الزر فوراً في الواجهة
    let btn = document.getElementById(`btn_${lessonId}`);
    if(btn) {
        btn.classList.add("continue");
        btn.innerText = "أكمل المشاهدة ⏸";
    }

    // فتح نافذة الفيديو
    let videoModal = document.getElementById("videoModal");
    let videoFrame = document.getElementById("mainVideoFrame");
    
    // إخفاء تبويبات السيرفرات لأن الدروس غالباً لها مصدر واحد مباشر
    let serverTabs = document.getElementById("server-tabs");
    if (serverTabs) serverTabs.style.display = "none";

    if(videoModal && videoFrame) {
        videoFrame.src = videoUrl;
        videoFrame.setAttribute("allow", "autoplay; fullscreen");
        videoModal.style.display = "flex";
    }
}// دالة لفتح وإغلاق القائمة الجانبية عند الضغط على الأزرار

document.addEventListener("DOMContentLoaded", function() {
    const menuIcon = document.querySelector('.menu-icon');
    const closeBtn = document.querySelector('.close-btn');
    const navMenu = document.getElementById('navMenu');
// أضف هذا الجزء في ملف الجافاسكريبت
const navLinks = document.querySelectorAll('#navMenu a'); 

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active'); // إغلاق القائمة فور الضغط
    });
});
    // تفعيل الفتح عند الضغط على الثلاث خطوط
    if (menuIcon && navMenu) {
        menuIcon.addEventListener('click', function(e) {
             e.stopPropagation();
            navMenu.classList.toggle('active');
        });
    }

    // تفعيل الإغلاق عند الضغط على زر X
    if (closeBtn && navMenu) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            navMenu.classList.remove('active');
        });
    }
});
