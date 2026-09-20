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
  execSync(cmd, { stdio: "inherit" });
  compileSuccess = true;
} else {
  // Use WSL Ubuntu Midnight compact toolchain
  const wslSrc = toWslPath(contractSrc);
  const wslTarget = toWslPath(targetDir);
  console.log("Using WSL Ubuntu Midnight compact toolchain (/root/.local/bin/compact)...");
  const wslCmd = `wsl -d Ubuntu /root/.local/bin/compact compile "${wslSrc}" "${wslTarget}"`;
  console.log(`Executing: ${wslCmd}`);
  try {
    execSync(wslCmd, { stdio: "inherit" });
    compileSuccess = true;
  } catch (wslErr) {
    console.error("WSL compilation failed:", wslErr.message);
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
