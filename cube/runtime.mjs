import { randomBytes } from 'node:crypto';
import { copyFile, cp, mkdir, lstat, readdir, readFile, writeFile, rename, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function prepareRuntime(appDir, env = process.env) {
 if (!/^\d+$/.test(env.PORT || '') || Number(env.PORT)<1 || Number(env.PORT)>65535) throw new Error('PORT must be the port assigned by Cube (1–65535).');
 const {name} = JSON.parse(await readFile(path.join(appDir,'package.json'),'utf8'));
 if (!/^cube-agent-[a-z]+$/.test(name)) throw new Error('Invalid Cube app package identity.');
 const data = path.resolve(env.XDG_DATA_HOME || path.join(os.homedir(),'.local/share'),name);
 await mkdir(data,{recursive:true,mode:0o700});
 const secretPath=path.join(data,'auth-secret');
 try { await writeFile(secretPath,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600}); }
 catch(error) { if(error.code!=='EEXIST') throw error; }
 const secret=await readFile(secretPath,'utf8');
 if(!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid persisted authentication secret.');
 for (const name of ['data','.agent-native','media','plans']) {
  const source=path.join(appDir,name), target=path.join(data,name);
  const existing=await lstat(source).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(existing && !existing.isSymbolicLink()) {
   if(!existing.isDirectory()) throw new Error(`Cannot preserve existing ${name}: not a directory.`);
   // Vite regenerates this cache during every install, including updates.
   // Refresh only this generated file; never overwrite persisted agent state.
   if(name==='.agent-native') {
    const generated=path.join(source,'build-config.json');
    const exists=await lstat(generated).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(exists?.isFile()) {
     await mkdir(target,{recursive:true,mode:0o700});
     await copyFile(generated,path.join(target,'build-config.json'));
     await rm(generated);
    }
   }
   const files=await readdir(source);
   if(files.length) {
    const persisted=await readdir(target).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    if(persisted.length) throw new Error(`Refusing to overwrite existing persistent ${name}.`);
    await rm(target,{recursive:true,force:true});
    try { await rename(source,target); }
    catch(error) {
     if(error.code!=='EXDEV') throw error;
     await cp(source,target,{recursive:true,errorOnExist:true,force:false});
     await rm(source,{recursive:true});
    }
   } else await rm(source,{recursive:true});
  } else if(existing) {
   const {readlink}=await import('node:fs/promises');
   if(path.resolve(appDir,await readlink(source))!==target) throw new Error(`Unexpected existing ${name} symlink.`);
  }
  await mkdir(target,{recursive:true,mode:0o700});
  if(!existing?.isSymbolicLink()) await symlink(target,source,'dir');
 }
 return {...env, CUBE_APP_DATA_DIR:data, DATABASE_URL:`pglite:${path.join(data,'pglite')}`, BETTER_AUTH_SECRET:secret,
  AUTH_DISABLED:'1', SERVER_SHUTDOWN_TIMEOUT:'1', NODE_ENV:'production', HOST:'127.0.0.1', NITRO_HOST:'127.0.0.1', PORT:String(Number(env.PORT)), NITRO_PORT:String(Number(env.PORT)),
  AGENT_NATIVE_MEDIA_DIR:path.join(data,'media'),PLAN_LOCAL_DIR:path.join(data,'plans')};
}
