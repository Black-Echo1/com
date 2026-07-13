document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("video-grid");
    
    if (grid) {
        const category = grid.getAttribute("data-category");
        const videos = videosData[category] || [];
        
        videos.forEach((video, index) => {
            // التعديل: قراءة روابط دودو ستريم مباشرة من قاعدة البيانات
            const linkWithSubs = video.downloadWithSubsUrl;
            const linkNoSubs = video.downloadNoSubsUrl;
            
            const cardHTML = `
                <div class="video-card">
                    <div class="smart-thumbnail" onclick="triggerAdAndPlay('${category}', ${index})">
                        <img src="${video.thumbnail}" alt="${video.title}">
                        <div class="play-overlay">تشغيل المشهد</div>
                    </div>
                    <h3>${video.title}</h3>
                    <div class="download-buttons-holder">
                        <a href="${linkWithSubs}" target="_blank" class="download-btn btn-subs">تحميل المقطع (مترجم)</a>
                        <a href="${linkNoSubs}" target="_blank" class="download-btn btn-no-subs">تحت التطوير - تحميل المقطع (خام)</a>
                    </div>
                </div>
            `;
            grid.innerHTML += cardHTML;
        });
    }
});

let currentCategory = "";
let currentIndex = null;
let adTimer;

function triggerAdAndPlay(category, index) {
    currentCategory = category;
    currentIndex = index;
    let adModal = document.getElementById("adModal");
    let closeAdBtn = document.querySelector(".close-ad");
    let countdownElement = document.getElementById("countdown");

    if(adModal) {
        adModal.style.display = "flex";
        closeAdBtn.style.display = "none";
        
        let timeLeft = 5; 
        countdownElement.innerText = timeLeft;

        adTimer = setInterval(function() {
            timeLeft--;
            countdownElement.innerText = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(adTimer);
                closeAdBtn.style.display = "block";
            }
        }, 1000);
    }
}

function openVideo() {
    document.getElementById("adModal").style.display = "none";
    let videoModal = document.getElementById("videoModal");
    let serverContainer = document.getElementById("server-tabs");
    let videoFrame = document.getElementById("mainVideoFrame");
    
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
}