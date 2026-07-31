const fs = require("node:fs");
const path = require("node:path");

const matrixPath = path.resolve(__dirname, "..", "MATRIZ_CUMPLIMIENTO.md");
const text = fs.readFileSync(matrixPath, "utf8");
const ids = [...text.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((match) => Number(match[1]));
const counts = new Map(ids.map((id) => [id, (ids.filter((value) => value === id).length)]));
const duplicates = [...counts].filter(([, count]) => count > 1).map(([id]) => id);
const missing = Array.from({ length: 44 }, (_, index) => index + 1).filter((id) => !counts.has(id));
const outside = ids.filter((id) => id < 1 || id > 44);

if (ids.length !== 44 || duplicates.length || missing.length || outside.length) {
    console.error(JSON.stringify({ valid: false, rows: ids.length, duplicates, missing, outside }));
    process.exit(1);
}

console.log(JSON.stringify({ valid: true, rows: ids.length, range: "1-44" }));
