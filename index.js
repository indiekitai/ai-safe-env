/**
 * ai-safe-env - Protect .env secrets from AI coding tools
 * 
 * Unlike enveil (Rust/cargo), this is a zero-dependency Node.js solution.
 * Your .env file contains only references like `ase://key_name`.
 * Real values live in an AES-256-GCM encrypted store (~/.ai-safe-env/<project>.enc).
 * 
 * Usage:
 *   const { config } = require('ai-safe-env');
 *   config({ password: process.env.ASE_PASSWORD });
 *   // or interactively: config() will prompt for password
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STORE_DIR = path.join(require('os').homedir(), '.ai-safe-env');
const PREFIX = 'ase://';

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

function getStoreFile(projectDir) {
  const name = crypto.createHash('sha256').update(projectDir).digest('hex').slice(0, 16);
  return path.join(STORE_DIR, `${name}.enc`);
}

function encryptStore(data, password) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decryptStore(buf, password) {
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const encrypted = buf.subarray(44);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function promptPassword(prompt = 'Master password: ') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write(prompt);
    rl.question('', (answer) => { rl.close(); resolve(answer); });
  });
}

/**
 * Load .env, resolve ase:// references from encrypted store, inject into process.env
 */
function config(options = {}) {
  const projectDir = options.path ? path.dirname(options.path) : process.cwd();
  const envPath = options.path || path.join(projectDir, '.env');
  const env = readEnvFile(envPath);
  const storeFile = getStoreFile(projectDir);
  
  let secrets = {};
  const needsStore = Object.values(env).some(v => v.startsWith(PREFIX));
  
  if (needsStore && fs.existsSync(storeFile)) {
    const password = options.password || process.env.ASE_PASSWORD;
    if (!password) {
      throw new Error('ai-safe-env: password required. Set ASE_PASSWORD env var or pass { password }');
    }
    const buf = fs.readFileSync(storeFile);
    secrets = decryptStore(buf, password);
  }
  
  const resolved = {};
  for (const [key, val] of Object.entries(env)) {
    if (val.startsWith(PREFIX)) {
      const secretKey = val.slice(PREFIX.length);
      if (!(secretKey in secrets)) {
        throw new Error(`ai-safe-env: secret "${secretKey}" not found in store. Run: ai-safe-env set ${secretKey}`);
      }
      resolved[key] = secrets[secretKey];
    } else {
      resolved[key] = val;
    }
    if (!options.noInject) {
      process.env[key] = resolved[key];
    }
  }
  
  return { parsed: resolved };
}

// Store management
function initStore(projectDir, password) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const storeFile = getStoreFile(projectDir);
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, encryptStore({}, password));
  }
}

function setSecret(projectDir, password, key, value) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const storeFile = getStoreFile(projectDir);
  let secrets = {};
  if (fs.existsSync(storeFile)) {
    secrets = decryptStore(fs.readFileSync(storeFile), password);
  }
  secrets[key] = value;
  fs.writeFileSync(storeFile, encryptStore(secrets, password));
}

function removeSecret(projectDir, password, key) {
  const storeFile = getStoreFile(projectDir);
  if (!fs.existsSync(storeFile)) return;
  const secrets = decryptStore(fs.readFileSync(storeFile), password);
  delete secrets[key];
  fs.writeFileSync(storeFile, encryptStore(secrets, password));
}

function listSecrets(projectDir, password) {
  const storeFile = getStoreFile(projectDir);
  if (!fs.existsSync(storeFile)) return [];
  const secrets = decryptStore(fs.readFileSync(storeFile), password);
  return Object.keys(secrets);
}

/**
 * Convert existing .env to safe format (replace values with ase:// refs)
 */
function migrate(projectDir, password) {
  const envPath = path.join(projectDir, '.env');
  const env = readEnvFile(envPath);
  fs.mkdirSync(STORE_DIR, { recursive: true });
  
  const lines = [];
  for (const [key, val] of Object.entries(env)) {
    if (val && !val.startsWith(PREFIX)) {
      const secretKey = key.toLowerCase();
      setSecret(projectDir, password, secretKey, val);
      lines.push(`${key}=${PREFIX}${secretKey}`);
    } else {
      lines.push(`${key}=${val}`);
    }
  }
  
  // Backup original
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, envPath + '.backup');
  }
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
  return lines.length;
}

module.exports = { config, initStore, setSecret, removeSecret, listSecrets, migrate, promptPassword };
