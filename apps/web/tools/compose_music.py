"""Original, sample-free instrumental loops. Rebuild with NumPy and FFmpeg."""
from pathlib import Path
import json
import math
import shutil
import subprocess
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 32000
RNG = np.random.default_rng(20261027)


def voice(note, duration, kind):
    t = np.arange(round(duration * SR), dtype=np.float64) / SR
    f = 440 * 2 ** ((note-69)/12)
    if kind == 'harp':
        wavelet = sum(np.sin(2*np.pi*f*k*t + .05*k) * np.exp(-t*(1.3+k*.52)) / k**1.6 for k in range(1, 9))
        envelope = (1-np.exp(-t*180)) * np.minimum(1, (duration-t)/.12)
    elif kind == 'flute':
        phase = 2*np.pi*f*t + .045*np.sin(2*np.pi*4.7*t)*np.minimum(1,t/.5)
        wavelet = np.sin(phase) + .13*np.sin(2*phase) + .035*np.sin(3*phase)
        envelope = np.minimum(1,t/.16) * np.minimum(1,(duration-t)/.24) * (.9+.1*np.sin(np.pi*t/duration))
    elif kind == 'bell':
        wavelet = np.sin(2*np.pi*f*t)*np.exp(-t*1.1) + .2*np.sin(2*np.pi*f*2.002*t)*np.exp(-t*2.5)
        envelope = np.minimum(1,t/.012)*np.minimum(1,(duration-t)/.2)
    else:
        phase = 2*np.pi*f*t
        wavelet = sum((np.sin(phase*k+np.sin(t*1.1)*.012*k)+np.sin(phase*k*1.0018)) / (2*k**2.1) for k in range(1, 7))
        envelope = np.minimum(1,t/.55) * np.minimum(1,(duration-t)/.85)
    return (wavelet*np.maximum(0,envelope)).astype(np.float32)


def compose(name, bpm, chords, melodies, battle=False):
    beat = 60/bpm
    size = round(64*beat*SR)
    mix = np.zeros((size, 2), dtype=np.float32)

    def add(signal, when, gain, pan=0):
        start = round(when*beat*SR)
        at = (np.arange(len(signal))+start) % size
        mix[at,0] += signal*gain*math.sqrt((1-pan)/2)
        mix[at,1] += signal*gain*math.sqrt((1+pan)/2)

    for index, chord in enumerate(chords):
        origin = index*8
        for k, note in enumerate(chord):
            add(voice(note,8*beat+1.2,'strings'),origin,.044 if battle else .055,(k-1.5)*.24)
        add(voice(chord[0]-12,7.7*beat,'strings'),origin,.072,0)
        pattern = [0,2,1,3,2,1,3,2]
        for step in range(16 if battle else 8):
            note=chord[pattern[step%8]]+12
            add(voice(note,2.2,'harp'),origin+step*(.5 if battle else 1),.071 if battle else .084,(-.4 if step%2 else .4))
        for offset, note, length in melodies[index]:
            add(voice(note,length*beat+.18,'flute'),origin+offset,.080 if battle else .075,.12)
        if index%2 == 0:
            add(voice(chord[2]+24,3.8,'bell'),origin+.02,.027,-.35)
        if battle:
            for step in (0,2,3.5,4,6):
                t=np.arange(round(.45*SR))/SR
                drum=np.sin(2*np.pi*(58*t+27*.07*(1-np.exp(-t/.07))))*np.exp(-t*11)
                drum*=np.minimum(1,t/.004)
                add(drum.astype(np.float32),origin+step,.065 if step%4==0 else .035)
            for step in (1,3,5,7):
                t=np.arange(round(.15*SR))/SR
                noise=RNG.normal(0,1,len(t)).astype(np.float32)
                noise=np.convolve(noise,np.ones(17)/17,'same')*np.exp(-t*32)*np.minimum(1,t/.01)
                add(noise,origin+step,.046,-.22)

    # Circular stereo room tails preserve the phrase across loop boundaries.
    dry=mix.copy()
    for delay,gain in ((.113,.12),(.193,.10),(.317,.09),(.461,.075),(.683,.055),(.911,.04)):
        blurred=np.column_stack([np.convolve(dry[:,c],np.ones(7)/7,'same') for c in range(2)])
        mix += np.roll(blurred[:,::-1],round(delay*SR),axis=0)*gain
    mix=np.tanh(mix*1.15)
    rms=float(np.sqrt(np.mean(mix**2)))
    mix*=min(.095/max(rms,1e-6),.81/max(float(np.max(np.abs(mix))),1e-6))
    target=ROOT/'assets/audio'/f'{name}.mp3'
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        wav=Path(temp)/'loop.wav'
        with wave.open(str(wav),'wb') as output:
            output.setnchannels(2);output.setsampwidth(2);output.setframerate(SR)
            output.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())
        subprocess.run([shutil.which('ffmpeg'),'-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','96k','-map_metadata','-1',str(target)],check=True)
    return {'file':target.relative_to(ROOT).as_posix(),'bpm':bpm,'bars':16,'seconds':round(size/SR,3),'peak':round(float(np.max(np.abs(mix))),4),'rms':round(float(np.sqrt(np.mean(mix**2))),4),'chords':chords,'melodies':melodies}


if __name__=='__main__':
    journey_chords=[[50,57,60,64],[46,53,57,60],[53,57,60,65],[48,55,58,62],[50,57,60,64],[43,55,58,62],[46,53,57,60],[45,52,57,61]]
    journey_melodies=[[(0,74,2.5),(3,77,1),(4.5,76,1.5),(6.5,72,1)],[(1,69,2),(3.5,72,1.5),(6,74,1.5)],[(0,77,3),(4,81,1),(5.5,79,1.5)],[(0,76,2),(2.5,74,1),(4,72,2.5)],[(0,74,1.5),(2,77,1.5),(4,81,2),(6.5,79,1)],[(1,79,2),(3.5,77,1),(5,74,2)],[(0,77,2.5),(3.5,76,1),(5,74,2)],[(0,73,2),(3,76,1.5),(5.5,73,1.5)]]
    battle_chords=[[50,57,62,65],[46,53,58,62],[43,50,58,62],[45,52,57,61],[50,57,62,65],[53,57,60,65],[46,53,58,62],[45,52,57,61]]
    battle_melodies=[[(0,74,1.5),(2,77,1),(3.5,81,1.5),(6,77,1)],[(0,77,2),(3,74,1),(4.5,70,2)],[(0,74,1),(1.5,77,1),(3,79,2),(6,77,1)],[(0,76,2),(3,73,1.5),(5.5,69,1.5)],[(0,81,1.5),(2,79,1),(3.5,77,1),(5,74,2)],[(0,77,2),(3,81,1.5),(5.5,84,1.5)],[(0,82,1.5),(2,81,1),(3.5,77,1.5),(6,74,1)],[(0,76,1),(1.5,73,1),(3,69,2),(6,73,1)]]
    records=[compose('moonlit-grove-v1',68,journey_chords,journey_melodies),compose('starlit-tactics-v1',92,battle_chords,battle_melodies,True)]
    out=ROOT.parents[1]/'artifacts/audio-source';out.mkdir(parents=True,exist_ok=True)
    (out/'配乐说明与乐谱.json').write_text(json.dumps({'origin':'原创程序合成，无外部采样或录音','instruments':['竖琴','木笛','柔弦','钟音','低鼓'],'tracks':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps([{k:v for k,v in r.items() if k not in ('chords','melodies')} for r in records],indent=2))
