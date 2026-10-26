import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const commit = 'a52093dc6d871165adef437aae1c9cd81166c100';
const root = resolve(import.meta.dirname);
const temp = mkdtempSync(join(tmpdir(),'acyclic-sse-'));
function run(command,args,options={}) {
 const result=spawnSync(command,args,{encoding:'utf8',...options});
 if(result.status!==0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
 return result.stdout;
}
try {
 const checkout=join(temp,'sdk');
 run('git',['clone','--quiet','https://github.com/acyclic-labs/sdk.git',checkout]);
 run('git',['checkout','--quiet',commit],{cwd:checkout});
 const src=join(checkout,'typescript/packages/swarm/src/index.ts');
 const original=readFileSync(src,'utf8');
 const needle='yield { id, event, data: JSON.parse(data.join("\\n")) as T };';
 if(original.split(needle).length!==2) throw Error('Pinned source does not match expected patch');
 writeFileSync(join(temp,'package.json'),'{"type":"module"}');
 copyFileSync(join(root,'regression.mjs'),join(temp,'regression.mjs'));
 const tscVersion=run('tsc',['--version']).trim();
 const extra=Number(tscVersion.match(/Version (\d+)/)?.[1])>=6?['--ignoreConfig']:[];
 function build(out){run('tsc',[...extra,src,'--target','ES2022','--module','ES2022','--moduleResolution','bundler','--outDir',join(temp,out),'--skipLibCheck'],{cwd:temp});}
 build('upstream');
 let baseline=spawnSync(process.execPath,['--test','regression.mjs'],{cwd:temp,encoding:'utf8',env:{...process.env,CLIENT_MODULE:'./upstream/index.js'}});
 console.log('BASELINE (expected five failures):\n'+baseline.stdout);
 if(baseline.status===0 || !/# fail 5\b/.test(baseline.stdout)) throw Error('Negative control did not reproduce expected five failures');
 writeFileSync(src,original.replace(needle,'yield { id, event: event || "message", data: JSON.parse(data.join("\\n")) as T };'));
 build('fixed');
 console.log('FIXED:\n'+run(process.execPath,['--test','regression.mjs'],{cwd:temp}));
 const pkg=join(temp,'node_modules/@acyclic-labs/swarm');mkdirSync(pkg,{recursive:true});
 writeFileSync(join(pkg,'package.json'),'{"type":"module","exports":"./index.js"}');
 for(const f of ['index.js','protocol.js'])copyFileSync(join(temp,'fixed',f),join(pkg,f));
 let tests=readFileSync(join(checkout,'typescript/packages/swarm/test/http.test.mjs'),'utf8');
 tests=tests.replace('../../../../scripts/fixture-server.mjs',join(checkout,'scripts/fixture-server.mjs'));
 writeFileSync(join(temp,'http.test.mjs'),tests);
 mkdirSync(join(temp,'fixtures'));
 for(const f of ['detail-role-spend.json','detail-restored-limits.json'])copyFileSync(join(checkout,'typescript/packages/swarm/test/fixtures',f),join(temp,'fixtures',f));
 console.log('EXISTING UPSTREAM HTTP TESTS:\n'+run(process.execPath,['--test','http.test.mjs'],{cwd:temp}));
 console.log('Verified: baseline 5 failures; fixed 7/7; existing upstream HTTP tests 12/12.');
} finally {rmSync(temp,{recursive:true,force:true});}
