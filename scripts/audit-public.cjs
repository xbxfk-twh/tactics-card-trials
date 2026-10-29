'use strict';
// Read only Git's index, never local ignored deployment archives or credentials.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const files=git(['ls-files','--cached','-z']).toString('utf8').split('\0').filter(Boolean);
if(!files.length)throw Error('Stage the intended public files before running this audit.');
const rootFiles=new Set(['.gitignore','.gitattributes','.editorconfig','.nvmrc','README.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','SECURITY.md','AGENTS.md','requirements-build.txt','启动游戏.cmd']);
const forbidden=/(^|\/)(node_modules|server-data|dist|artifacts|\.ssh|\.venv|历史版本|开发资料|发布包)(\/|$)|\.(?:jks|keystore|pem|key|pass|p12|pfx|apk|idsig|zip|db|sqlite\d*|log)$/i;
const secrets=[
 ['private-key',/-----BEGIN (?:OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
 ['cloud-access-key',/\bAKIA[0-9A-Z]{16}\b/],
 ['api-secret',/\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/]
];
let bytes=0;const issues=[];
for(const name of files){
 if(!rootFiles.has(name)&&!['apps/web/','apps/android/','docs/','scripts/','.github/'].some(prefix=>name.startsWith(prefix)))issues.push(name+': outside public source roots');
 if(forbidden.test(name)||/(^|\/)\.env(?:\.|$)/.test(name)&&!name.endsWith('.env.example'))issues.push(name+': private/generated file');
 const body=git(['show',':'+name]);bytes+=body.length;
 if(body.length>5*1024*1024)issues.push(name+': larger than source-file budget (5 MiB)');
 if(/\.(?:png|jpg|webp|gif|mp3)$/i.test(name))continue;
 const text=body.toString('utf8');for(const [label,pattern] of secrets)if(pattern.test(text))issues.push(name+': '+label+' pattern');
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
else console.log(`Public index audit passed: ${files.length} files, ${(bytes/1048576).toFixed(2)} MiB; no private/generated paths or credential patterns.`);
