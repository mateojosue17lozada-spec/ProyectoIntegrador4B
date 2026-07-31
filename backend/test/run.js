const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const suite = process.argv[2] || "unit";
const patterns = {
    unit: fs.readdirSync(path.join(__dirname, "unit")).filter((file) => file.endsWith(".test.js")).map((file) => path.join("test", "unit", file)),
    auth: ["test/unit/auth-security.test.js"],
    integration: fs.readdirSync(path.join(__dirname, "integration")).filter((file) => file.endsWith(".test.js")).map((file) => path.join("test", "integration", file))
};
if (!patterns[suite]) throw new Error(`Suite desconocida: ${suite}`);
const result = spawnSync(process.execPath, ["--test", ...patterns[suite]], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit"
});
process.exit(result.status ?? 1);
