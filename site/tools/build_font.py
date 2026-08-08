# -*- coding: utf-8 -*-
"""
生成站点自托管的「源云明朝」Web 字体（woff2 分片）。

上游 https://github.com/ButTaiwan/genwan-font 只提供 ~22MB 的 OTF，
既无法直接上网页使用，也超过 jsDelivr 的 50MB 包体限制。
本脚本把 OTF 按 Unicode 区段切成若干 woff2 分片，配合 CSS 的
unicode-range，浏览器只会下载页面真正用到的那几片。

用法：
    python site/tools/build_font.py            # 下载 + 子集化（默认 R 字重）
    python site/tools/build_font.py --weights R SB

产物：site/fonts/GenWanMin2TW-<W>.<i>.woff2 与 site/css/font.css
"""
from __future__ import annotations

import argparse
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT_DIR = os.path.join(ROOT, "site", "fonts")
CACHE_DIR = os.path.join(ROOT, "site", "tools", ".cache")
CSS_PATH = os.path.join(ROOT, "site", "css", "font.css")

BASE_URL = "https://raw.githubusercontent.com/ButTaiwan/genwan-font/master/otf/TW/GenWanMin2TW-{w}.otf"

# 字重 -> CSS font-weight
WEIGHTS = {"EL": 200, "L": 300, "R": 400, "M": 500, "SB": 600}

# 按使用频率切片：越靠前的片越可能被立即加载
SLICES: list[tuple[str, str]] = [
    # 拉丁 / 标点 / 假名 / 注音 —— 体积小，几乎必用
    ("latin", "U+0020-007F,U+00A0-00FF,U+2000-206F,U+2100-214F,U+2160-217F,"
              "U+3000-303F,U+30A0-30FF,U+3040-309F,U+31F0-31FF,U+FF00-FFEF,"
              "U+2010-2027,U+25A0-25FF,U+2190-21FF"),
    # CJK 统一汉字：按 8 段切分，单片 ~1-2MB 压缩后 ~400-700KB
    ("cjk1", "U+4E00-53FF"),
    ("cjk2", "U+5400-58FF"),
    ("cjk3", "U+5900-5DFF"),
    ("cjk4", "U+5E00-62FF"),
    ("cjk5", "U+6300-67FF"),
    ("cjk6", "U+6800-6CFF"),
    ("cjk7", "U+6D00-71FF"),
    ("cjk8", "U+7200-76FF"),
    ("cjk9", "U+7700-7BFF"),
    ("cjk10", "U+7C00-80FF"),
    ("cjk11", "U+8100-85FF"),
    ("cjk12", "U+8600-8AFF"),
    ("cjk13", "U+8B00-8FFF"),
    ("cjk14", "U+9000-94FF"),
    ("cjk15", "U+9500-99FF"),
    ("cjk16", "U+9A00-9FFF"),
    # 扩展区 A 与兼容区（生僻字，按需加载）
    ("ext1", "U+3400-3FFF"),
    ("ext2", "U+4000-46FF"),
    ("ext3", "U+4700-4DBF"),
    ("compat", "U+F900-FAFF"),
]


def unicodes_of(spec: str) -> str:
    """把 'U+4E00-53FF,U+F900' 转成 fontTools 的 --unicodes 参数格式"""
    return ",".join(part.replace("U+", "") for part in spec.split(","))


def download(weight: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    dst = os.path.join(CACHE_DIR, f"GenWanMin2TW-{weight}.otf")
    if os.path.exists(dst) and os.path.getsize(dst) > 1_000_000:
        print(f"  已缓存 {os.path.basename(dst)}")
        return dst
    url = BASE_URL.format(w=weight)
    print(f"  下载 {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "muzium-site-build"})
    with urllib.request.urlopen(req, timeout=600) as r, open(dst, "wb") as f:
        total = 0
        while chunk := r.read(1 << 20):
            f.write(chunk)
            total += len(chunk)
            print(f"\r    {total/1048576:.1f} MB", end="", flush=True)
    print()
    return dst


def subset(src: str, weight: str) -> list[tuple[str, str, int]]:
    from fontTools import subset as ftsubset

    os.makedirs(FONT_DIR, exist_ok=True)
    made = []
    for name, rng in SLICES:
        out = os.path.join(FONT_DIR, f"GenWanMin2TW-{weight}.{name}.woff2")
        args = [
            src,
            f"--unicodes={unicodes_of(rng)}",
            "--flavor=woff2",
            f"--output-file={out}",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
            "--drop-tables+=DSIG",
            "--name-IDs=*",
            "--ignore-missing-glyphs",
        ]
        try:
            ftsubset.main(args)
        except SystemExit:
            pass
        if os.path.exists(out) and os.path.getsize(out) > 500:
            size = os.path.getsize(out)
            made.append((name, rng, size))
            print(f"    {name:6s} {size/1024:7.1f} KB")
        elif os.path.exists(out):
            os.remove(out)  # 该区段无字形
    return made


def write_css(built: dict[str, list[tuple[str, str, int]]]) -> None:
    lines = [
        "/* 源云明朝 GenWan Min —— 由 site/tools/build_font.py 自动生成，请勿手工编辑 */",
        "/* 上游：https://github.com/ButTaiwan/genwan-font （SIL OFL 1.1） */",
        "",
    ]
    for weight, slices in built.items():
        css_weight = WEIGHTS[weight]
        for name, rng, _ in slices:
            lines += [
                "@font-face {",
                '  font-family: "GenWanMin";',
                f"  font-style: normal;",
                f"  font-weight: {css_weight};",
                "  font-display: swap;",
                f'  src: url("../fonts/GenWanMin2TW-{weight}.{name}.woff2") format("woff2");',
                f"  unicode-range: {rng};",
                "}",
            ]
        lines.append("")
    os.makedirs(os.path.dirname(CSS_PATH), exist_ok=True)
    with open(CSS_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"  已写出 {os.path.relpath(CSS_PATH, ROOT)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", nargs="+", default=["R", "SB"], choices=list(WEIGHTS))
    args = ap.parse_args()

    built = {}
    for w in args.weights:
        print(f"字重 {w}（font-weight {WEIGHTS[w]}）")
        src = download(w)
        built[w] = subset(src, w)

    write_css(built)
    total = sum(s for sl in built.values() for _, _, s in sl)
    print(f"完成，共 {sum(len(v) for v in built.values())} 个分片，合计 {total/1048576:.1f} MB")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
