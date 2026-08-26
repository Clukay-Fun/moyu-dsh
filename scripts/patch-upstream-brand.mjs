// Idempotent upstream DSH -> MOYU brand cleanup for the running runtime closure.
// Run AFTER apply-codex-web-overlay (and after build:dsh-runtime on a real build).
// Only touches user-visible DSH *product* branding; never the DeepSeek provider/model names.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Patch BOTH the runtime closure and the dev node_modules tree: the running
// app (dev/launch) loads plugins from node_modules, while a packaged build
// loads from build/dsh-runtime. Both must carry the MOYU brand.
const roots = [
  path.resolve(__dirname, "../node_modules/@deepseek-ai"),
  path.resolve(__dirname, "../build/dsh-runtime/node_modules/@deepseek-ai"),
];

function patchFile(rel, fn) {
  let changedHere = false;
  for (const root of roots) {
    const f = path.join(root, rel);
    if (!fs.existsSync(f)) continue;
    const before = fs.readFileSync(f, "utf8");
    const after = fn(before);
    if (after !== before) {
      fs.writeFileSync(f, after);
      changedHere = true;
    }
  }
  return changedHere;
}

let changed = 0;

// 1. Document title + manifest (dsh-web-frontend dist)
changed += patchFile("dsh-web-frontend/dist/index.html", (t) =>
  t.replace("<title>DeepSeek Harness</title>", "<title>MOYU</title>")
);
changed += patchFile("dsh-web-frontend/dist/manifest.webmanifest", (t) =>
  t.replace(/"name":\s*"DeepSeek Harness"/g, '"name": "MOYU"')
   .replace(/"short_name":\s*"DeepSeek Harness"/g, '"short_name": "MOYU"')
);

// 2. Welcome-notice (first-launch internal-testing notice): blank copy AND
//    deregister the onboarding step so the modal never mounts in MOYU.
changed += patchFile("dsh-client-ui-settings-models/lib/client.js", (t) =>
  t
    .replace(/title:\s*"内测声明"/g, 'title: ""')
    .replace(/title:\s*"Internal Testing Notice"/g, 'title: ""')
    .replace(/body:\s*"DeepSeek Harness 目前的 0\.1 版本[^"]*"/g, 'body: ""')
    .replace(/body:\s*"DeepSeek Harness 0\.1 remains[^"]*"/g, 'body: ""')
    .replace(/ctx\.slots\.inject\("settings\.onboarding",\s*\(\s*\)\s*=>\s*ctx\.slots\.register\(\{\s*name:\s*"settings\.onboarding",\s*id:\s*"welcome-notice"[\s\S]*?WelcomeNotice\)\);/g, "/* MOYU: 内测声明弹窗已移除 */")
);

// 3. Tool/env description referencing the DSH Web GUI
changed += patchFile("dsh-web-app/lib/index.js", (t) =>
  t.replace(/DeepSeek Harness Web GUI/g, "MOYU")
   .replace(/Serve the DeepSeek Harness browser UI\./g, "Serve the MOYU desktop app.")
);

// 4. Renderer product title (window title + about fallback)
changed += patchFile("dsh-client-ui-renderer/lib/client.js", (t) =>
  t.replace(/const productTitle = "DeepSeek Harness";/, 'const productTitle = "MOYU";')
);

console.log(changed > 0 ? `upstream brand patch applied (${changed} file(s) changed)` : "upstream brand already clean");
