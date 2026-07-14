const projectsDB = {
    // 1. مشروع مسلسل (متعدد الحلقات)
    "death_note": {
        isSeries: true, // يخبر الموقع أن هذا مسلسل
        title: "مذكرة الموت - Death Note",
        description: "شاب عبقري يعثر على مذكرة غامضة تمنحه القدرة على إنهاء حياة أي شخص.",
        episodes: [
            {
                epNumber: 1,
                title: "الحلقة 1: الولادة الجديدة",
                thumbnail: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=400&auto=format&fit=crop",
                sources: {
                    "ARABIC": {
                        "DUB": { "1080P": [ { serverName: "Drive (Black Echo)", playUrl: "رابط_الفيديو", downloadUrl: "رابط_التحميل" } ] },
                        "SUB": { "1080P": [ { serverName: "مترجم خام", playUrl: "رابط_الفيديو", downloadUrl: "رابط_التحميل" } ] }
                    }
                }
            },
            {
                epNumber: 2,
                title: "الحلقة 2: المواجهة",
                thumbnail: "https://images.unsplash.com/photo-1542451313056-b7c8e626645f?q=80&w=400&auto=format&fit=crop",
                sources: {
                    "ARABIC": {
                        "DUB": { "1080P": [ { serverName: "سيرفر الدبلجة", playUrl: "رابط_الحلقة_2", downloadUrl: "#" } ] }
                    }
                }
            }
        ]
    },

    // 2. مشروع فيلم (حلقة واحدة)
    "demon_slayer_movie": {
        isSeries: false, // يخبر الموقع أن هذا فيلم (سيخفي شريط الحلقات)
        title: "قاتل الشياطين: قطار اللانهاية",
        description: "فريق تانجيرو في مهمة على متن قطار اللانهاية.",
        episodes: [
            {
                epNumber: 1, // الفيلم يعامل كحلقة واحدة برمجياً
                title: "الفيلم كامل",
                thumbnail: "",
                sources: {
                    "ARABIC": {
                        "DUB": { "1080P": [ { serverName: "Drive 1", playUrl: "رابط_الفيلم", downloadUrl: "#" } ] }
                    }
                }
            }
        ]
    }
};