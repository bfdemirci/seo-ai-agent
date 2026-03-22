import path from 'path';
import {fileURLToPath} from 'url';
import * as fixture from './fixtureManager.js';
import * as log from './logger.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
export const TEST_MODE=(process.env.TEST_MODE||'fixture').toLowerCase();
export const KEYWORD=process.env.KEYWORD||process.argv[2]||'seo nedir';
const results=[];
export async function loadStage(keyword,stage,liveRunner){
  if(TEST_MODE==='fixture'){log.info('loading fixture','['+stage+']');return fixture.load(keyword,stage);}
  log.info('running live','['+stage+']');const t0=Date.now();const result=await liveRunner();
  log.info(stage+' done',log.duration(Date.now()-t0));fixture.save(keyword,stage,result);return result;
}
export function assert(name,condition,detail=''){const ok=Boolean(condition);results.push({name,ok,note:detail});if(ok)log.pass(name,detail);else log.fail(name,detail);return ok;}
export const assertGte=(n,a,e)=>assert(n,Number(a)>=Number(e),a+' >= '+e);
export const assertGt=(n,a,e)=>assert(n,Number(a)>Number(e),a+' > '+e);
export const assertHasKey=(n,o,k)=>assert(n,o&&typeof o==='object'&&k in o,(k in (o||{}))?'has "'+k+'"':'missing "'+k+'"');
export const assertNonEmpty=(n,v)=>assert(n,v!=null&&String(v).trim().length>0,'non-empty');
export function assertScoreNotDegraded(name,v1,v2){const ok=Number(v2)>=Number(v1);log.score(name,v1,v2);results.push({name,ok,note:v1+' -> '+v2});if(!ok)log.fail(name+' degraded');return ok;}
export function assertScoreImproved(name,v1,v2){const ok=Number(v2)>Number(v1);log.score(name,v1,v2);results.push({name,ok,note:v1+' -> '+v2});if(!ok)log.fail(name+' not improved');return ok;}
export function resolveAgent(rel){return path.resolve(__dirname,'..','..','src',rel);}
export async function importAgent(rel){return import(resolveAgent(rel));}
export async function run(title,fn){
  log.header(title);log.mode(TEST_MODE);log.info('keyword','"'+KEYWORD+'"');
  results.length=0;const t0=Date.now();
  try{await fn({keyword:KEYWORD,mode:TEST_MODE,loadStage});}
  catch(err){log.fail('UNHANDLED ERROR',err.message);results.push({name:'no-unhandled-error',ok:false,note:err.message});if(process.env.DEBUG)console.error(err);}
  const ok=log.summary([...results]);log.info('total duration',log.duration(Date.now()-t0));process.exit(ok?0:1);
}
