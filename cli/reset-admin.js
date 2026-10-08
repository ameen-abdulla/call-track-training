// SECURITY: password is never logged or written to any file in plaintext
'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

// --- bcrypt loader ---
function loadBcrypt() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'bcryptjs'),
    path.join(__dirname, 'node_modules', 'bcryptjs'),
    'bcryptjs',
  ];
  for (const c of candidates) {
    try { return require(c); } catch {}
  }
  throw new Error('bcryptjs not found');
}

// --- Config loader (reads C:\ProgramData\CallTrackTraining\config\.env) ---
const configEnvPath = process.env.CALLTRACK_ENV_FILE ||
  (process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'config', '.env')
    : 'C:\\ProgramData\\CallTrackTraining\\config\\.env');

if (fs.existsSync(configEnvPath)) {
  try {
    const content = fs.readFileSync(configEnvPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch (err) {
    // silently continue
  }
}

// --- DB path resolution ---
const defaultDbPath = process.env.PROGRAMDATA
  ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'data', 'calltrack-training.db')
  : 'C:\\ProgramData\\CallTrackTraining\\data\\calltrack-training.db';

function getDbFilePath() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) return path.resolve(dbUrl.replace(/^file:/, ''));
  return path.resolve(defaultDbPath);
}

// --- Password policy ---
function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`"']/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

// --- Arg parser ---
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { email: '', password: '', help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') { result.help = true; }
    else if (args[i].startsWith('--email=')) result.email = args[i].slice(8);
    else if (args[i] === '--email' && i + 1 < args.length) result.email = args[++i];
    else if (args[i].startsWith('--password=')) result.password = args[i].slice(11);
    else if (args[i] === '--password' && i + 1 < args.length) result.password = args[++i];
  }
  return result;
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    console.log('');
    console.log('Usage:');
    console.log('  node reset-admin.js                              (interactive - recommended)');
    console.log('  node reset-admin.js --email=E --password=P       (non-interactive)');
    console.log('');
    console.log('Interactive mode does not display the password as you type.');
    console.log('Use interactive mode to avoid credentials appearing in shell history.');
    console.log('');
    process.exit(0);
  }

  let email = args.email.trim();
  let password = args.password;
  const isInteractive = !email || !password;

  const rl = readline.createInterface({
    input: process.stdin,
    output: isInteractive ? process.stdout : null,
    terminal: isInteractive,
  });

  if (!email) {
    email = (await prompt(rl, 'Admin email address: ')).trim().toLowerCase();
  }

  if (!email || !email.includes('@')) {
    console.error('[ERROR] Invalid email address.');
    rl.close();
    process.exit(1);
  }

  if (!password) {
    // Hide password input
    process.stdout.write('New admin password: ');
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    password = await new Promise(resolve => {
      let pw = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function onData(ch) {
        const c = ch.toString();
        if (c === '\n' || c === '\r' || c === '\u0003') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdout.write('\n');
          resolve(pw);
        } else if (c === '\u007f') {
          pw = pw.slice(0, -1);
        } else {
          pw += c;
        }
      });
    });
  }

  rl.close();

  const validationError = validatePassword(password);
  if (validationError) {
    console.error('[ERROR] ' + validationError);
    process.exit(1);
  }

  const dbPath = getDbFilePath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('[reset-admin] Created database directory: ' + dbDir);
  }

  if (!fs.existsSync(dbPath)) {
    console.log('[reset-admin] WARNING: Database not found at ' + dbPath);
    console.log('[reset-admin] Run bootstrap.js --init first to initialize the database.');
    process.exit(1);
  }

  const bcrypt = loadBcrypt();
  const hash = bcrypt.hashSync(password, 10);
  password = null; // clear from memory ASAP

  const db = new DatabaseSync(dbPath);

  const existing = db.prepare('SELECT id, email, role FROM "User" WHERE lower(email) = ?').get(email.toLowerCase());
  if (existing) {
    db.prepare('UPDATE "User" SET passwordHash = ?, role = \'ADMIN\', updatedAt = datetime(\'now\') WHERE id = ?').run(hash, existing.id);
    console.log('[reset-admin] ✅ Administrator password updated for: ' + email);
  } else {
    console.error('[reset-admin] ERROR: No user found with email: ' + email);
    console.error('[reset-admin] Tip: Use bootstrap.js --init --email=... --password=... to create the initial admin.');
    db.close();
    process.exit(1);
  }

  db.close();
}

main().catch(err => {
  console.error('[reset-admin] ❌ Fatal error:', err.message);
  process.exit(1);
});
