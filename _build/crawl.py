# -*- coding: utf-8 -*-
"""Crawl manual.cp2k.org (trunk) into local JSON.

- narrative pages  -> _src/narrative/<doc>.json  {doc,title,url,headings,markdown}
- input reference  -> _src/input/<doc>.json      {doc,title,path,desc,subsections,keywords}
- meta             -> _src/meta.json             [{doc,title,kind}]

Usage:  python crawl.py [--limit N] [--only narrative|input] [--workers 10]
"""
import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)              # cp2k-learn/
SRC = os.path.join(ROOT, "_src")
BASE = "https://manual.cp2k.org/trunk/"

UA = "cp2k-learn-tutorial-crawler/1.0 (educational, offline copy of public manual)"


def load_docnames():
    raw = open(os.path.join(HERE, "searchindex.js"), encoding="utf-8").read()
    m = re.search(r"Search\.setIndex\((.*)\)\s*;?\s*$", raw, re.S)
    data = json.loads(m.group(1))
    names = data["docnames"]
    titles = data.get("titles", [])
    out = []
    for i, n in enumerate(names):
        t = titles[i] if i < len(titles) else n
        kind = "input" if n.startswith("CP2K_INPUT/") else "narrative"
        out.append({"doc": n, "title": t, "kind": kind})
    return out


def fetch(session, doc):
    url = BASE + doc + ".html"
    last = None
    for attempt in range(4):
        try:
            r = session.get(url, timeout=40, headers={"User-Agent": UA})
            if r.status_code == 200:
                return r.content.decode("utf-8", "replace")
            last = "HTTP %s" % r.status_code
        except Exception as e:  # noqa: BLE001
            last = repr(e)
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("fetch failed: %s (%s)" % (url, last))


# ---------------------------------------------------------------- narrative
def text_of(node):
    return " ".join(node.get_text(" ", strip=True).split())


def md_inline(node):
    """Very small HTML -> inline markdown converter (keeps math/text)."""
    if isinstance(node, NavigableString):
        s = str(node)
        s = re.sub(r"\s+", " ", s)
        return s
    name = node.name
    if name in ("script", "style"):
        return ""
    if name == "code":
        txt = node.get_text("", strip=True).replace("`", "\\`")
        return "`%s`" % txt if txt else ""
    if name in ("strong", "b"):
        return "**%s**" % inner_md(node)
    if name in ("em", "i"):
        return "*%s*" % inner_md(node)
    if name == "sup":
        return "<sup>%s</sup>" % inner_md(node)
    if name == "sub":
        return "<sub>%s</sub>" % inner_md(node)
    if name == "br":
        return "  \n"
    if name == "a":
        inner = inner_md(node)
        href = node.get("href", "")
        if href.startswith("#") or not href:
            return inner
        return "[%s](%s)" % (inner, href)
    if name == "span" and "math" in (node.get("class") or []):
        return "$%s$" % node.get_text("", strip=True)
    return inner_md(node)


def inner_md(node):
    return "".join(md_inline(c) for c in node.children)


