import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load and override environment variables from .env so .env takes precedence
// over any system environment variables (useful for local development).
try {
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    console.log(`Loading .env from ${envPath}`);
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    for (const k of Object.keys(parsed)) {
       // override process.env
       process.env[k] = parsed[k];
    }
  } else {
    console.log('.env file not found');
  }
} catch (e) {
  console.error('Error loading .env', e);
}
