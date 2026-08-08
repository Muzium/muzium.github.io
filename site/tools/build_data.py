# -*- coding: utf-8 -*-
"""
从仓库资源生成站点所需的静态数据。

输入：
  markdown/*.md            角色资料 / EULA 等文档
  data/playlist.json       歌曲清单
  assets/playlist/lyric/*.alp  Apple-Music-like-Lyric 歌词包（zip）

输出（全部写入 site/data/）：
  characters.json  角色结构化数据
  pages.json       markdown 文档页索引
  playlist.json    歌曲清单（副本）
  lyrics/*.json    从 .alp 中抽出的逐字歌词（剥离内嵌音频）
"""
from __future__ import annotations

import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MD_DIR = os.path.join(ROOT, "markdown")
SITE_DATA = os.path.join(ROOT, "site", "data")
LYRIC_SRC = os.path.join(ROOT, "assets", "playlist", "lyric")

# 角色档案文件（顺序即站点展示顺序），其余 md 作为普通文档页
CHARACTER_ORDER = ["Fuyi", "Fuyao", "Fuhao", "Wanzhi", "Feimeng"]

LANG_LABEL = {
    "zh": "汉语普通话", "ja": "日语", "en": "英语", "ko": "朝鲜语",
    "zh-yue": "汉语广东话", "zh-hsn": "汉语湖南话", "zh-nan": "汉语闽南话",
    "es": "西班牙语",
}


def norm_asset(p: str) -> str:
    r"""把 md 中的 "\assets\icon\x.png" 规整成 /assets/icon/x.png"""
    p = p.strip().strip('"').strip("'").replace("\\", "/")
    if not p.startswith("/"):
        p = "/" + p.lstrip("/")
    return p


def split_values(text: str) -> list[str]:
    return [x.strip() for x in re.split(r"[、,，/]", text) if x.strip()]


def parse_langs(text: str) -> list[dict]:
    """'汉语普通话（zh）、日语（ja）' -> [{code,label}]"""
    out = []
    for item in split_values(text):
        m = re.match(r"^(.*?)[（(]\s*([A-Za-z\-]+)\s*[)）]\s*$", item)
        if m:
            out.append({"label": m.group(1).strip(), "code": m.group(2).strip()})
        else:
            code = next((c for c, l in LANG_LABEL.items() if l == item), "")
            out.append({"label": item, "code": code})
    return out


def kv(line: str):
    """解析 '键：值'（全角/半角冒号），非键值行返回 None"""
    m = re.match(r"^([\u4e00-\u9fa5A-Za-z0-9 ]{2,10})[：:]\s*(.*)$", line)
    return (m.group(1).strip(), m.group(2).strip()) if m else None


