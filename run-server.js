/**
 * Call Track Training — Windows Standalone Service Entry Point
 * 
 * Binds explicitly to 127.0.0.1 (Localhost Only, Section 23)
 * Loads environment variables from C:\ProgramData\CallTrackTraining\config\.env
 * Launches the Next.js production standalone server.
 */

const fs = require('fs')
const path = require('path')

// Determine environment configuration file location
const configEnvPath = process.env.CALLTRACK_ENV_FILE ||
  (process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'config', '.env')
    : 'C:\\ProgramData\\CallTrackTraining\\config\\.env')

if (fs.existsSync(configEnvPath)) {
  try {
    const content = fs.readFileSync(configEnvPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
    console.log(`[CallTrackService] Loaded configuration from: ${configEnvPath}`)
  } catch (err) {
    console.warn(`[CallTrackService] Warning loading configuration from ${configEnvPath}:`, err.message)
  }
} else {
  console.log(`[CallTrackService] Config file not found at ${configEnvPath}, using existing process.env`)
}

// Enforce production mode
process.env.NODE_ENV = 'production'

// Section 23: Enforce 127.0.0.1 binding (Localhost Only)
process.env.HOSTNAME = '127.0.0.1'

// Section 24: Configurable port (default 4000)
process.env.PORT = process.env.PORT || process.env.CALLTRACK_PORT || '4000'

// Default database path in ProgramData if not provided
if (!process.env.DATABASE_URL) {
  const defaultDbPath = process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'data', 'calltrack-training.db')
    : 'C:\\ProgramData\\CallTrackTraining\\data\\calltrack-training.db'
  process.env.DATABASE_URL = `file:${defaultDbPath.replace(/\\/g, '/')}`
}

console.log(`[CallTrackService] Starting Call Track Training standalone server on http://127.0.0.1:${process.env.PORT}...`)

// Execute standalone server.js
require('./server.js')
