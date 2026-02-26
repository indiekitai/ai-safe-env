# ai-safe-env

**Protect .env secrets from AI coding tools.** Zero-dependency Node.js alternative to [enveil](https://github.com/GreatScott/enveil).

AI tools like Claude Code, Cursor, and Copilot can read your `.env` files. `ai-safe-env` ensures plaintext secrets never exist on disk — your `.env` contains only symbolic references, and real values live in an AES-256-GCM encrypted local store.

## Why not enveil?

enveil is great but requires Rust/cargo. `ai-safe-env` is a **single `npm install`** with zero dependencies (uses Node.js built-in `crypto`). Drop-in replacement for `dotenv`.

## Quick Start

```bash
npm install -g ai-safe-env

# In your project:
ai-safe-env init
ai-safe-env set database_url "postgres://user:pass@localhost/db"
ai-safe-env set stripe_key "sk_live_..."
```

Edit your `.env`:
```
DATABASE_URL=ase://database_url
STRIPE_KEY=ase://stripe_key
PORT=3000
```

Use in your app (replaces `require('dotenv').config()`):
```js
require('ai-safe-env').config({ password: process.env.ASE_PASSWORD });
// process.env.DATABASE_URL is now the real value
```

Or run commands directly:
```bash
ai-safe-env run -- node server.js
```

## Migrate existing .env

```bash
ai-safe-env migrate
# Encrypts all values, rewrites .env with ase:// references
# Original saved as .env.backup
```

## How It Works

1. Secrets stored in `~/.ai-safe-env/<project-hash>.enc` (AES-256-GCM, scrypt key derivation)
2. `.env` file contains only `ase://key_name` references — safe for AI tools to read
3. At runtime, references are resolved from the encrypted store and injected into `process.env`

## Security

- AES-256-GCM encryption with scrypt key derivation (N=16384, r=8, p=1)
- Fresh random salt (16 bytes) and IV (12 bytes) on every write
- Authentication tag prevents tampering
- Store file is indistinguishable from random data without the password

## License

MIT
