import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
async function checkDirectory(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) await checkDirectory(filename);
    else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', join(root, filename)], { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
      console.log(`Syntax OK: ${filename}`);
    }
  }
}

for (const directory of ['dist', 'scripts', 'tests']) await checkDirectory(directory);
for (const filename of ['package.json', 'package-lock.json', 'config/backend.example.json']) {
  JSON.parse(await readFile(join(root, filename), 'utf8'));
  console.log(`JSON OK: ${filename}`);
}
