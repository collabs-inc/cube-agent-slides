import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { prepareRuntime } from './runtime.mjs';
const appDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(appDir);
const {name}=JSON.parse(await readFile(path.join(appDir,'package.json'),'utf8'));
const config=path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(),'.local/share'),name,'config.env');
if(existsSync(config)) process.loadEnvFile(config);
Object.assign(process.env,await prepareRuntime(appDir));
// Cube closes PTYs with SIGHUP before SIGTERM; use the server's drain path.
process.once('SIGHUP', () => process.kill(process.pid, 'SIGTERM'));
await import(pathToFileURL(path.join(appDir,'.output/server/index.mjs')).href);