def md_block(node, depth=0):
    """Block level converter: headings, paragraphs, lists, tables, code, math."""
    if isinstance(node, NavigableString):
        return str(node).strip()
    out = []
    name = node.name
    if name in ("script", "style", "nav"):
        return ""
    if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
        lvl = int(name[1])
        txt = text_of(node).replace("\uf0c1", "").strip()
        txt = re.sub(r"\s*\(\d+\)\s*$", "", txt)  # drop sphinx permalink marker remnants
        out.append("#" * lvl + " " + txt)
    elif name == "p":
        out.append(inner_md(node).strip())
    elif name in ("ul", "ol"):
        ordered = name == "ol"
        lines = []
        for i, li in enumerate(node.find_all("li", recursive=False), 1):
            # nested lists inside li
            sub = [c for c in li.find_all(["ul", "ol"], recursive=False)]
            for s in sub:
                s.extract()
            mark = "%d." % i if ordered else "-"
            body = inner_md(li).strip()
            lines.append(("  " * depth) + mark + " " + body)
            for s in sub:
                submd = md_block(s, depth + 1)
                if submd:
                    lines.append(submd)
        out.append("\n".join(lines))
    elif name == "dl":
        for child in node.children:
            if isinstance(child, Tag) and child.name == "dt":
                out.append("**%s**" % text_of(child))
            elif isinstance(child, Tag) and child.name == "dd":
                out.append(inner_md(child).strip())
    elif name == "pre":
        code = node.get_text("", strip=False).strip("\n")
        code = "\n".join(line.rstrip() for line in code.split("\n"))
        out.append("```\n%s\n```" % code)
    elif name == "table":
        rows = []
        for tr in node.find_all("tr"):
            cells = [text_of(c) for c in tr.find_all(["th", "td"])]
            if cells:
                rows.append(cells)
        if rows:
            head = rows[0]
            body = rows[1:]
            md = ["| " + " | ".join(head) + " |", "|" + "|".join(["---"] * len(head)) + "|"]
            for r in body:
                r = (r + [""] * len(head))[: len(head)]
                md.append("| " + " | ".join(x.replace("|", "\\|") for x in r) + " |")
            out.append("\n".join(md))
    elif name == "div":
        cls = node.get("class") or []
        if "math" in cls or "formula" in cls:
            out.append("$$" + node.get_text("", strip=True) + "$$")
            return "\n\n".join(x for x in out if x)
        if "admonition" in cls:
            title = node.find(class_="admonition-title")
            t = text_of(title) if title else ""
            body = "\n\n".join(
                md_block(c, depth)
                for c in node.children
                if c is not title and not (isinstance(c, NavigableString) and not str(c).strip())
            )
            out.append("> **%s**\n>\n%s" % (t, body.replace("\n", "\n> ")))
            return "\n\n".join(x for x in out if x)
        for c in node.children:
            if isinstance(c, Tag):
                sub = md_block(c, depth)
                if sub:
                    out.append(sub)
            elif isinstance(c, NavigableString) and str(c).strip():
                out.append(str(c).strip())
    elif name in ("figure",):
        img = node.find("img")
        cap = node.find("figcaption")
        if img:
            out.append("![%s](%s)" % (text_of(cap) if cap else "", img.get("src", "")))
    elif name == "img":
        out.append("![](%s)" % node.get("src", ""))
    else:
        for c in node.children:
            if isinstance(c, Tag):
                sub = md_block(c, depth)
                if sub:
                    out.append(sub)
    return "\n\n".join(x for x in out if x).strip()


def parse_narrative(html, doc, title):
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("div", {"role": "main"})
    body = main.find("div") if main else None
    md = md_block(body) if body else ""
    # headings for a mini table of contents
    heads = []
    for h in (body.find_all(["h1", "h2", "h3"]) if body else []):
        t = text_of(h).replace("\uf0c1", "").strip()
        if t:
            heads.append({"level": int(h.name[1]), "text": t, "id": h.get("id", "")})
    return {"doc": doc, "title": title, "url": BASE + doc + ".html",
            "headings": heads, "markdown": md}


# ------------------------------------------------------------------- input
FIELD_RE = re.compile(r"^(Type|Default|Aliases|Lone keyword|Usage|Description|Valid values):\s*", re.I)


def parse_keyword(div):
    h3 = div.find("h3")
    if not h3:
        return None
    name = text_of(h3)
    fields = {}
    order = ["type", "default", "aliases", "lone", "usage", "description"]
    cur = None
    buf = []
    values = []
    mentions = []

    # walk paragraphs in order; collect <strong>label</strong> segments
    def flush():
        nonlocal cur, buf
        if cur:
            txt = " ".join("".join(buf).split())
            if cur in fields and fields[cur]:
                fields[cur] += " " + txt
            else:
                fields[cur] = txt
        cur, buf = None, []

    for p in div.find_all("p", recursive=False):
        # skip permalink
        txt = p.get_text(" ", strip=True)
        if not txt:
            continue
        # parse label starts
        pieces = []
        pos = 0
        html_p = str(p)
        for strong in p.find_all("strong"):
            label = text_of(strong).rstrip(":").strip()
            start = p.decode_contents().find(str(strong))
            pieces.append((label, start))
        # simpler: split by <br>
        seq = []
        for part in p.contents:
            if isinstance(part, Tag) and part.name == "br":
                continue
            if isinstance(part, Tag) and part.name == "strong":
                seq.append(("label", text_of(part).rstrip(":").strip()))
            elif isinstance(part, Tag) and part.name == "small":
                continue
            else:
                seq.append(("text", part.get_text(" ", strip=True) if isinstance(part, Tag) else str(part)))
        piece = []
        for kind, val in seq:
            if kind == "label":
                if cur is not None:
                    flush()
                cur = val.lower().replace(" ", "_")
            else:
                if cur is not None:
                    buf.append(val)
        flush()
        if "mentions" in txt.lower() or p.find("strong", string=re.compile("Mentions")):
            for a in p.find_all("a"):
                if a.get("href") and not a.get("href", "").startswith("#"):
                    mentions.append({"text": text_of(a), "href": a.get("href")})

    # valid values
    vp = div.find("p", string=re.compile("Valid values"))
    ul = None
    for p in div.find_all("p", recursive=False):
        if text_of(p).lower().startswith("valid values"):
            sib = p.find_next_sibling()
            while sib is not None and not (isinstance(sib, Tag) and sib.name in ("ul", "ol", "dl")):
                sib = sib.find_next_sibling()
            ul = sib
            break
    if ul is not None:
        for li in ul.find_all("li", recursive=False):
            code = li.find("code")
            val = text_of(code) if code else ""
            desc = text_of(li)
            if val:
                desc = desc[len(val):].strip()
            values.append({"value": val, "desc": desc})

    desc = fields.get("description", "")
    # strip trailing edit-on-github artifacts
    desc = re.sub(r"\[\s*Edit on GitHub\s*\]", "", desc).strip()
    return {
        "name": name,
        "type": fields.get("type", ""),
        "default": fields.get("default", ""),
        "aliases": fields.get("aliases", ""),
        "lone": fields.get("lone_keyword", ""),
        "usage": fields.get("usage", ""),
        "desc": desc,
        "values": values,
        "mentions": mentions[:8],
    }


