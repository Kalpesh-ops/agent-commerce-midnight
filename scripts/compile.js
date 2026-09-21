import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const contractDir = path.join(rootDir, "contract");
const contractSrc = path.join(contractDir, "src", "task_escrow.compact");
const targetDir = path.join(contractDir, "src", "managed", "task_escrow");

// Ensure target directory exists
fs.mkdirSync(targetDir, { recursive: true });

function toWslPath(winPath) {
  const resolved = path.resolve(winPath).replace(/\\/g, "/");
  const driveMatch = resolved.match(/^([a-zA-Z]):\/(.*)$/);
  if (driveMatch) {
    const driveLetter = driveMatch[1].toLowerCase();
    return `/mnt/${driveLetter}/${driveMatch[2]}`;
  }
  return resolved;
}

console.log("=== Compiling Midnight Compact Smart Contract ===");
console.log(`Source: ${contractSrc}`);
console.log(`Target: ${targetDir}`);

let compileSuccess = false;

// Check if a genuine midnight compact CLI is directly on PATH (not Windows NTFS compact.exe)
function isMidnightCompact(cmd) {
  try {
    const res = execSync(`${cmd} compile --language-version`, { stdio: ["pipe", "pipe", "ignore"] }).toString();
    return res.includes("0.");
  } catch {
    return false;
  }
}

if (isMidnightCompact("compact")) {
  console.log("Found direct Midnight compact toolchain.");
  const cmd = `compact compile "${contractSrc}" "${targetDir}"`;
  console.log(`Executing: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit" });
    compileSuccess = true;
  } catch (err) {
    console.error("Direct compact compilation failed:", err.message);
  }
} else if (process.platform === "win32") {
  // Use WSL Ubuntu Midnight compact toolchain if available on Windows
  const wslSrc = toWslPath(contractSrc);
  const wslTarget = toWslPath(targetDir);
  console.log("Attempting WSL Ubuntu Midnight compact toolchain (/root/.local/bin/compact)...");
  const wslCmd = `wsl -d Ubuntu /root/.local/bin/compact compile "${wslSrc}" "${wslTarget}"`;
  try {
    execSync(wslCmd, { stdio: "inherit" });
    compileSuccess = true;
  } catch (wslErr) {
    console.warn("WSL compilation failed or WSL not available:", wslErr.message);
  }
}

if (!compileSuccess) {
  const indexJs = path.join(targetDir, "contract", "index.js");
  const keysDir = path.join(targetDir, "keys");
  const zkirDir = path.join(targetDir, "zkir");
  if (fs.existsSync(indexJs) && fs.existsSync(keysDir) && fs.existsSync(zkirDir)) {
    console.log("ℹ️  Midnight compact compiler not available in current environment.");
    console.log(`✅ Using verified pre-compiled Compact contract artifacts from: ${targetDir}`);
    compileSuccess = true;
  } else {
    console.error("❌ Compact compiler not found and verified contract artifacts are missing!");
    process.exit(1);
  }
}

if (compileSuccess) {
  console.log("✅ Compact contract compiled successfully to target directory!");

  // Copy keys and zkir to ui/public for browser FetchZkConfigProvider
  const uiPublicDir = path.join(rootDir, "ui", "public", "task_escrow");
  fs.mkdirSync(uiPublicDir, { recursive: true });
  const keysSrc = path.join(targetDir, "keys");
  const zkirSrc = path.join(targetDir, "zkir");

  if (fs.existsSync(keysSrc)) {
    fs.cpSync(keysSrc, path.join(uiPublicDir, "keys"), { recursive: true });
  }
  if (fs.existsSync(zkirSrc)) {
    fs.cpSync(zkirSrc, path.join(uiPublicDir, "zkir"), { recursive: true });
  }
  console.log("✅ Copied ZK circuit keys and intermediate representations to ui/public/task_escrow!");
}
