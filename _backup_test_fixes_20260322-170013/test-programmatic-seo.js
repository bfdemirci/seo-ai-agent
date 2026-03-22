
import 'dotenv/config';
import { generateKeywords, runProgrammaticSeoCampaign } from '../../src/services/programmatic/programmaticSeoService.js';
import { createArticleRecord, listArticles, getArticleById } from '../../src/repositories/articleRepository.js';
var pass=0,fail=0;
function check(l,v){if(v){console.log('  ✓ PASS',l);pass++;}else{console.log('  ✗ FAIL',l);fail++;}}
function fakeWriterSuccess({keyword}){var id=createArticleRecord({keyword,article:'<h1>Test</h1>',outline:'#o',research:{},evaluation:{},finalization:{}});return Promise.resolve({keyword,article:'<h1>Test</h1>',outline:'#o',research:{},evaluation:{articleId:id}});}
function fakeWriterFail(){throw new Error('mock writer fail');}
console.log('\n─'.repeat(60)+'\n  Programmatic SEO Test\n'+'─'.repeat(60));
console.log('\n▶ 1. generateKeywords');
var kws=generateKeywords({baseKeyword:'en iyi oteller',locations:['istanbul','ankara','izmir'],modifiers:['2026','fiyatlari','yorumlar'],limit:50});
check('returns array',Array.isArray(kws));check('not empty',kws.length>0);check('respects limit',kws.length<=50);
check('max possible (3x3=9)',kws.length===9);check('first keyword correct',kws[0]==='istanbul en iyi oteller 2026');
check('contains ankara',kws.some(k=>k.includes('ankara')));
console.log('\n▶ 2. No duplicates');
var seen={};var dupes=kws.filter(k=>{if(seen[k])return true;seen[k]=true;return false;});
check('no duplicates',dupes.length===0);
console.log('\n▶ 3. Limit enforced');
var kws2=generateKeywords({baseKeyword:'laptop',locations:['istanbul','ankara','izmir','bursa','antalya'],modifiers:['2026','ucuz','iyi','karsilastirma','inceleme'],limit:7});
check('limit=7 respected',kws2.length===7);
console.log('\n▶ 4. Edge cases');
var kws3=generateKeywords({baseKeyword:'seo nedir',limit:5});
check('no locations ok',kws3.length>=1);check('base keyword present',kws3.some(k=>k.includes('seo nedir')));
check('empty base ok',Array.isArray(generateKeywords({baseKeyword:'',limit:5})));
console.log('\n▶ 5. safeMode=true campaign (mock)');
var result=await runProgrammaticSeoCampaign({baseKeyword:'test keyword',locations:['sehir1','sehir2'],modifiers:['mod1'],safeMode:true},{writerFn:fakeWriterSuccess});
check('ok true',result.ok===true);check('totalGenerated 2',result.totalGenerated===2);check('items array',Array.isArray(result.items));
check('items length 2',result.items.length===2);check('created >= 1',result.created>=1);
check('has totalGenerated','totalGenerated' in result);check('has created','created' in result);check('has published','published' in result);check('has failed','failed' in result);
console.log('\n▶ 6. safeMode=true no publish');
check('published 0 in safeMode',result.published===0);
console.log('\n▶ 7. Items shape');
var ok0=result.items.filter(it=>it.ok);check('has ok items',ok0.length>0);
check('item has keyword',typeof ok0[0].keyword==='string');check('item has articleId',typeof ok0[0].articleId==='string');
check('item ok true',ok0[0].ok===true);check('item error null',ok0[0].error===null);
console.log('\n▶ 8. Articles saved to repo');
var bc=listArticles({limit:999999}).length;
var r2=await runProgrammaticSeoCampaign({baseKeyword:'repo test',locations:['city1','city2'],modifiers:['mx'],safeMode:true},{writerFn:fakeWriterSuccess});
check('repo grew',listArticles({limit:999999}).length>=bc+r2.created);check('repo grew by created',r2.created>=0);
console.log('\n▶ 9. programmatic_created event');
var ok2=r2.items.filter(it=>it.ok);check('has ok items',ok2.length>0);
if(ok2.length>0){var rec=getArticleById(ok2[0].articleId);var evts=(rec&&rec.meta&&rec.meta.events)||[];var pg=evts.find(e=>e.type==='programmatic_created');check('event exists',pg!==undefined);check('event has keyword',pg&&pg.keyword===ok2[0].keyword);}
else{check('event exists',false);check('event has keyword',false);}
console.log('\n▶ 10. Partial failure continues');
var fc=0;var mixed=function(o){fc++;if(fc===1)return fakeWriterFail();return fakeWriterSuccess(o);};
var r3=await runProgrammaticSeoCampaign({baseKeyword:'partial',locations:['a','b'],modifiers:['x'],safeMode:true},{writerFn:mixed});
check('campaign still ok',r3.ok===true);check('items length 2',r3.items.length===2);check('one failed',r3.failed===1);
check('one created',r3.created===1);check('failed ok false',r3.items[0].ok===false);check('failed error set',typeof r3.items[0].error==='string');check('success ok true',r3.items[1].ok===true);
console.log('\n▶ 11. safeMode=false');
var oc=0,pc=0;
var r4=await runProgrammaticSeoCampaign({baseKeyword:'safefalse',locations:['x'],modifiers:['y'],safeMode:false},{writerFn:fakeWriterSuccess,optimizeFn:async()=>{oc++;return{ok:true};},publishFn:async()=>{pc++;return{ok:true,skipped:false};}});
check('no crash',r4.ok===true);check('created>=1',r4.created>=1);check('optimizeFn called',oc>=1);check('publishFn called',pc>=1);check('published>=1',r4.published>=1);
console.log('\n▶ 12. Return contract');
['ok','totalGenerated','created','published','failed','items'].forEach(k=>check('has '+k,k in r4));
console.log('\n'+'─'.repeat(60)+'\n  SUMMARY\n'+'─'.repeat(60));
console.log('  '+pass+' passed  '+fail+' failed');
if(fail>0)process.exit(1);
