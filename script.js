// خيار التحكم بالإعلانات: اجعلها true لتفعيلها مستقبلاً، أو false لتعطيلها وتجميدها تماماً
const ENABLE_ADS = false; 

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("video-grid");
    
    if (grid) {
        const category = grid.getAttribute("data-category");
        const videos = videosData[category] || [];
        
        videos.forEach((video, index) => {
            // التعديل هنا: تحويل معرف جوجل درايف إلى رابط تحميل مباشر يتخطى صفحة الفحص
            const linkWithSubs = `https://drive.google.com/uc?export=download&id=${video.downloadWithSubsid}`;
            const linkNoSubs = `https://drive.google.com/uc?export=download&id=${video.downloadNoSubsid}`;
            
            const cardHTML = `
                <div class="video-card">
                    <div class="smart-thumbnail" onclick="triggerAdAndPlay('${category}', ${index})">
                        <img src="${video.thumbnail}" alt="${video.title}">
                        <div class="play-overlay">تشغيل المشهد</div>
                    </div>
                    <h3>${video.title}</h3>
                    <div class="download-buttons-holder">
                        <a href="${linkWithSubs}" class="download-btn btn-subs">تحميل المقطع (مترجم)</a>
                        <a href="${linkNoSubs}" class="download-btn btn-no-subs">تحميل المقطع (خام)</a>
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

    if (ENABLE_ADS) {
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
    } else {
        openVideo();
    }
}

function openVideo() {
    let adModal = document.getElementById("adModal");
    if (adModal) adModal.style.display = "none";
    
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
        videoFrame.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
        videoFrame.setAttribute("allowfullscreen", "true");
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