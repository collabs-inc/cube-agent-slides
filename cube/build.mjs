import {mkdtemp,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const temporary=await mkdtemp(path.join(os.tmpdir(),'cube-app-build-'));
try {
 const result=spawnSync(path.resolve('node_modules/.bin/agent-native'),['build'],{stdio:'inherit',env:{...process.env,NITRO_PRESET:'node-server',CUBE_APP_DATA_DIR:temporary,DATABASE_URL:`pglite:${temporary}/pglite`,BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),AUTH_DISABLED:'1'}});
 if(result.error) throw result.error;
 process.exitCode=result.status ?? 1;
} finally { await rm(temporary,{recursive:true,force:true}); }
