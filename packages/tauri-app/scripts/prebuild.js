#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(root, "..", "..");
const serverRoot = path.resolve(root, "..", "server");
const dest = path.resolve(root, "src-tauri", "resources", "server");

const sources = ["dist", "public", "node_modules", "package.json"];

function ensureServerBuild() {
  const distPath = path.join(serverRoot, "dist");
  const publicPath = path.join(serverRoot, "public");
  if (fs.existsSync(distPath) && fs.existsSync(publicPath)) {
    return;
  }

  console.log("[prebuild] server build missing; running workspace build...");
  execSync("npm --workspace @neuralnomads/codenomad run build", {
    cwd: workspaceRoot,
    stdio: "inherit",
  });

  if (!fs.existsSync(distPath) || !fs.existsSync(publicPath)) {
    throw new Error("[prebuild] server artifacts still missing after build");
  }
}

ensureServerBuild();

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

for (const name of sources) {
  const from = path.join(serverRoot, name);
  const to = path.join(dest, name);
  if (!fs.existsSync(from)) {
    console.warn(`[prebuild] skipped missing ${from}`);
    continue;
  }
  fs.cpSync(from, to, { recursive: true });
  console.log(`[prebuild] copied ${from} -> ${to}`);
}
