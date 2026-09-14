import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envDir = join(root, 'src', 'environments');

function loadEnvFile() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function escapeTsString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function writeEnvironmentFile(path, production, supabaseUrl, supabaseAnonKey) {
  const content = `export const environment = {
  production: ${production},
  supabaseUrl: '${escapeTsString(supabaseUrl)}',
  supabaseAnonKey: '${escapeTsString(supabaseAnonKey)}',
};
`;

  writeFileSync(path, content, 'utf8');
}

loadEnvFile();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables manquantes : SUPABASE_URL et/ou SUPABASE_ANON_KEY.');
  console.error('Copie .env.example vers .env et renseigne tes identifiants Supabase.');
  process.exit(1);
}

writeEnvironmentFile(join(envDir, 'environment.ts'), false, supabaseUrl, supabaseAnonKey);
writeEnvironmentFile(join(envDir, 'environment.prod.ts'), true, supabaseUrl, supabaseAnonKey);

console.log('Fichiers environment générés depuis .env / variables d\'environnement.');
