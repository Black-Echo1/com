// db_helper.js
// أداة مشتركة لقراءة وحفظ anime_db.js بأمان (بدون ما تفسد بقية الملف)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DB_PATH = path.join(__dirname, "..", "anime_db.js");

function loadDatabase(dbPath = DB_PATH) {
    const raw = fs.readFileSync(dbPath, "utf8");
    const ctx = {};
    vm.createContext(ctx);
    // نحول const إلى var مؤقتاً فقط جوه الذاكرة عشان نقدر نوصل للمتغير من الخارج
    const runnable = raw.replace("const animeDetailsDatabase", "var animeDetailsDatabase");
    vm.runInContext(runnable, ctx);
    if (!ctx.animeDetailsDatabase) {
        throw new Error("تعذر إيجاد animeDetailsDatabase داخل anime_db.js");
    }
    return { data: ctx.animeDetailsDatabase, raw };
}

function saveDatabase(data, dbPath = DB_PATH) {
    const json = JSON.stringify(data, null, 4);
    const output = `const animeDetailsDatabase = ${json};\n`;
    // نسخة احتياطية قبل الحفظ فوق الملف الأصلي
    const backupPath = dbPath + ".backup-" + Date.now() + ".js";
    if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
    }
    fs.writeFileSync(dbPath, output, "utf8");
    return backupPath;
}

module.exports = { loadDatabase, saveDatabase, DB_PATH };