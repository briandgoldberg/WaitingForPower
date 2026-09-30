"""Candidate opposition records from the Sabin Center's contested-projects data.

Run by .github/workflows/opposition-candidates.yml (GitHub's runners can reach
oppositionreport.org and waitingforpower.com; the Claude Code cloud
environment can't). Downloads the Sabin Center's "Contested Project data"
file and this site's project export, and prints each Sabin project next to
the tracked projects in the same state and county whose names share a
distinctive word with it. Nothing here writes data: a person (or the weekly
research routine) reads each candidate, confirms it's the same project, and
adds a record to src/lib/ingest/opposition.ts by hand.

Modes:
  inspect  print the data file's link, format and first rows
  match    print candidate matches
  dump     print the full text of the Sabin rows whose Post iD is listed
           after it (space-separated), with HTML stripped
"""

import csv
import html
import io
import json
import os
import re
import sys
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
REPORT_PAGE = "https://oppositionreport.org/reports/current/"
EXPORT = "https://waitingforpower.com/api/export?format=csv&status=all"

# Words too common in project names to identify one.
GENERIC = set(
    """solar wind energy power project projects center centre farm farms park station storage battery bess
    facility facilities llc inc co company renewable renewables generating generation plant county the of and
    at in on phase i ii iii iv expansion new north south east west transmission line kv mw hybrid clean green
    energy's development partners holdings""".split()
)

STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO",
    "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
    "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}


FUELS_BY_TYPE = {
    "solar": {"solar"},
    "wind": {"wind_onshore", "wind_offshore"},
    "battery storage": {"storage"},
    "storage": {"storage"},
    "transmission": {"transmission"},
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read(), r.headers.get("Content-Type", "")


def data_link():
    page = get(REPORT_PAGE)[0].decode("utf-8", "replace")
    for href, text in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page, flags=re.S | re.I):
        t = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        if re.search(r"contested project data", t, re.I):
            return html.unescape(href)
    # Fall back to printing every candidate link so a person can pick.
    for href, text in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page, flags=re.S | re.I):
        t = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        if re.search(r"data|download", t, re.I):
            print("LINK:", t, "->", href)
    sys.exit("No 'Contested Project data' link found on " + REPORT_PAGE)


def rows_from(body, ctype, url):
    if url.lower().endswith((".xlsx", ".xls")) or "spreadsheet" in ctype or body[:2] == b"PK":
        import openpyxl

        wb = openpyxl.load_workbook(io.BytesIO(body), read_only=True)
        ws = wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        header = [str(h or "").strip() for h in next(it)]
        return [dict(zip(header, ["" if v is None else str(v) for v in row])) for row in it]
    if body.lstrip()[:1] in (b"[", b"{"):
        d = json.loads(body)
        return d if isinstance(d, list) else next(v for v in d.values() if isinstance(v, list))
    return list(csv.DictReader(io.StringIO(body.decode("utf-8-sig", "replace"))))


def words(s):
    return {w for w in re.findall(r"[a-z0-9']+", (s or "").lower()) if len(w) > 2 and w not in GENERIC}


def norm_county(s):
    return re.sub(r"\b(county|parish|borough|township|town|city|of)\b", "", (s or "").lower()).strip(" ,.")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    link = data_link()
    body, ctype = get(link)
    rows = rows_from(body, ctype, link)
    if mode == "dump":
        want = set(sys.argv[2:])
        for r in rows:
            if r.get("Post iD") in want:
                clean = {k: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", v or ""))).strip() for k, v in r.items()}
                print(json.dumps(clean, ensure_ascii=False))
        return
    if mode == "inspect":
        print("DATA LINK:", link)
        print("CONTENT-TYPE:", ctype, "ROWS:", len(rows))
        print("COLUMNS:", list(rows[0].keys()) if rows else None)
        for r in rows[:3]:
            print(json.dumps(r, ensure_ascii=False)[:3000])
        return

    ours = list(csv.DictReader(io.StringIO(get(EXPORT)[0].decode("utf-8-sig", "replace"))))
    by_state = {}
    for p in ours:
        for code in re.split(r"[^A-Z]+", p.get("state") or ""):
            if code:
                by_state.setdefault(code, []).append(p)

    shown = 0
    for r in rows:
        # "Origis Energy Solar Farm (Covington County)" -> the name without the place.
        name = re.sub(r"\s*\([^)]*\)\s*$", "", r.get("Title", "")).strip()
        code = (r.get("State") or "").strip().upper()
        counties = {norm_county(c) for c in re.split(r",| and |;|/", r.get("County") or "") if c.strip()}
        fuels = FUELS_BY_TYPE.get((r.get("Type") or "").strip().lower(), set())
        pending = (r.get("Status") or "").strip().lower() == "pending"
        sw = words(name) | words(r.get("Municipality"))
        cands = []
        for p in by_state.get(code, []):
            pw = words(p["name"]) | words(p.get("applicant"))
            shared = sw & pw
            same_county = bool(counties) and norm_county(p.get("county")) in counties
            same_fuel = p.get("fuel_type") in fuels
            # A shared distinctive word, or (for a project Sabin lists as
            # still pending) the same county and technology.
            if (shared and (same_county or len(shared) >= 2 or not p.get("county"))) or (pending and same_county and same_fuel):
                cands.append((2 * len(shared) + same_county + same_fuel, p, shared, same_county))
        if not cands:
            continue
        cands.sort(key=lambda c: -c[0])
        shown += 1
        print("=" * 100)
        print(f"SABIN #{r.get('Post iD')}: {r.get('Title')} | {code} | {r.get('Municipality')} | {r.get('Type')} {r.get('Capacity')}MW | status={r.get('Status')} last_event={r.get('Date of Last Event')} litigation={r.get('Litigation')}")
        print("  CONTENT:", (r.get("Content") or "")[:1500])
        print("  CITATIONS:", (r.get("Citations") or "")[:1200])
        for score, p, shared, same_county in cands[:4]:
            print(
                f"  CANDIDATE score={score} county_match={same_county} shared={sorted(shared)} "
                f"slug={p['slug']} | {p['name']} | {p.get('county')}, {p.get('state')} | {p.get('fuel_type')} "
                f"{p.get('capacity_value')}{p.get('capacity_unit')} | stage={p.get('current_stage')} | applicant={p.get('applicant')}"
            )
    print(f"SABIN PROJECTS: {len(rows)}  WITH CANDIDATES: {shown}  TRACKED PROJECTS: {len(ours)}")


if __name__ == "__main__":
    main()
