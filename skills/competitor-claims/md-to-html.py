"""Convert the competitor-claims report markdown to print-ready standalone HTML.

Usage: python3 md-to-html.py <input.md> <output.html>

Handles the markdown subset the report uses: #/##/### headers, pipe tables,
-/1. lists, **bold**, *italic*, --- rules, paragraphs. Table header rows render
white-on-dark even when cells are bolded (th strong inherits the header color).
"""
import html as html_mod
import re
import sys

if len(sys.argv) != 3:
    sys.exit("usage: md-to-html.py <input.md> <output.html>")
SRC, OUT = sys.argv[1], sys.argv[2]

text = open(SRC).read()


def inline(s):
    s = html_mod.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<em>\1</em>", s)
    return s


body = []
title = "Report"
lines = text.split("\n")
i = 0
in_ul = in_ol = False


def close_lists():
    global in_ul, in_ol
    if in_ul:
        body.append("</ul>")
        in_ul = False
    if in_ol:
        body.append("</ol>")
        in_ol = False


while i < len(lines):
    line = lines[i]
    if line.startswith("|"):
        close_lists()
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            rows.append(lines[i])
            i += 1
        body.append("<table>")
        for r_idx, r in enumerate(rows):
            if re.match(r"^\|[\s:|-]+\|$", r):
                continue
            cells = [c.strip() for c in r.strip().strip("|").split("|")]
            tag = "th" if r_idx == 0 else "td"
            body.append("<tr>" + "".join(f"<{tag}>{inline(c)}</{tag}>" for c in cells) + "</tr>")
        body.append("</table>")
        continue
    if line.startswith("### "):
        close_lists()
        body.append(f"<h3>{inline(line[4:])}</h3>")
    elif line.startswith("## "):
        close_lists()
        body.append(f"<h2>{inline(line[3:])}</h2>")
    elif line.startswith("# "):
        close_lists()
        title = re.sub(r"<[^>]+>", "", inline(line[2:]))
        body.append(f"<h1>{inline(line[2:])}</h1>")
    elif line.startswith("- "):
        if not in_ul:
            close_lists()
            body.append("<ul>")
            in_ul = True
        body.append(f"<li>{inline(line[2:])}</li>")
    elif re.match(r"^\d+\. ", line):
        if not in_ol:
            close_lists()
            body.append("<ol>")
            in_ol = True
        item = re.sub(r"^\d+\. ", "", line)
        body.append(f"<li>{inline(item)}</li>")
    elif line.strip() == "---":
        close_lists()
        body.append("<hr>")
    elif line.strip() == "":
        close_lists()
    else:
        close_lists()
        body.append(f"<p>{inline(line)}</p>")
    i += 1
close_lists()

CSS = """
@page { size: A4; margin: 14mm 12mm; }
body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e;
       font-size: 10.5px; line-height: 1.55; max-width: 980px; margin: 0 auto; padding: 12px; }
h1 { font-size: 21px; color: #0f2557; border-bottom: 3px solid #0f2557; padding-bottom: 8px; }
h2 { font-size: 15px; color: #0f2557; margin-top: 22px; border-bottom: 1px solid #c9d4ea; padding-bottom: 4px; }
h3 { font-size: 12.5px; color: #1d3f8f; margin-top: 16px; margin-bottom: 4px; }
p, li { text-align: justify; }
table { border-collapse: collapse; width: 100%; font-size: 7.6px; line-height: 1.35; margin: 10px 0; }
th, td { border: 1px solid #b9c5dd; padding: 4px 5px; vertical-align: top; text-align: left; }
th { background: #0f2557; color: #fff; }
th strong, th em { color: inherit; }  /* keep bolded column titles visible on the dark header */
tr td:first-child { font-weight: 700; background: #eef2fa; }
tr:nth-child(even) td { background: #f7f9fd; }
tr:nth-child(even) td:first-child { background: #e6ecf8; }
hr { border: none; border-top: 1px solid #c9d4ea; margin: 16px 0; }
strong { color: #0f2557; }
@media print { body { padding: 0; } h2, h3 { page-break-after: avoid; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
"""

doc = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>{title}</title>
<style>{CSS}</style></head>
<body>
{chr(10).join(body)}
</body></html>"""

open(OUT, "w").write(doc)
print(f"wrote {OUT} ({len(doc)} bytes)")
