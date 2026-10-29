/* Historical 0.8.7 stage-seven tuning comparison. No production state is changed. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{play}=require('./solo-balance.test.cjs');
const variants=['spell','drain','guard','bulwark','blood','frost'];
const groups=[
 ['original-seven',7,{enemyStats:{knight:[100,21,6],mage:[80,19,2],ranger:[70,18,2]}}],
 ['adjusted-seven',7,{enemyStats:{knight:[100,21,6],mage:[72,18,2],ranger:[64,17,2]}}],
 ['unchanged-eight',8,{enemyStats:{berserker:[100,21,3],ranger:[75,18,2],treant_small:[80,17,3]}}]
];
const results=groups.flatMap(([group,n,probe])=>variants.map(v=>({group,...play(n,true,v,true,probe)})));
console.table(results);
const wins=group=>results.filter(r=>r.group===group&&r.win).length;
assert.equal(wins('original-seven'),1);assert.equal(wins('adjusted-seven'),2);assert.equal(wins('unchanged-eight'),2);
if(process.argv.includes('--report'))fs.writeFileSync(path.join(__dirname,'../../../artifacts/balance/独行战役087-第7关小调对照.json'),JSON.stringify({version:'0.8.7',scope:'Fixed legal build local AI probe, not human win rates',results},null,2)+'\n');
console.log('Stage-seven minimal tuning comparison passed');
