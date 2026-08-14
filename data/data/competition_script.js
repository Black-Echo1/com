document.addEventListener("DOMContentLoaded", () => {
    const compGrid = document.getElementById("competition-grid");
    if (compGrid) {
        document.getElementById("comp-week-title").innerText = competitionData.weekTitle;
        const participants = competitionData.participants;

        participants.forEach((p, index) => {
            let hasVoted = localStorage.getItem(`voted_for_${p.id}`) ? true : false;
            let btnClass = hasVoted ? "vote-btn voted" : "vote-btn";
            let btnText = hasVoted ? "تم التصويت ✔" : "صوّت الآن";
            let currentVotes = p.initialVotes + (hasVoted ? 1 : 0);

            compGrid.innerHTML += `
                <div class="video-card comp-card" style="border-color: rgba(241, 196, 15, 0.3);">
                    <div class="smart-thumbnail" onclick="playCompVideo('${p.videoUrl}')">
                        <img src="${p.thumbnail}" alt="${p.name}">
                        <div class="play-overlay">مشاهدة الأداء</div>
                    </div>
                    <h3>${p.name}</h3>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <span style="font-weight: 900; color: var(--accent-gold); font-size: 1.1rem;" id="count_${p.id}">${currentVotes} صوت</span>
                        <button class="${btnClass}" id="btn_${p.id}" onclick="castVote('${p.id}', ${currentVotes})" style="background: var(--accent-red); color: white; border: none; padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer;">${btnText}</button>
                    </div>
                </div>
            `;
        });
    }
});

function playCompVideo(videoUrl) {
    let videoModal = document.getElementById("videoModal");
    let videoFrame = document.getElementById("mainVideoFrame");
    if(videoModal && videoFrame) {
        videoFrame.src = videoUrl;
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

function castVote(participantId, currentVotes) {
    let hasVotedAny = localStorage.getItem("voted_this_week");
    let btn = document.getElementById(`btn_${participantId}`);
    let countSpan = document.getElementById(`count_${participantId}`);

    if (hasVotedAny) {
        alert("لقد قمت بالتصويت بالفعل في مسابقة هذا الأسبوع! لا يمكن التصويت مرتين.");
        return;
    }

    localStorage.setItem("voted_this_week", "true");
    localStorage.setItem(`voted_for_${participantId}`, "true");
    
    btn.style.background = "#2ea043";
    btn.innerText = "تم التصويت ✔";
    btn.disabled = true;
    countSpan.innerText = `${currentVotes + 1} صوت`;
    
    alert("تم تسجيل صوتك بنجاح! شكراً لمشاركتك.");
}