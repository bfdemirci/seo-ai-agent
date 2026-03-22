const C={reset:'\x1b[0m',bold:'\x1b[1m',green:'\x1b[32m',red:'\x1b[31m',yellow:'\x1b[33m',cyan:'\x1b[36m',blue:'\x1b[34m',gray:'\x1b[90m',magenta:'\x1b[35m'};
export const c=(col,str)=>C[col]+str+C.reset;
export const header=(t)=>{const l='\u2500'.repeat(60);console.log('\n'+c('cyan',l)+'\n'+c('bold','  '+t)+'\n'+c('cyan',l));};
export const section=(t)=>console.log('\n'+c('blue','\u25b6 '+t));
export const pass=(l,d)=>console.log(c('green','  \u2713 PASS')+' '+l+(d?c('gray','  '+d):''));
export const fail=(l,d)=>console.log(c('red','  \u2717 FAIL')+' '+l+(d?c('gray','  '+d):''));
export const warn=(l,d)=>console.log(c('yellow','  \u26a0 WARN')+' '+l+(d?c('gray','  '+d):''));
export const info=(l,v)=>console.log(c('gray','  \u2192')+' '+l+' '+c('cyan',String(v===undefined?'':v)));
export const duration=(ms)=>ms<1000?ms+'ms':+(ms/1000).toFixed(1)+'s';
export function score(label,v1,v2){
  if(v2===undefined){info(label,v1);return;}
  const d=v2-v1,col=d>0?'green':d<0?'red':'gray';
  console.log(c('gray','  \u2192')+' '+label+': '+c('cyan',String(v1))+' \u2192 '+c('cyan',String(v2))+' '+c(col,(d>=0?'+':'')+d));
}
export function summary(results){
  const passed=results.filter(function(r){return r.ok;}).length;
  const failed=results.filter(function(r){return !r.ok;}).length;
  console.log('\n'+c('cyan','\u2500'.repeat(60))+'\n'+c('bold','  SUMMARY')+'\n'+c('cyan','\u2500'.repeat(60)));
  results.forEach(function(r){
    console.log('  '+(r.ok?c('green','\u2713'):c('red','\u2717'))+' '+r.name+(r.note?c('gray','  ('+r.note+')'):''));
  });
  console.log('');
  if(failed===0)console.log(c('green',c('bold','  All '+results.length+' checks passed')));
  else console.log(c('green','  '+passed+' passed')+'  '+c('red',failed+' failed'));
  console.log('');
  return failed===0;
}
export const mode=(m)=>console.log(m==='live'?c('yellow','[LIVE MODE]')+' \u2014 real API calls, saving fixtures':c('magenta','[FIXTURE MODE]')+' \u2014 no API calls\n');
