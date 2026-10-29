"""Inspect the official CC0 Kenney archive and build a small runtime texture atlas."""
from pathlib import Path
import io
import zipfile
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / 'artifacts/source-assets/kenney-particles'
OUT.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(OUT/'official-particle-pack.zip') as pack:
    pngs = [name for name in pack.namelist() if name.lower().endswith('.png') and name.startswith('PNG (Transparent)/') and '/Rotated/' not in name]
    print('\n'.join(pngs), flush=True)
    for name in pack.namelist():
        if 'license' in name.lower() and name.lower().endswith('.txt'):
            (OUT/'License.txt').write_bytes(pack.read(name))
    # A contact sheet lets selection follow the actual source art.
    tiles=[]
    for name in pngs:
        data=pack.read(name); target=OUT/Path(name).name;target.write_bytes(data)
        art=Image.open(io.BytesIO(data)).convert('RGBA');art.thumbnail((84,84))
        tile=Image.new('RGB',(120,110),'#26363b');tile.paste(art,((120-art.width)//2,0),art);ImageDraw.Draw(tile).text((4,88),Path(name).stem,fill='white');tiles.append(tile)
    sheet=Image.new('RGB',(120*8,110*((len(tiles)+7)//8)),'#26363b')
    for n,tile in enumerate(tiles):sheet.paste(tile,((n%8)*120,(n//8)*110))
    sheet.save(OUT/'contact-sheet.jpg')
    print('Imported',len(tiles),'source textures; see contact-sheet.jpg',flush=True)

frames=['smoke_07.png','fire_02.png','trace_01.png','star_07.png','slash_02.png','smoke_10.png','light_02.png','fire_01.png']
atlas=Image.new('RGBA',(512,256))
for n,name in enumerate(frames):
    tile=Image.open(OUT/name).convert('RGBA').resize((128,128),Image.Resampling.LANCZOS)
    atlas.alpha_composite(tile,((n%4)*128,(n//4)*128))
target=ROOT/'assets/effects/kenney-particles-v1.webp';target.parent.mkdir(exist_ok=True)
atlas.save(target,'WEBP',quality=92,method=6)
(OUT/'provenance.json').write_text(json.dumps({'author':'Kenney','license':'CC0 1.0','source':'https://kenney.nl/assets/particle-pack','archiveSha256':hashlib.sha256((OUT/'official-particle-pack.zip').read_bytes()).hexdigest(),'frames':frames,'runtimeBytes':target.stat().st_size},indent=2)+'\n',encoding='utf-8')
print('Runtime atlas bytes',target.stat().st_size)
