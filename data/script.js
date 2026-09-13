(() => {
    'use strict';

    const ENABLE_ADS = false;
    const invalidLink = (value) => {
        if (!value || typeof value !== 'string') return true;
        const normalized = value.trim();
        return !normalized || normalized.includes('ضع_هنا') || normalized.includes('رابط_التضمين_هنا') || normalized.startsWith('/https://');
    };
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
    const lazyImage = (url, alt) => `<img src="${escapeHtml(url || 'icon-512.png')}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
    const driveLink = (value) => {
        if (invalidLink(value)) return '';
        return /^https?:\/\//i.test(value) ? value : `https://drive.google.com/uc?export=download&id=${encodeURIComponent(value)}`;
    };

    document.addEventListener('DOMContentLoaded', () => {
        const grid = document.getElementById('video-grid');
        if (grid && typeof videosData !== 'undefined') {
            const category = grid.getAttribute('data-category');
            const videos = videosData[category] || [];
            grid.innerHTML = videos.map((video, index) => {
                const withSubs = driveLink(video.downloadWithSubsId || video.downloadWithSubsid);
                const noSubs = driveLink(video.downloadNoSubsId || video.downloadNoSubsid);
                const buttons = [
                    withSubs ? `<a href="${escapeHtml(withSubs)}" class="download-btn btn-subs" target="_blank" rel="noopener noreferrer">تحميل (مترجم)</a>` : '',
                    noSubs ? `<a href="${escapeHtml(noSubs)}" class="download-btn btn-no-subs" target="_blank" rel="noopener noreferrer">تحميل (خام)</a>` : ''
                ].filter(Boolean).join('');
                return `
                    <article class="video-card">
                        <div class="smart-thumbnail" role="button" tabindex="0" onclick="triggerAdAndPlay('${escapeHtml(category)}', ${index}, 'training')" onkeydown="if(event.key==='Enter') triggerAdAndPlay('${escapeHtml(category)}', ${index}, 'training')">
                            ${lazyImage(video.thumbnail, video.title)}
                            <div class="play-overlay"><i class="fa-solid fa-play"></i><span>تشغيل المشهد</span></div>
                        </div>
                        <h3>${escapeHtml(video.title)}</h3>
                        <div class="download-buttons-holder">${buttons || '<span class="no-source-msg">لا توجد روابط تحميل متاحة حالياً</span>'}</div>
                    </article>`;
            }).join('');
        }

        const compGrid = document.getElementById('competition-grid');
        if (compGrid && typeof competitionData !== 'undefined') {
            const title = document.getElementById('comp-week-title');
            if (title) title.textContent = competitionData.weekTitle || 'مسابقة هذا الأسبوع';
            compGrid.innerHTML = (competitionData.participants || []).map((participant, index) => {
                const hasVoted = Boolean(localStorage.getItem(`voted_for_${participant.id}`));
                const currentVotes = Number(participant.initialVotes || 0) + (hasVoted ? 1 : 0);
                return `
                    <article class="video-card comp-card">
                        <div class="smart-thumbnail" role="button" tabindex="0" onclick="playCompVideo(${index})">
                            ${lazyImage(participant.thumbnail, participant.name)}
                            <div class="play-overlay"><i class="fa-solid fa-play"></i><span>مشاهدة الأداء</span></div>
                        </div>
                        <h3>${escapeHtml(participant.name)}</h3>
                        <div class="vote-section">
                            <span class="vote-count" id="count_${escapeHtml(participant.id)}">${currentVotes} صوت</span>
                            <button class="${hasVoted ? 'vote-btn voted' : 'vote-btn'}" id="btn_${escapeHtml(participant.id)}" onclick="castVote('${escapeHtml(participant.id)}', ${currentVotes})">${hasVoted ? 'تم التصويت ✔' : 'صوّت الآن'}</button>
                        </div>
                    </article>`;
            }).join('');
        }

        const courseList = document.getElementById('course-list');
        if (courseList && typeof courseData !== 'undefined') {
            const title = document.getElementById('course-main-title');
            const description = document.getElementById('course-main-desc');
            if (title) title.textContent = courseData.courseTitle || '';
            if (description) description.textContent = courseData.courseDescription || '';
            courseList.innerHTML = (courseData.lessons || []).map((lesson, index) => {
                const hasStarted = Boolean(localStorage.getItem(`started_${lesson.id}`));
                return `<article class="episode-card" onclick="playLesson('${escapeHtml(lesson.id)}', '${escapeHtml(lesson.videoUrl)}', ${index})">
                    <div class="ep-thumbnail">${lazyImage(lesson.thumbnail, lesson.title)}<span class="ep-time">${escapeHtml(lesson.duration)}</span></div>
                    <div class="ep-info"><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.description)}</p>${hasStarted ? '<div class="progress-bar"><div class="progress-fill" style="width:45%"></div></div>' : ''}</div>
                    <div class="ep-action"><button class="play-btn${hasStarted ? ' continue' : ''}" id="btn_${escapeHtml(lesson.id)}">${hasStarted ? 'أكمل المشاهدة ⏸' : 'شاهد الآن ▶'}</button></div>
                </article>`;
            }).join('');
        }
    });

    window.playCompVideo = function (index) {
        const modal = document.getElementById('videoModal');
        const frame = document.getElementById('mainVideoFrame');
        const tabs = document.getElementById('server-tabs');
        const participant = typeof competitionData !== 'undefined' ? competitionData.participants?.[index] : null;
        if (tabs) tabs.style.display = 'none';
        if (modal && frame && participant && !invalidLink(participant.videoUrl)) {
            frame.src = participant.videoUrl;
            frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
            frame.setAttribute('allowfullscreen', 'true');
            modal.style.display = 'flex';
        }
    };

    window.castVote = function (participantId, currentVotes) {
        if (localStorage.getItem('voted_this_week')) {
            alert('لقد قمت بالتصويت بالفعل في مسابقة هذا الأسبوع! لا يمكن التصويت مرتين.');
            return;
        }
        localStorage.setItem('voted_this_week', 'true');
        localStorage.setItem(`voted_for_${participantId}`, 'true');
        const button = document.getElementById(`btn_${participantId}`);
        const count = document.getElementById(`count_${participantId}`);
        if (button) { button.classList.add('voted'); button.textContent = 'تم التصويت ✔'; }
        if (count) count.textContent = `${Number(currentVotes) + 1} صوت`;
        alert('تم تسجيل صوتك بنجاح! شكراً لمشاركتك.');
    };

    let currentCategory = '';
    let currentIndex = null;
    window.triggerAdAndPlay = function (category, index) {
        currentCategory = category;
        currentIndex = index;
        if (ENABLE_ADS) return;
        window.openVideo();
    };

    window.openVideo = function () {
        const modal = document.getElementById('videoModal');
        const serverContainer = document.getElementById('server-tabs');
        const frame = document.getElementById('mainVideoFrame');
        const video = typeof videosData !== 'undefined' ? videosData[currentCategory]?.[currentIndex] : null;
        if (!modal || !serverContainer || !frame || !video) return;
        serverContainer.innerHTML = '';
        serverContainer.style.display = 'flex';
        const servers = Object.entries(video.servers || {}).filter(([, url]) => !invalidLink(url));
        if (!servers.length) {
            serverContainer.innerHTML = '<span class="no-source-msg">لا توجد خوادم تشغيل متاحة حالياً.</span>';
            return;
        }
        let firstUrl = '';
        servers.forEach(([name, url], index) => {
            if (!firstUrl) firstUrl = url;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `server-btn${index === 0 ? ' active' : ''}`;
            button.textContent = name;
            button.addEventListener('click', () => {
                frame.src = url;
                serverContainer.querySelectorAll('.server-btn').forEach((node) => node.classList.remove('active'));
                button.classList.add('active');
            });
            serverContainer.appendChild(button);
        });
        frame.src = firstUrl;
        frame.setAttribute('allow', 'autoplay; fullscreen');
        modal.style.display = 'flex';
    };

    window.closeVideo = function () {
        const modal = document.getElementById('videoModal');
        const frame = document.getElementById('mainVideoFrame');
        if (modal) modal.style.display = 'none';
        if (frame) frame.src = '';
    };

    window.playLesson = function (lessonId, videoUrl) {
        localStorage.setItem(`started_${lessonId}`, 'true');
        const button = document.getElementById(`btn_${lessonId}`);
        if (button) { button.classList.add('continue'); button.textContent = 'أكمل المشاهدة ⏸'; }
        const modal = document.getElementById('videoModal');
        const frame = document.getElementById('mainVideoFrame');
        const tabs = document.getElementById('server-tabs');
        if (tabs) tabs.style.display = 'none';
        if (modal && frame && !invalidLink(videoUrl)) {
            frame.src = videoUrl;
            frame.setAttribute('allow', 'autoplay; fullscreen');
            modal.style.display = 'flex';
        }
    };
})();
