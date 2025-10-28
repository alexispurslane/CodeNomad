#!/usr/bin/env bun

import { $ } from "bun"
import { existsSync } from "fs"
import { join } from "path"

const appDir = join(import.meta.dir, "..")
$.cwd(appDir)

const platforms = {
  mac: {
    args: ["--mac", "--x64", "--arm64", "--universal"],
    description: "macOS (Intel, Apple Silicon, Universal)",
  },
  "mac-x64": {
    args: ["--mac", "--x64"],
    description: "macOS (Intel only)",
  },
  "mac-arm64": {
    args: ["--mac", "--arm64"],
    description: "macOS (Apple Silicon only)",
  },
  win: {
    args: ["--win", "--x64"],
    description: "Windows (x64)",
  },
  "win-arm64": {
    args: ["--win", "--arm64"],
    description: "Windows (ARM64)",
  },
  linux: {
    args: ["--linux", "--x64"],
    description: "Linux (x64)",
  },
  "linux-arm64": {
    args: ["--linux", "--arm64"],
    description: "Linux (ARM64)",
  },
  all: {
    args: ["--mac", "--win", "--linux", "--x64", "--arm64"],
    description: "All platforms (macOS, Windows, Linux)",
  },
}

async function build(platform: string) {
  const config = platforms[platform as keyof typeof platforms]

  if (!config) {
    console.error(`❌ Unknown platform: ${platform}`)
    console.error(`\nAvailable platforms:`)
    for (const [name, cfg] of Object.entries(platforms)) {
      console.error(`  - ${name.padEnd(12)} : ${cfg.description}`)
    }
    process.exit(1)
  }

  console.log(`\n🔨 Building for: ${config.description}\n`)

  try {
    console.log("📦 Step 1/2: Building Electron app...\n")
    await $`bun run build`

    console.log("\n📦 Step 2/2: Packaging binaries...\n")
    const distExists = existsSync(join(appDir, "dist"))
    if (!distExists) {
      throw new Error("dist/ directory not found. Build failed.")
    }

    await $`bunx electron-builder ${config.args}`

    console.log("\n✅ Build complete!")
    console.log(`📁 Binaries available in: release/\n`)
  } catch (error) {
    console.error("\n❌ Build failed:", error)
    process.exit(1)
  }
}

const platform = process.argv[2] || "mac"

console.log(`
╔════════════════════════════════════════╗
║   OpenCode Client - Binary Builder    ║
╚════════════════════════════════════════╝
`)

await build(platform)
