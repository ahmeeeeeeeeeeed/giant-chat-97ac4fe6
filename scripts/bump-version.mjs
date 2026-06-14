#!/usr/bin/env node
// Auto-bumps the patch version on every CI build, so each APK has a higher
// versionCode/versionName than the previous one. Writes the bumped version
// back to package.json. Run BEFORE `npm run build` so the value is bundled
// into src/lib/version.ts (which imports package.json).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2] || "patch"; // patch | minor | major
const pkgPath = resolve("package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = (pkg.version || "1.0.0").split(".").map((n) => parseInt(n, 10) || 0);
let [maj, min, pat] = current;
if (mode === "major") { maj++; min = 0; pat = 0; }
else if (mode === "minor") { min++; pat = 0; }
else { pat++; }
const next = `${maj}.${min}.${pat}`;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`[bump-version] ${current.join(".")} → ${next}`);
// Print for downstream steps (e.g. GitHub Actions outputs).
process.stdout.write(`VERSION=${next}\n`);
