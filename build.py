# -*- coding: utf-8 -*-
"""
Muzium 站点一键构建脚本。

每次更新素材（新增歌曲、修改角色 md、添加 .alp 歌词、改 playlist.json 等）
只需跑这一个脚本即可无 bug 重建整站静态产物。

用法：
    python build.py                 # 仅重建数据；字体若已生成则跳过
    python build.py --fonts         # 强制重新生成字体（需联网下载上游 OTF）
    python build.py --skip-data     # 只检查/生成字体，不重建数据

产物：
    site/data/*         由 site/tools/build_data.py 生成
    site/fonts/*.woff2  由 site/tools/build_font.py 生成（首次或 --fonts）
    site/css/font.css   同上

依赖：
    pip install "fonttools[woff]" brotli   # 仅生成字体时需要
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(ROOT, "site", "fonts")
DATA_TOOL = os.path.join(ROOT, "site", "tools", "build_data.py")
FONT_TOOL = os.path.join(ROOT, "site", "tools", "build_font.py")


def run(tool: str, *extra: str) -> None:
    cmd = [sys.executable, tool, *extra]
    print(f"\n>>> {' '.join(cmd)}")
    # 用同一条 Python 解释器，继承 stdout/stderr，失败即终止
    subprocess.run(cmd, check=True, cwd=ROOT)


def fonts_ready() -> bool:
    if not os.path.isdir(FONT_DIR):
        return False
    return bool([f for f in os.listdir(FONT_DIR) if f.endswith(".woff2")])


def main() -> None:
    ap = argparse.ArgumentParser(description="Muzium 站点一键构建")
    ap.add_argument("--fonts", action="store_true", help="强制重建字体（需联网）")
    ap.add_argument("--skip-data", action="store_true", help="跳过数据重建")
    args = ap.parse_args()

    # 1) 数据：默认必跑
    if not args.skip_data:
        run(DATA_TOOL)

    # 2) 字体：已存在且未强制时跳过（避免每次联网下载 22MB OTF）
    if args.fonts or not fonts_ready():
        if args.fonts or not os.path.exists(FONT_TOOL):
            run(FONT_TOOL, "--weights", "R", "SB")
        else:
            print("\n>>> 字体分片已存在，跳过 build_font（用 --fonts 强制重建）")
    else:
        print("\n>>> 字体分片已存在，跳过 build_font（用 --fonts 强制重建）")

    print("\n构建完成 ✓  预览：python -m http.server 8099  然后打开 http://localhost:8099/site/")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\n构建失败，退出码 {e.returncode}", file=sys.stderr)
        sys.exit(e.returncode)
    except KeyboardInterrupt:
        print("\n已取消", file=sys.stderr)
        sys.exit(130)
