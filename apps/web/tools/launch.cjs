'use strict';
// The same launcher works in the workspace and the self-contained server ZIP.
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const port = Number(process.env.PORT) || 8080;
const url = `http://127.0.0.1:${port}/`;
function openBrowser() {
  if (process.argv.includes('--no-open')) return;
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] :
    process.platform === 'darwin' ? [url] : [url];
  const program = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const browser = spawn(program, args, {detached: true, stdio: 'ignore', windowsHide: true});
  browser.on('error', () => console.log(`请手动打开 ${url}`));
  browser.unref();
}
async function main() {
  try {
    const response = await fetch(url + 'health', {signal: AbortSignal.timeout(1000)});
    const health = await response.json();
    if(health.app==='tactics-card-trials'&&health.version!==require('../package.json').version){console.error(`端口 ${port} 正在运行旧服务 ${health.version}。请先关闭旧的游戏启动窗口，再启动新版 ${require('../package.json').version}。`);process.exitCode=1;return;}
    if (health.app === 'tactics-card-trials') {console.log(`游戏已在运行：${url}`); openBrowser(); return;}
  } catch { /* No compatible running server. */ }
  try {require.resolve('ws', {paths: [root]});}
  catch {
    console.log('首次启动，正在安装联机依赖……');
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev'],
      {cwd: root, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true});
    if (result.status !== 0) throw Error('依赖安装失败，请检查网络和 Node.js 安装。');
  }
  const {server} = require('../server/server.cjs');
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请关闭旧服务，或设置 PORT 后重新启动。` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, process.env.HOST||'0.0.0.0', () => {console.log(`游戏已启动：${url}\n保留此窗口即可继续游玩；关闭窗口停止服务。`); openBrowser();});
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
