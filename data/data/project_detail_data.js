const projectDetailData = {
    title: "فيلم قاتل الشياطين: قطار اللانهاية (مدبلج)",
    cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop",
    description: "بعد فحص طبي دقيق، ينطلق تانجيرو ورفاقه في مهمة جديدة على متن قطار اللانهاية الغامض لمساعدة هاشيرا اللهب 'كيوجورو رينغوكو'.",
    
    // هيكل الروابط المتشعب والذكي
    mediaSources: {
        "ARABIC": {
            "DUB": { // قسم الدبلجة العربية
                "1080P": [
                    { serverName: "CR2", playUrl: "https://dood.to/e/رابط_تشغيل_عربي_دبلجة_1080", downloadUrl: "https://drive.google.com/uc?export=download&id=ID_جوجل_درايف" },
                    { serverName: "STP", playUrl: "https://streamtape.com/e/رابط_تشغيل_عربي_دبلجة_1080", downloadUrl: "https://streamtape.com/d/رابط_تحميل" }
                ],
                "720P": [
                    { serverName: "CR2", playUrl: "https://dood.to/e/رابط_تشغيل_عربي_دبلجة_720", downloadUrl: "https://drive.google.com/uc?export=download&id=ID_جوجل_درايف" },
                    { serverName: "KKFP", playUrl: "https://example.com/play_720", downloadUrl: "https://example.com/dl_720" }
                ],
                "360P": [
                    { serverName: "MDF", playUrl: "https://example.com/play_360", downloadUrl: "https://example.com/dl_360" }
                ]
            },
            "SUB": { // قسم الترجمة العربية
                "1080P": [
                    { serverName: "CR2", playUrl: "https://dood.to/e/رابط_مترجم_1080", downloadUrl: "https://drive.google.com/uc?export=download&id=ID_مترجم_1080" }
                ]
            }
        },
        "ENGLISH": {
            "SUB": { // قسم الترجمة الإنجليزية
                "1080P": [
                    { serverName: "STP", playUrl: "https://streamtape.com/e/رابط_انكليزي_مترجم", downloadUrl: "https://streamtape.com/d/تحميل" }
                ]
            }
        }
    }
};