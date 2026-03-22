import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR=path.resolve(__dirname,'..','fixtures');
export const STAGE_FILES={research:'research.json',outline:'outline.txt',article:'article.txt',score:'score.json',critic:'critic.json',scoreV2:'score_v2.json',scoreV3:'score_v3.json',criticV2:'critic_v2.json',optimized:'article_optimized.txt',repaired:'article_repaired.txt',decision:'decision.json',
  finalization: 'finalization.json'};
export function slugify(k){return k.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,80);}
function fixtureDir(k){return path.join(FIXTURES_DIR,slugify(k));}
function stageFilePath(k,s){const f=STAGE_FILES[s];if(!f)throw new Error('Unknown stage: '+s);return path.join(fixtureDir(k),f);}
function serialize(s,d){const t=new Set(['outline','article','optimized','repaired']);return t.has(s)?String(d):JSON.stringify(d,null,2);}
function deserialize(s,r){const t=new Set(['outline','article','optimized','repaired']);return t.has(s)?r:JSON.parse(r);}
export function save(keyword,stage,data){const dir=fixtureDir(keyword);fs.mkdirSync(dir,{recursive:true});const fp=stageFilePath(keyword,stage);fs.writeFileSync(fp,serialize(stage,data),'utf8');console.log('[FIXTURE] saved → tests/fixtures/'+slugify(keyword)+'/'+STAGE_FILES[stage]);}
export function load(keyword,stage){const fp=stageFilePath(keyword,stage);if(!fs.existsSync(fp))throw new Error('Fixture not found: '+fp+'\nRun TEST_MODE=live first.');return deserialize(stage,fs.readFileSync(fp,'utf8'));}
export function exists(keyword,stage){return fs.existsSync(stageFilePath(keyword,stage));}
export function listFixtures(){if(!fs.existsSync(FIXTURES_DIR))return[];return fs.readdirSync(FIXTURES_DIR).filter(f=>fs.statSync(path.join(FIXTURES_DIR,f)).isDirectory()).map(slug=>({slug,files:fs.readdirSync(path.join(FIXTURES_DIR,slug))}));}
export function saveFullRun(keyword,result){const{research,outline,article,evaluation}=result;if(research)save(keyword,'research',research);if(outline)save(keyword,'outline',outline);if(article)save(keyword,'article',article);if(evaluation){if(evaluation.scoreV1)save(keyword,'score',evaluation.scoreV1);if(evaluation.critic)save(keyword,'critic',evaluation.critic);if(evaluation.decision)save(keyword,'decision',evaluation.decision);if(evaluation.scoreV2)save(keyword,'scoreV2',evaluation.scoreV2);if(evaluation.scoreV3)save(keyword,'scoreV3',evaluation.scoreV3);if(evaluation.criticV2)save(keyword,'criticV2',evaluation.criticV2);}console.log('[FIXTURE] full run saved for: "'+keyword+'"');}
