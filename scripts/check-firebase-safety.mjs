import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_MARKERS = [
  ['shortener', '59c85'].join('-'),
  ['AIzaSyDpw9KkgPdBmrjsdx8dI8gTG1UbRJNj', 'by8'].join(''),
];
const SCAN_DIRECTORIES = ['src', 'functions/src', 'tests', 'e2e', 'scripts'];

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

export function checkFirebaseSafety(root) {
  const failures = [];
  const packagePath = join(root, 'package.json');
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
      if (
        name.startsWith('test:') &&
        typeof command === 'string' &&
        command.includes('firebase emulators:') &&
        !command.includes('--project demo-shortener')
      ) {
        failures.push(`O script ${name} inicia emuladores sem --project demo-shortener.`);
      }
    }
  }

  for (const directory of SCAN_DIRECTORIES) {
    for (const path of filesUnder(join(root, directory))) {
      if (!/\.(?:ts|tsx|js|mjs|json|yml|yaml)$/.test(path)) continue;
      if (path === fileURLToPath(import.meta.url)) continue;
      const contents = readFileSync(path, 'utf8');
      for (const marker of PRODUCTION_MARKERS) {
        if (contents.includes(marker)) {
          failures.push(`${relative(root, path)} contém identificador real proibido: ${marker}`);
        }
      }
    }
  }

  const ignorePath = join(root, '.gitignore');
  if (existsSync(ignorePath)) {
    const ignore = readFileSync(ignorePath, 'utf8');
    for (const pattern of ['.env.local', '.env.*.local']) {
      if (!ignore.includes(pattern)) failures.push(`.gitignore não protege ${pattern}.`);
    }
  }

  const matrixPath = join(root, 'docs', 'security-matrix.md');
  if (existsSync(matrixPath)) {
    const matrix = readFileSync(matrixPath, 'utf8');
    for (let index = 1; index <= 15; index += 1) {
      const criterion = `CA-${String(index).padStart(2, '0')}`;
      if (!new RegExp(`\\|\\s*${criterion}\\s*\\|`).test(matrix)) {
        failures.push(`${criterion} não está na matriz.`);
      }
    }
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkFirebaseSafety(process.cwd());
  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Segurança Firebase OK: testes isolados em demo e matriz CA-01–CA-15 completa.');
  }
}
