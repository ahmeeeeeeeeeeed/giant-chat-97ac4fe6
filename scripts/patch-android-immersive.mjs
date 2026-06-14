#!/usr/bin/env node
// Patches MainActivity.java to hide the Android navigation bar (3-button bar)
// using immersive sticky mode, while keeping the top status bar visible.
// Swipe from the bottom edge temporarily reveals the nav bar.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const javaRoot = resolve("android/app/src/main/java");
if (!existsSync(javaRoot)) {
  console.log("[patch-android-immersive] java root not found — skipping.");
  process.exit(0);
}

function findMainActivity(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      const r = findMainActivity(p);
      if (r) return r;
    } else if (entry === "MainActivity.java") {
      return p;
    }
  }
  return null;
}

const file = findMainActivity(javaRoot);
if (!file) {
  console.log("[patch-android-immersive] MainActivity.java not found — skipping.");
  process.exit(0);
}

let src = readFileSync(file, "utf8");

if (src.includes("// IMMERSIVE_NAV_PATCH")) {
  console.log("[patch-android-immersive] already patched.");
  process.exit(0);
}

// Ensure required imports
const imports = [
  "import android.os.Bundle;",
  "import android.view.View;",
  "import android.view.WindowInsets;",
  "import android.view.WindowInsetsController;",
  "import android.os.Build;",
];
for (const imp of imports) {
  if (!src.includes(imp)) {
    src = src.replace(/(package [^\n]+;\n)/, `$1\n${imp}\n`);
  }
}

// Inject onCreate override (or extend existing)
const injection = `
  // IMMERSIVE_NAV_PATCH — hide navigation bar only, keep status bar visible
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    hideNavigationBar();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideNavigationBar();
  }

  private void hideNavigationBar() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      WindowInsetsController c = getWindow().getInsetsController();
      if (c != null) {
        c.hide(WindowInsets.Type.navigationBars());
        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      );
    }
  }
`;

// Insert before the last closing brace of the class
src = src.replace(/\n\}\s*$/, `\n${injection}\n}\n`);

writeFileSync(file, src);
console.log(`[patch-android-immersive] patched ${file}`);