def parse_input(html, doc, title):
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("div", {"role": "main"})
    page = main.find("div", class_="cp2k-input-page") if main else None
    if page is None:
        return {"doc": doc, "title": title, "path": "", "desc": "", "subsections": [], "keywords": []}
    h1 = page.find("h1")
    title2 = text_of(h1) if h1 else title
    # section path from anchors
    path = ""
    for a in page.find_all("a"):
        aid = a.get("id") or ""
        if aid.startswith("CP2K_INPUT."):
            path = aid
            break
    if not path:
        path = "CP2K_INPUT." + doc.replace("CP2K_INPUT/", "").replace("/", ".")
    # short description: first p that is not inside keyword/subsection blocks
    desc = ""
    for p in page.find_all("p", recursive=False):
        t = text_of(p)
        if t and not t.startswith("Mentions") and "Edit on GitHub" not in t:
            desc = t
            break
    subs = []
    tw = page.find("div", class_="toctree-wrapper")
    if tw:
        for a in tw.find_all("a"):
            subs.append({"text": text_of(a), "href": a.get("href", "")})
    kws = []
    for div in page.find_all("div", class_="cp2k-input-keyword"):
        k = parse_keyword(div)
        if k and k["name"]:
            kws.append(k)
    return {"doc": doc, "title": title2, "path": path, "desc": desc,
            "subsections": subs, "keywords": kws}


# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="")
    ap.add_argument("--workers", type=int, default=10)
    args = ap.parse_args()

    docs = load_docnames()
    if args.only:
        docs = [d for d in docs if d["kind"] == args.only]
    if args.limit:
        docs = docs[: args.limit]
    print("docs to crawl:", len(docs))

    os.makedirs(os.path.join(SRC, "narrative"), exist_ok=True)
    os.makedirs(os.path.join(SRC, "input"), exist_ok=True)

    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=args.workers, pool_maxsize=args.workers)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    done = ok = fail = 0
    t0 = time.time()
    errors = []

    def work(d):
        html = fetch(session, d["doc"])
        if d["kind"] == "input":
            rec = parse_input(html, d["doc"], d["title"])
        else:
            rec = parse_narrative(html, d["doc"], d["title"])
        out = os.path.join(SRC, d["kind"], d["doc"].replace("/", "__") + ".json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False)
        return len(html)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(work, d): d for d in docs}
        for fut in as_completed(futs):
            d = futs[fut]
            done += 1
            try:
                fut.result()
                ok += 1
            except Exception as e:  # noqa: BLE001
                fail += 1
                errors.append({"doc": d["doc"], "error": str(e)})
            if done % 100 == 0 or done == len(docs):
                el = time.time() - t0
                print("progress %d/%d ok=%d fail=%d %.1f pages/s" % (done, len(docs), ok, fail, done / el), flush=True)

    with open(os.path.join(SRC, "meta.json"), "w", encoding="utf-8") as f:
        json.dump([{k: d[k] for k in ("doc", "title", "kind")} for d in load_docnames()], f, ensure_ascii=False)
    if errors:
        with open(os.path.join(SRC, "errors.json"), "w", encoding="utf-8") as f:
            json.dump(errors, f, ensure_ascii=False, indent=1)
    print("done. ok=%d fail=%d in %.1fs" % (ok, fail, time.time() - t0))


if __name__ == "__main__":
    main()