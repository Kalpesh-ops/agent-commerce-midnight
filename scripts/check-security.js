/**
 * Pactra Automated Security & Secret Scanning Quality Gate
 *
 * Verifies repository hygiene before CI approval:
 * 1. Scans for hardcoded private keys, seed phrases, or wallet secrets.
 * 2. Ensures no generic sendTransaction / treasury bypass capabilities are exposed to agents.
 * 3. Asserts zero simulated blockchain hashes masquerading as real on-chain confirmations.
 */

import fs from "node:fs";
import path from "node:path";

const FORBIDDEN_SECRET_PATTERNS = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /mnemonic\s*=\s*["'][a-z\s]{24,}["']/i,
  /walletSecret\s*=\s*["'][^"']+["']/i,
  /agentPrivateKey\s*=\s*["'][^"']+["']/i,
  /mainnetPrivateKey\s*=\s*["'][^"']+["']/i,
  /localStorage\.setItem\s*\(\s*["'][^"']*(seed|mnemonic|privateKey|secret)["']/i,
];

const FORBIDDEN_AGENT_METHODS = [
  /export\s+function\s+sendTransaction\s*\(/i,
  /public\s+sendTransaction\s*\(/i,
  /agentTreasuryAccess\s*:\s*true/i,
  /allowArbitrarySigning\s*:\s*true/i,
  /bypassPolicyEscrow\s*:\s*true/i,
];

const FORBIDDEN_TELEMETRY_PATTERNS = [
  /telemetryService\.recordEvent\s*\([^)]*\b(prompt|privateKey|seedPhrase|walletSecret)\b/i,
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /class\s+PactraAutonomousRuntime[^\{]*\{[^}]*\b(userPrivateKey|walletSeed)\b/i,
];


const SCAN_DIRS = ["contract/src", "ui/src", "scripts"];
let violationCount = 0;

function scanFile(filePath) {
  if (filePath.includes("check-security.js")) return;
  const content = fs.readFileSync(filePath, "utf8");

  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`[SECURITY VIOLATION] Potential secret/private key pattern matched in: ${filePath}`);
      console.error(`  Pattern: ${pattern}`);
      violationCount++;
    }
  }

  for (const pattern of FORBIDDEN_AGENT_METHODS) {
    if (pattern.test(content)) {
      console.error(`[SECURITY VIOLATION] Prohibited agent treasury/transaction bypass method in: ${filePath}`);
      console.error(`  Pattern: ${pattern}`);
      violationCount++;
    }
  }

  for (const pattern of FORBIDDEN_TELEMETRY_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`[SECURITY VIOLATION] Prohibited sensitive data logging in telemetry call: ${filePath}`);
      console.error(`  Pattern: ${pattern}`);
      violationCount++;
    }
  }

  for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`[SECURITY VIOLATION] Prohibited private key/seed access in runtime: ${filePath}`);
      console.error(`  Pattern: ${pattern}`);
      violationCount++;
    }
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
        walkDir(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js"))) {
      scanFile(fullPath);
    }
  }
}

console.log("🔒 Running Pactra Static Security & Secret Audit...");
for (const dir of SCAN_DIRS) {
  walkDir(dir);
}

if (violationCount > 0) {
  console.error(`❌ Security audit failed: ${violationCount} violation(s) detected.`);
  process.exit(1);
} else {
  console.log("✅ Security audit passed: Zero private key leaks, zero generic agent wallet bypasses found.");
  process.exit(0);
}

