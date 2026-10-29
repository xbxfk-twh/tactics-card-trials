"""Build lean offline and room-server ZIPs from the checked runtime inventory."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parents[1] / "dist"


def build():
    inventory = json.loads(subprocess.check_output(
        ["node", str(ROOT / "tools/check-assets.cjs"), "--json"],
        cwd=ROOT, encoding="utf-8"))
    OUTPUT.mkdir(exist_ok=True)
    reports = {}
    instructions = "战棋 · 卡牌试炼（无 DIY）\n\n单人试玩：直接打开 index.html。\n联机：使用联机服务包，安装 Node.js 后双击启动游戏.cmd。\n存档保存在当前浏览器中；请使用相同浏览器及地址继续游玩。\n"
    variants = {
        "战棋-H5-离线试玩.zip": inventory["files"],
        "战棋-H5-联机服务.zip": inventory["files"] + inventory["serverFiles"],
    }
    dependency = ROOT / "node_modules/ws"
    if not (dependency / "package.json").is_file():
        raise SystemExit("Missing ws dependency. Run npm ci first.")
    for name, files in variants.items():
        with ZipFile(OUTPUT / name, "w", ZIP_DEFLATED, compresslevel=9) as archive:
            for relative in sorted(set(files)):
                archive.write(ROOT / relative, relative)
            archive.writestr("游玩说明.txt", instructions)
            if name == "战棋-H5-联机服务.zip":
                for file in sorted(dependency.rglob("*")):
                    if file.is_file() and (file.suffix in {".js", ".mjs", ".json"} or file.name == "LICENSE"):
                        archive.write(file, file.relative_to(ROOT).as_posix())
                archive.writestr("启动游戏.cmd", '@echo off\r\nchcp 65001 >nul\r\nwhere node >nul 2>nul\r\nif errorlevel 1 (\r\n  echo 请先安装 Node.js，再启动游戏。\r\n  pause\r\n  exit /b 1\r\n)\r\nnode "%~dp0tools\\launch.cjs"\r\nif errorlevel 1 pause\r\n')
        with ZipFile(OUTPUT / name) as archive:
            names = archive.namelist()
            assert len(names) == len(set(names)), "Duplicate ZIP entries"
            assert not any(part in {"art-source", "tests", "screenshots", ".venv", "历史版本"}
                           for entry in names for part in Path(entry).parts)
            reports[name] = {"files": len(names), "bytes": (OUTPUT / name).stat().st_size,
                             "unpackedBytes": sum(entry.file_size for entry in archive.infolist())}
    report = {"runtimeFiles": len(inventory["files"]), "runtimeBytes": inventory["bytes"],
              "packages": reports}
    (OUTPUT / "包体清单.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    build()