def strip_md_inline(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", s)
    return s.replace("**", "").strip()


def parse_links(text: str) -> list[dict]:
    """抽取一行/一段中的所有 markdown 链接"""
    return [{"text": t, "url": u.strip()} for t, u in re.findall(r"\[([^\]]+)\]\(([^)]+)\)", text)]


def parse_character(path: str, slug: str) -> dict:
    raw = open(path, encoding="utf-8").read()
    lines = raw.split("\n")

    char: dict = {
        "slug": slug, "name": "", "tagline": "", "subtitle": "",
        "profile": {}, "colors": {}, "illusts": [], "voicebanks": [],
        "album": f"/assets/album/{slug}-Album.png",
    }

    section = None      # 当前 ## 段
    illust = None       # 当前 ### 立绘
    vb = None           # 当前 ### 声库
    timbre = None       # 当前 #### 音色
    in_samples = False  # 是否处于 #### 干声试听
    head_done = False

    def flush_illust():
        nonlocal illust
        if illust:
            char["illusts"].append(illust)
            illust = None

    def flush_timbre():
        nonlocal timbre
        if timbre and vb is not None:
            vb["timbres"].append(timbre)
        timbre = None

    def flush_vb():
        nonlocal vb
        flush_timbre()
        if vb:
            char["voicebanks"].append(vb)
            vb = None

    for i, line in enumerate(lines):
        s = line.strip()

        if s.startswith("# "):
            char["name"] = s[2:].strip()
            continue

        if s.startswith("## "):
            flush_illust(); flush_vb()
            section = s[3:].strip()
            in_samples = False
            head_done = True
            continue

        if s.startswith("### "):
            title = s[4:].strip()
            if section == "立绘信息":
                flush_illust()
                illust = {"title": title, "design": "", "paint": "", "icon": "", "illust": ""}
            elif section == "声库展示与下载":
                flush_vb()
                name = title
                engine = name.split(" for ", 1)[1].strip() if " for " in name else name
                vb = {
                    "title": name, "engine": engine, "engineSite": "", "engineIntro": "",
                    "notices": [], "timbreNames": [], "languages": [], "version": "",
                    "timbres": [], "samples": [], "credits": [], "links": [],
                    "redirect": "",
                }
            in_samples = False
            continue

        if s.startswith("#### "):
            title = s[5:].strip()
            if title == "干声试听":
                flush_timbre()
                in_samples = True
            else:
                flush_timbre()
                in_samples = False
                timbre = {"name": title, "intro": "", "range": "", "tempo": ""}
            continue

        if not s:
            continue

        # 头部：标题下的 tagline / subtitle
        if not head_done and char["name"]:
            if not char["tagline"]:
                char["tagline"] = s
            elif not char["subtitle"]:
                char["subtitle"] = s
            continue

        if in_samples and s.startswith("["):
            for lk in parse_links(s):
                m = re.match(r"^(.*?)音色", lk["text"])
                vb["samples"].append({
                    "label": lk["text"],
                    "timbre": (m.group(1).strip() if m else ""),
                    "url": norm_asset(lk["url"]),
                })
            continue

        # 加粗独立段落 = 公告
        if s.startswith("**") and s.endswith("**") and vb is not None:
            vb["notices"].append(strip_md_inline(s))
            continue

        pair = kv(s)
        if not pair:
            continue
        k, v = pair

        if section == "角色设定":
            if k in ("代表色", "次要色"):
                char["colors"]["primary" if k == "代表色" else "secondary"] = v
            else:
                char["profile"][k] = v
        elif section == "立绘信息" and illust is not None:
            if k == "设计":
                illust["design"] = v
            elif k == "绘制":
                illust["paint"] = v
            elif k == "头像":
                illust["icon"] = norm_asset(v)
            elif k == "立绘":
                illust["illust"] = norm_asset(v)
        elif section == "声库展示与下载" and vb is not None:
            if timbre is not None and k in ("音色简介", "推荐音域", "推荐曲速"):
                timbre[{"音色简介": "intro", "推荐音域": "range", "推荐曲速": "tempo"}[k]] = v
            elif k == "引擎官网":
                vb["engineSite"] = v
            elif k == "引擎简介":
                vb["engineIntro"] = v
                vb["engineIntroLinks"] = parse_links(v)
            elif k == "支持音色":
                vb["timbreNames"] = split_values(v)
            elif k == "支持语言":
                vb["languages"] = parse_langs(v)
            elif k == "最新版本":
                vb["version"] = v
            elif k == "重定向网址":
                vb["redirect"] = v
            else:
                links = parse_links(v)
                if links:
                    vb["links"].append({"label": k, "items": links})
                else:
                    vb["credits"].append({"label": k, "value": strip_md_inline(v)})

    flush_illust(); flush_vb()
    return char


def parse_doc(path: str, slug: str) -> dict:
    raw = open(path, encoding="utf-8").read()
    title = slug
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", raw, re.S)
    if m:
        fm = m.group(1)
        t = re.search(r"^title:\s*(.+)$", fm, re.M)
        if t:
            title = t.group(1).strip()
        raw = raw[m.end():]
    else:
        h = re.search(r"^#\s+(.+)$", raw, re.M)
        if h:
            title = h.group(1).strip()
    # 顶栏用短标题：去掉「（更新于…）」这类括注，避免导航过长
    nav_title = re.sub(r"[（(][^）)]*[）)]\s*$", "", title).strip() or title
    return {"slug": slug, "title": title, "navTitle": nav_title, "body": raw.strip()}


def build_lyrics() -> dict:
    """把 .alp（zip）里的 data.json 抽成独立轻量 json，丢弃内嵌音频。"""
    out_dir = os.path.join(SITE_DATA, "lyrics")
    os.makedirs(out_dir, exist_ok=True)
    mapping = {}
    if not os.path.isdir(LYRIC_SRC):
        return mapping
    for fn in sorted(os.listdir(LYRIC_SRC)):
        if not fn.lower().endswith(".alp"):
            continue
        stem = os.path.splitext(fn)[0]
        src = os.path.join(LYRIC_SRC, fn)
        try:
            with zipfile.ZipFile(src) as z:
                data = json.loads(z.read("data.json").decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            print(f"  ! 跳过 {fn}: {e}")
            continue
        lines = []
        for ln in data.get("lines", []):
            lines.append({
                "start": ln.get("startTime", 0),
                "end": ln.get("endTime", 0),
                "translation": ln.get("translation", ""),
                "romanization": ln.get("romanization", ""),
                "background": bool(ln.get("background")),
                "duet": bool(ln.get("duet")),
                "syllables": [
                    {"s": sy.get("startTime", 0), "e": sy.get("endTime", 0), "t": sy.get("text", "")}
                    for sy in ln.get("syllables", [])
                ],
            })
        slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
        with open(os.path.join(out_dir, slug + ".json"), "w", encoding="utf-8") as f:
            json.dump({"title": stem, "lines": lines}, f, ensure_ascii=False, separators=(",", ":"))
        mapping[f"/assets/playlist/lyric/{fn}"] = f"data/lyrics/{slug}.json"
        print(f"  歌词 {fn} -> {slug}.json（{len(lines)} 行）")
    return mapping


def main() -> None:
    os.makedirs(SITE_DATA, exist_ok=True)

    md_files = sorted(f for f in os.listdir(MD_DIR) if f.lower().endswith(".md"))
    characters, pages = [], []
    for fn in md_files:
        slug = os.path.splitext(fn)[0]
        path = os.path.join(MD_DIR, fn)
        if slug in CHARACTER_ORDER:
            characters.append(parse_character(path, slug))
        else:
            pages.append(parse_doc(path, slug))

    characters.sort(key=lambda c: CHARACTER_ORDER.index(c["slug"]))

    lyric_map = build_lyrics()

    playlist = json.load(open(os.path.join(ROOT, "data", "playlist.json"), encoding="utf-8"))
    for song in playlist:
        song["lyricData"] = lyric_map.get(song.get("lyric", ""), "")

    def dump(name, obj):
        with open(os.path.join(SITE_DATA, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)

    dump("characters.json", characters)
    dump("pages.json", pages)
    dump("playlist.json", playlist)

    print(f"角色 {len(characters)} 个：" + "、".join(
        f"{c['name']}({len(c['illusts'])}立绘/{len(c['voicebanks'])}声库)" for c in characters))
    print(f"文档 {len(pages)} 篇，歌曲 {len(playlist)} 首，"
          f"其中带歌词 {sum(1 for s in playlist if s['lyricData'])} 首")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
