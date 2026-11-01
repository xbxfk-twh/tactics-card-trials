"""Assemble the current DOM-based H5 candidate, not a Canvas minigame or APK."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
OUTPUT = REPO / 'dist/taptap-h5'


def build():
    inventory = json.loads(subprocess.check_output(['node', str(ROOT / 'tools/check-assets.cjs'), '--json'], cwd=ROOT, encoding='utf-8'))
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    files = [*inventory['files'], 'js/network/tap-host-entry.js', 'css/tap-host.css']
    # Never recursively delete a previous output. Refuse unexpected or linked files instead.
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assert not OUTPUT.is_symlink() and OUTPUT.resolve() == OUTPUT.absolute()
    for file in OUTPUT.rglob('*'):
        assert not file.is_symlink(), 'Linked output file'
        if file.is_file():
            assert file.relative_to(OUTPUT).as_posix() in files, 'Unexpected output; use an empty dist/taptap-h5 directory'
    for relative in files:
        source, target = ROOT / relative, OUTPUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert html.count('<script src="js/ui/app.js"></script>') == 1
    html = html.replace('<title>战棋 · 卡牌试炼</title>', '<title>战棋试炼</title>')
    html = html.replace('</head>', '  <link rel="stylesheet" href="css/tap-host.css">\n</head>')
    html = html.replace('<script src="js/ui/app.js"></script>', '<script src="js/network/tap-host-entry.js"></script>')
    (OUTPUT / 'index.html').write_text(html, encoding='utf-8', newline='\n')
    archive_path = REPO / 'dist' / f'tactics-{version}-taptap-h5.zip'
    hashes = {}
    with ZipFile(archive_path, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in sorted(files):
            content = (OUTPUT / relative).read_bytes()
            entry = ZipInfo(relative, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, content, compresslevel=9)
            hashes[relative] = hashlib.sha256(content).hexdigest()
    report = {'version': version, 'kind': 'taptap-h5-candidate', 'appId': 945715,
              'entry': 'index.html', 'files': len(files), 'bytes': archive_path.stat().st_size,
              'sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
              'server': 'wss://guyuyizhang.top/tactics/ws', 'ads': 'not-integrated',
              'account': 'native-host-authorization-only; guest room identity; local saves',
              'deviceTested': False, 'uploaded': False, 'hashes': hashes}
    (REPO / 'dist/taptap-h5-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'hashes'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
