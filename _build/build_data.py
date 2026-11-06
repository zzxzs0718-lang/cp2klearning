# -*- coding: utf-8 -*-
"""Build js/data/*.js from crawled CP2K manual data.

Outputs (all plain JS, no modules, file:// friendly):
  js/data/manual.js   window.MANUAL = [{doc,title}]
  js/data/keywords.js window.KEYWORDS = [{name,path,page,type,def,desc,values}]
  js/data/stats.js    window.STATS = {pages,keywords,chapters,sections}
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "_src"
OUT = ROOT / "js" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def load_searchindex():
    raw = (ROOT / "_build" / "searchindex.js").read_text(encoding="utf-8")
    m = re.search(r"Search\.setIndex\((.*)\)\s*;?\s*$", raw, re.S)
    return json.loads(m.group(1))


def clean(s):
    if not s:
        return ""
    s = str(s).replace("\uf0c1", "").replace("\u00b6", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def load_json_dir(sub):
    out = {}
    d = SRC / sub
    if not d.exists():
        return out
    for p in d.glob("*.json"):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if j.get("doc"):
            out[j["doc"]] = j
    return out


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


def main():
    si = load_searchindex()
    docs = si["docnames"]
    titles = si["titles"]
    narrative = load_json_dir("narrative")
    inputs = load_json_dir("input")

    manual = []
    for doc, title in zip(docs, titles):
        t = clean(title) or doc.split("/")[-1]
        if doc in narrative:
            t = clean(narrative[doc].get("title")) or t
        elif doc in inputs:
            t = clean(inputs[doc].get("title")) or t
        manual.append({"doc": doc, "title": t})
    manual.sort(key=lambda x: x["doc"])
    (OUT / "manual.js").write_text(
        "window.MANUAL=" + json.dumps(manual, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    # 关键词：全量抓取里同一关键词会在多个父节下重复出现
    # （XC_FUNCTIONAL 甚至在一个页面里重复几千次）。
    # 参考页按「关键词名」去重：先收集 (name, path) -> 元数据，
    # 再按「常用页优先」挑一条作为展示位置，保证 path/type/default/desc 同源。
    records = {}
    def fmt_value(v):
        # 抓取里 values 是 {value, desc} 字典；参考页只展示紧凑字符串
        if isinstance(v, dict):
            val = clean(v.get("value"))
            desc = clean(v.get("desc"))
            if val and desc:
                return val + "（" + (desc[:140] + ("…" if len(desc) > 140 else "")) + "）"
            return val or desc
        return clean(v)

    for doc, j in inputs.items():
        base = ".".join(doc.split("/"))
        for k in j.get("keywords", []):
            name = clean(k.get("name"))
            if not name:
                continue
            vals = []
            for v in (k.get("values") or [])[:8]:
                s = fmt_value(v)
                if s and s not in vals:
                    vals.append(s)
            meta = {
                "type": clean(k.get("type")),
                "def": clean(k.get("default")),
                "desc": clean(k.get("desc")),
                "values": vals,
            }
            if not (meta["type"] or meta["desc"]):
                continue
            records.setdefault(name, {})[base] = meta

    # 常用页优先：这些页面才是读者真正会查的地方
    PREFERRED = {
        "EPS_SCF": "CP2K_INPUT.FORCE_EVAL.DFT.SCF",
        "MAX_SCF": "CP2K_INPUT.FORCE_EVAL.DFT.SCF",
        "SCF_GUESS": "CP2K_INPUT.FORCE_EVAL.DFT.SCF",
        "ADDED_MOS": "CP2K_INPUT.FORCE_EVAL.DFT.SCF.SMEAR",
        "TIMESTEP": "CP2K_INPUT.MOTION.MD",
        "TEMPERATURE": "CP2K_INPUT.MOTION.MD",
        "STEPS": "CP2K_INPUT.MOTION.MD",
        "CUTOFF": "CP2K_INPUT.FORCE_EVAL.DFT.MGRID",
        "REL_CUTOFF": "CP2K_INPUT.FORCE_EVAL.DFT.MGRID",
        "PERIODIC": "CP2K_INPUT.FORCE_EVAL.SUBSYS.CELL",
        "XC_FUNCTIONAL": "CP2K_INPUT.FORCE_EVAL.DFT.XC",
        "BASIS_SET": "CP2K_INPUT.FORCE_EVAL.SUBSYS.KIND",
        "POTENTIAL": "CP2K_INPUT.FORCE_EVAL.SUBSYS.KIND",
        "K_POINTS": "CP2K_INPUT.FORCE_EVAL.DFT.KPOINTS",
    }

    def prio(p):
        seg = p.split(".")
        top = seg[1] if len(seg) > 1 else ""
        return ({"FORCE_EVAL": 0, "MOTION": 1, "GLOBAL": 2, "SUBSYS": 3}.get(top, 4), p.count("."), p)

    kws = []
    for name, cand in records.items():
        pref = PREFERRED.get(name)
        if pref in cand:
            path = pref
        else:
            # 有多个定义时选「段数最少、位置更靠上」的那条
            path = min(cand, key=prio)
        meta = cand[path]
        where = sorted(cand)[:6]
        kws.append(
            {
                "name": name,
                "path": path,
                "page": ".".join(path.split(".")[1:3]),
                "type": meta["type"],
                "def": meta["def"],
                "desc": meta["desc"],
                "values": meta["values"],
                "where": where,
            }
        )

    kws.sort(key=lambda x: x["name"])
    (OUT / "keywords.js").write_text(
        "window.KEYWORDS=" + json.dumps(kws, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    chapters = sorted((ROOT / "js" / "content").glob("ch*.js"))
    sections = 0
    for p in chapters:
        txt = p.read_text(encoding="utf-8", errors="ignore")
        sections += len(re.findall(r'id:\s*"\d+\.\d+"', txt))
    stats = {
        "pages": len(manual),
        "keywords": len(kws),
        "chapters": len(chapters),
        "sections": sections,
    }
    (OUT / "stats.js").write_text(
        "window.STATS=" + json.dumps(stats, ensure_ascii=False) + ";\n", encoding="utf-8"
    )
    print("manual:", len(manual), "keywords:", len(kws), "chapters:", stats["chapters"], "sections:", sections)
    print("size manual.js %.0f KB, keywords.js %.0f KB" % (
        (OUT / "manual.js").stat().st_size / 1024,
        (OUT / "keywords.js").stat().st_size / 1024,
    ))


if __name__ == "__main__":
    main()