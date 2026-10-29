'use strict';
// One explicit runtime inventory serves packaging and missing-file checks.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function inventory() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'runtime.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const styles = [...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
  if (JSON.stringify(scripts) !== JSON.stringify(manifest.scripts) ||
      JSON.stringify(styles) !== JSON.stringify(manifest.styles)) throw Error('index.html and runtime.json disagree');
  const context = {window: {}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data/definitions.js'), 'utf8'), context);
  const data = context.window.GAME_DATA;
  const skills=[...Object.entries(data.skills),...Object.entries(data.skillCards),...Object.entries(data.bossSkills||{})];
  if(skills.some(([,skill])=>!skill.icon))throw Error('Every skill needs an icon');
  if(new Set(skills.map(([,skill])=>skill.icon)).size!==skills.length)throw Error('Distinct skills must have distinct icon assets');
  const assets = new Set();
  for (const card of Object.values(data.cards)) assets.add(`assets/characters/${card.image}`);
  for (const card of [...Object.values(data.skills), ...Object.values(data.skillCards), ...Object.values(data.bossSkills||{})])
    if (card.icon) assets.add(`assets/icons/${card.icon}`);
  for (const name of [...manifest.scripts, ...manifest.styles, manifest.entry]) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    for (const m of source.matchAll(/assets\/(?:characters|icons|backgrounds|audio|effects)\/[\w.-]+\.(?:webp|png|jpg|mp3)/g)) assets.add(m[0]);
  }
  const files = [manifest.entry, ...manifest.scripts, ...manifest.styles, ...[...assets].sort()];
  for (const file of [...files, ...manifest.serverFiles]) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep) || !fs.statSync(absolute).isFile()) throw Error(`Missing runtime file: ${file}`);
  }
  const diskAssets = fs.readdirSync(path.join(root, 'assets'), {recursive: true, withFileTypes: true})
    .filter(f => f.isFile()).map(f => path.relative(root, path.join(f.parentPath || f.path, f.name)).replaceAll('\\', '/'));
  const unused = diskAssets.filter(f => !assets.has(f));
  if (unused.length) throw Error(`Unreferenced runtime assets: ${unused.join(', ')}`);
  return {files, serverFiles: manifest.serverFiles, assets: assets.size,
    bytes: files.reduce((sum, name) => sum + fs.statSync(path.join(root, name)).size, 0)};
}
if (require.main === module) {
  try {
    const result = inventory();
    console.log(process.argv.includes('--json') ? JSON.stringify(result) :
      `Runtime inventory passed: ${result.files.length} files, ${result.assets} assets, ${(result.bytes / 1048576).toFixed(2)} MiB`);
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
module.exports = {inventory};
