const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("la matriz contiene exactamente los requisitos 1 a 44", () => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../../../scripts/check-matrix.js")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"rows":44/);
});
