#!/usr/bin/env node
/**
 * ai-safe-env CLI
 * 
 * Commands:
 *   init                  Initialize encrypted store for current project
 *   set <key> <value>     Store a secret
 *   remove <key>          Remove a secret
 *   list                  List secret keys (not values)
 *   migrate               Convert existing .env to safe format
 *   run -- <command>      Run command with secrets injected
 */

const { initStore, setSecret, removeSecret, listSecrets, migrate, config, promptPassword } = require('./index');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const cmd = args[0];
const projectDir = process.cwd();

async function getPassword() {
  return process.env.ASE_PASSWORD || await promptPassword('Master password: ');
}

async function main() {
  switch (cmd) {
    case 'init': {
      const pw = await getPassword();
      initStore(projectDir, pw);
      console.log('✅ Store initialized for this project');
      break;
    }
    case 'set': {
      if (args.length < 3) { console.error('Usage: ai-safe-env set <key> <value>'); process.exit(1); }
      const pw = await getPassword();
      setSecret(projectDir, pw, args[1], args[2]);
      console.log(`✅ Secret "${args[1]}" stored`);
      break;
    }
    case 'remove': {
      if (args.length < 2) { console.error('Usage: ai-safe-env remove <key>'); process.exit(1); }
      const pw = await getPassword();
      removeSecret(projectDir, pw, args[1]);
      console.log(`✅ Secret "${args[1]}" removed`);
      break;
    }
    case 'list': {
      const pw = await getPassword();
      const keys = listSecrets(projectDir, pw);
      if (keys.length === 0) { console.log('(no secrets stored)'); }
      else { keys.forEach(k => console.log(`  ${k}`)); }
      break;
    }
    case 'migrate': {
      const pw = await getPassword();
      const count = migrate(projectDir, pw);
      console.log(`✅ Migrated ${count} env vars. Original backed up to .env.backup`);
      break;
    }
    case 'run': {
      const sep = args.indexOf('--');
      if (sep === -1 || sep === args.length - 1) {
        console.error('Usage: ai-safe-env run -- <command>');
        process.exit(1);
      }
      const pw = await getPassword();
      const { parsed } = config({ password: pw, noInject: true });
      const command = args.slice(sep + 1).join(' ');
      try {
        execSync(command, {
          stdio: 'inherit',
          env: { ...process.env, ...parsed }
        });
      } catch (e) {
        process.exit(e.status || 1);
      }
      break;
    }
    default:
      console.log(`ai-safe-env - Protect .env secrets from AI coding tools

Commands:
  init              Initialize encrypted store for current project
  set <key> <val>   Store a secret  
  remove <key>      Remove a secret
  list              List secret keys
  migrate           Convert existing .env → safe format (auto-encrypts all values)
  run -- <cmd>      Run command with secrets injected

Environment:
  ASE_PASSWORD      Master password (avoids interactive prompt)

Example:
  ai-safe-env init
  ai-safe-env set database_url "postgres://user:pass@localhost/db"
  # Edit .env: DATABASE_URL=ase://database_url
  ai-safe-env run -- node server.js`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
