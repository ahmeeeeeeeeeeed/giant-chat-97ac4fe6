#!/usr/bin/env node
// Sets the app version to 1.0.<GITHUB_RUN_NUMBER> so every CI build has a
// unique, monotonically increasing version code without needing to commit
// package.json back to the repo. The exact value baked into the APK is the
// same one shown to admins in the Admin → Updates page (APP_VERSION), so
// they can copy it verbatim when uploading the APK row.
//
// Local invocation: falls back to a patch bump.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2] || "patch"; // patch | minor | major
const pkgPath = resolve("package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = (pkg.version || "1.0.0").split(".").map((n) => parseInt(n, 10) || 0);
let [maj, min, pat] = current;

const run = parseInt(process.env.APP_VERSION_PATCH || process.env.GITHUB_RUN_NUMBER || "", 10);
if (Number.isFinite(run) && run > 0) {
  // Stable scheme on CI: 1.<MINOR>.<RUN_NUMBER>, keep current major/minor.
  pat = run;
} else if (mode === "major") { maj++; min = 0; pat = 0; }
else if (mode === "minor") { min++; pat = 0; }
else { pat++; }

const next = `${maj}.${min}.${pat}`;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`[bump-version] ${current.join(".")} → ${next}`);
process.stdout.write(`VERSION=${next}\n`);
