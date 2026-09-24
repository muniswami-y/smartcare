import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function verify() {
  const i18nDir = path.resolve(__dirname, '../src/i18n');
  const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
  const te = JSON.parse(fs.readFileSync(path.join(i18nDir, 'te.json'), 'utf8'));
  const hi = JSON.parse(fs.readFileSync(path.join(i18nDir, 'hi.json'), 'utf8'));

  const enKeys = new Set(getKeys(en));
  const teKeys = new Set(getKeys(te));
  const hiKeys = new Set(getKeys(hi));

  let hasError = false;

  for (const key of enKeys) {
    if (!teKeys.has(key)) {
      console.error(`Missing Telugu key: ${key}`);
      hasError = true;
    }
    if (!hiKeys.has(key)) {
      console.error(`Missing Hindi key: ${key}`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error('FAIL: i18n validation failed! Missing translation keys detected.');
    process.exit(1);
  }

  console.log(`SUCCESS: i18n validation passed! All ${enKeys.size} keys verified across English, Telugu, and Hindi.`);
}

verify();
