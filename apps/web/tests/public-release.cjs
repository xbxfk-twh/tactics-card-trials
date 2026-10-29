/* Explicit, read-only public artifact verification. No credentials or player mutations. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.argv[2];if(!base)throw Error('Pass the deployed game URL explicitly.');
const version=require('../package.json').version,parts=version.split('.'),oldVersion=[...parts.slice(0,2),Number(parts[2])-1].join('.'),apkName=`tactics-${version}-android.apk`;
const url=new URL(base);assert.equal(url.protocol,'https:');
const hash=body=>crypto.createHash('sha256').update(body).digest('hex');
async function get(target,options={}){let error;for(let i=0;i<3;i++){try{const response=await fetch(target,{...options,signal:AbortSignal.timeout(20000)}),body=await response.arrayBuffer();return new Response(body,{status:response.status,headers:response.headers});}catch(e){error=new Error('Public request failed: '+target,{cause:e});}}throw error;}
(async()=>{
 const health=await(await get(new URL('health',url))).json();assert.equal(health.version,version);
 const files=['index.html','js/core/engine.js','js/campaign/progress.js','js/campaign/content.js','js/ui/app.js','js/ui/card-presentation.js','js/ui/skill-audio.js','js/ui/music.js','js/ui/effects.js','css/card-presentation.css','css/campaign.css','assets/effects/kenney-particles-v1.webp'];
 for(const name of files){const response=await get(new URL(name,url));assert.equal(response.status,200);const body=Buffer.from(await response.arrayBuffer());assert.equal(hash(body),hash(fs.readFileSync(path.join(__dirname,'..',name))),name+' public/source mismatch');}
 const index=await get(url);assert.ok(index.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 console.log('Public source hashes and CSP verified');
 const old=new URL(url);old.port='8443';const redirect=await get(old,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),url.href);
 const latest=await get(new URL('download/tactics-latest-android.apk',url),{redirect:'manual'});assert.equal(latest.status,302);assert.equal(new URL(latest.headers.get('location'),url).href,new URL('download/'+apkName,url).href);
 const apk=await get(new URL('download/'+apkName,url));assert.equal(apk.status,200);assert.equal(apk.headers.get('content-type'),'application/vnd.android.package-archive');const bytes=Buffer.from(await apk.arrayBuffer());assert.equal(hash(bytes),hash(fs.readFileSync(path.join(__dirname,'../../../dist',apkName))));
 const obsoleteStatus=(await get(new URL(`download/tactics-${oldVersion}-android.apk`,url))).status;assert.ok([403,404].includes(obsoleteStatus),'obsolete APK must not be downloadable');
 assert.equal((await get(new URL('/',url))).status,200);
 const lobby=await(await get(new URL('api/lobby',url))).json();
 console.log(JSON.stringify({version:health.version,publicSourceFilesVerified:files.length,apkBytes:bytes.length,apkSha256:hash(bytes),oldGameRedirect:308,obsoleteApk:obsoleteStatus,mainWebsite:200,rooms:lobby.rooms.length},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
