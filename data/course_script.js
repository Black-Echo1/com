document.addEventListener("DOMContentLoaded", () => {
    const courseList = document.getElementById("course-list");
    
    if (courseList) {
        document.getElementById("course-main-title").innerText = courseData.courseTitle;
        document.getElementById("course-main-desc").innerText = courseData.courseDescription;
        
        const lessons = courseData.lessons;
        
        lessons.forEach((lesson, index) => {
            let hasStarted = localStorage.getItem(`started_${lesson.id}`);
            let btnClass = hasStarted ? "play-btn continue" : "play-btn";
            let btnText = hasStarted ? "أكمل المشاهدة ⏸" : "شاهد الآن ▶";
            let progressHtml = hasStarted ? `<div class="progress-bar"><div class="progress-fill" style="width: 45%;"></div></div>` : "";

            const lessonHTML = `
                <div class="episode-card" onclick="playLesson('${lesson.id}', '${lesson.videoUrl}')">
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

function playLesson(lessonId, videoUrl) {
    localStorage.setItem(`started_${lessonId}`, "true");
    
    let btn = document.getElementById(`btn_${lessonId}`);
    if(btn) {
        btn.classList.add("continue");
        btn.innerText = "أكمل المشاهدة ⏸";
    }

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
        videoFrame.src = ""; // لإيقاف الصوت
    }
}