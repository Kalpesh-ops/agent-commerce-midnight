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

// Check if direct compact command is available
try {
  execSync("compact --version", { stdio: "ignore" });
  console.log("Found local compact executable.");
  const cmd = `compact compile "${contractSrc}" "${targetDir}"`;
  console.log(`Executing: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
  compileSuccess = true;
} catch (e) {
  // Try WSL compact
  const wslSrc = toWslPath(contractSrc);
  const wslTarget = toWslPath(targetDir);
  console.log("Attempting compilation via WSL Ubuntu compact toolchain...");
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
  console.log("Compact contract compiled successfully!");
}
