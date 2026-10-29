'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/network/online.js'),'utf8');
function endpoint(href,saved){const context={window:{},URL,location:new URL(href),localStorage:{getItem:()=>saved||null}};vm.runInNewContext(source,context);return new context.window.WebSocketOnlineClient(()=>{}).endpoint();}
assert.equal(endpoint('https://example.com/tactics/'),'wss://example.com/tactics/ws');
assert.equal(endpoint('https://example.com/tactics/index.html?room=123'),'wss://example.com/tactics/ws');
assert.equal(endpoint('http://localhost:8080/'),'ws://localhost:8080/ws');
assert.equal(endpoint('file:///C:/game/index.html'),'ws://127.0.0.1:8080/ws');
assert.equal(endpoint('https://example.com/tactics/','https://other.example/play'),'wss://other.example/play/ws');
assert.equal(endpoint('https://guyuyizhang.top/tactics/'),'wss://guyuyizhang.top/tactics/ws');
console.log('Default and saved WebSocket endpoints preserve reverse-proxy paths');
