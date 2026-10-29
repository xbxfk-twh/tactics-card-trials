"""Build a signed, universal Android APK using official SDK tools (no Gradle cache)."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent / 'web'
OUT = ROOT.parents[1] / 'dist'
VERSION = '0.8.13'


def run(args, **kwargs):
    subprocess.run([str(v) for v in args], check=True, **kwargs)


def sha256(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def build():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sdk', type=Path, default=Path(os.environ.get('ANDROID_SDK_ROOT', str(Path(os.environ['LOCALAPPDATA']) / 'TacticsBuild/android-sdk'))))
    args = parser.parse_args()
    sdk = args.sdk.resolve()
    platforms = list((sdk / 'platforms/android-35').rglob('android.jar'))
    tools = list((sdk / 'build-tools/35.0.0').rglob('aapt2.exe'))
    if len(platforms) != 1 or len(tools) != 1:
        raise SystemExit('Install official Android platform 35 and Build Tools 35.0.0; see README.md.')
    android = platforms[0]
    tool = tools[0].parent
    java = Path(shutil.which('java') or '')
    javac = Path(shutil.which('javac') or '')
    keytool = java.with_name('keytool.exe')
    if not javac.is_file() or not keytool.is_file():
        raise SystemExit('A JDK is required on PATH.')
    inventory = json.loads(subprocess.check_output(['node', str(GAME / 'tools/check-assets.cjs'), '--json'], cwd=GAME, encoding='utf-8'))
    signing = Path(os.environ['LOCALAPPDATA']) / 'TacticsBuild/signing'
    signing.mkdir(parents=True, exist_ok=True)
    keystore, password_file = signing / 'tactics-release-v1.jks', signing / 'tactics-release-v1.pass'
    if keystore.exists() != password_file.exists():
        raise SystemExit('Signing key/password pair incomplete. Restore it before building updates.')
    if not keystore.exists():
        password_file.write_text(secrets.token_urlsafe(40), encoding='utf-8')
    signing_env = dict(os.environ, TACTICS_SIGNING_PASSWORD=password_file.read_text(encoding='utf-8'))
    if not keystore.exists():
        run([keytool, '-genkeypair', '-keystore', keystore, '-alias', 'tactics', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Tactics Game,O=Guyu,C=CN', '-storepass:env', 'TACTICS_SIGNING_PASSWORD', '-keypass:env', 'TACTICS_SIGNING_PASSWORD', '-noprompt'], env=signing_env)
    OUT.mkdir(exist_ok=True)
    final = OUT / f'tactics-{VERSION}-android.apk'
    with tempfile.TemporaryDirectory(prefix='tactics-apk-') as temp:
        stage = Path(temp)
        assets, classes, dex = stage / 'assets', stage / 'classes', stage / 'dex'
        for folder in (assets / 'game', classes, dex):
            folder.mkdir(parents=True)
        for name in inventory['files']:
            target = assets / 'game' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(GAME / name, target)
        (assets / 'game-files.txt').write_text('\n'.join(inventory['files']) + '\n', encoding='utf-8')
        resources = stage / 'res'
        shutil.copytree(ROOT / 'res', resources)
        (resources / 'drawable').mkdir()
        icon = Image.open(GAME / 'assets/icons/star-rank-v1.webp').convert('RGBA')
        icon.thumbnail((152, 152), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (192, 192), '#EDF3EB')
        canvas.alpha_composite(icon, ((192-icon.width)//2, (192-icon.height)//2))
        canvas.save(resources / 'drawable/app_icon.png')
        run([tool / 'aapt2.exe', 'compile', '--dir', resources, '-o', stage / 'resources.zip'])
        run([tool / 'aapt2.exe', 'link', '-I', android, '--manifest', ROOT / 'AndroidManifest.xml', '-A', assets, '-o', stage / 'unsigned.apk', stage / 'resources.zip'])
        run([javac, '--release', '8', '-encoding', 'UTF-8', '-classpath', android, '-d', classes, *sorted((ROOT / 'src').rglob('*.java'))])
        run([java, '-cp', tool / 'lib/d8.jar', 'com.android.tools.r8.D8', '--min-api', '26', '--lib', android, '--output', dex, *sorted(classes.rglob('*.class'))])
        with ZipFile(stage / 'unsigned.apk', 'a', ZIP_DEFLATED) as archive:
            for file in dex.glob('*.dex'):
                archive.write(file, file.name)
        run([tool / 'zipalign.exe', '-f', '-p', '4', stage / 'unsigned.apk', stage / 'aligned.apk'])
        run([java, '-jar', tool / 'lib/apksigner.jar', 'sign', '--ks', keystore, '--ks-key-alias', 'tactics', '--ks-pass', 'env:TACTICS_SIGNING_PASSWORD', '--key-pass', 'env:TACTICS_SIGNING_PASSWORD', '--out', final, stage / 'aligned.apk'], env=signing_env)
        run([java, '-jar', tool / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs', final])
        run([tool / 'zipalign.exe', '-c', '-p', '4', final])
        with ZipFile(final) as archive:
            names = archive.namelist()
            assert len(names) == len(set(names))
            assert archive.testzip() is None
            assert 'classes.dex' in names and 'AndroidManifest.xml' in names
            for name in inventory['files']:
                assert archive.read('assets/game/' + name) == (GAME / name).read_bytes(), name
            assert not any(name.endswith(('.jks', '.pass', '.pem', '.cjs')) for name in names)
    report = {'version': VERSION, 'package': 'top.guyuyizhang.tactics', 'minAndroid': '8.0', 'targetSdk': 35,
              'apk': final.name, 'bytes': final.stat().st_size, 'sha256': sha256(final),
              'gameFiles': len(inventory['files']), 'bundledGameBytes': inventory['bytes'],
              'server': 'wss://guyuyizhang.top/tactics/ws',
              'sourceHashes': {str(p.relative_to(ROOT)).replace('\\', '/'): sha256(p) for p in [ROOT / 'AndroidManifest.xml', *sorted((ROOT / 'src').rglob('*.java'))]},
              'validation': ['APK signatures verified', 'ZIP alignment verified', 'All bundled game files byte-identical to H5'],
              'deviceTested': False}
    (OUT / f'tactics-{VERSION}-android.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
