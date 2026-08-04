"""Re-shard the Email Engine planning docs.

Boundaries are DERIVED from the headings each run, never hardcoded — the source
documents shift every time a section is added, and hardcoded line ranges drift
silently into dropped or duplicated content.
"""
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

SRC = {
    "arch": ("Email Engine Architecture.md", "Architecture", "docs/architecture"),
    "prd":  ("Email Engine PRD.md",          "PRD",          "docs/prd"),
    "fes":  ("Email Engine Front-End Spec.md","Front-End Spec","docs/front-end-spec"),
}

# section number -> output filename
ARCH = {2:"high-level-architecture",3:"tech-stack",4:"components",5:"data-models",
        6:"database-schema",7:"rest-api-spec",8:"core-workflows",9:"frontend-architecture",
        10:"backend-architecture",11:"source-tree",12:"deployment",
        13:"security-and-performance",14:"testing-strategy",15:"coding-standards"}
PRD  = {1:"goals-and-background-context",2:"requirements",3:"user-interface-design-goals",
        4:"technical-assumptions",7:"checklist-results",8:"open-questions",9:"next-steps"}
FES  = {1:"design-principles",2:"information-architecture",3:"core-loop",
        4:"supervision-surface",5:"user-flows",6:"screen-specifications",
        7:"component-map",8:"keyboard-model",9:"states-and-errors",10:"responsive",
        11:"accessibility",12:"motion-and-budgets",13:"decisions-and-handoff"}
EPIC_SLUG = {1:"epic-1-foundation-and-tenancy",2:"epic-2-mailbox-connection-and-ingest",
             3:"epic-3-inbox-ui",4:"epic-4-knowledge-base",5:"epic-5-ai-reply-engine",
             6:"epic-6-sending-and-automation",7:"epic-7-public-api-and-webhooks",
             8:"epic-8-analytics-billing-and-hardening"}

def headings(lines, pattern):
    """-> {number: line_index} for headings matching pattern."""
    out = {}
    for i, ln in enumerate(lines):
        m = re.match(pattern, ln)
        if m:
            out[int(m.group(1))] = i
    return out

def write(out_path, src_name, label, section, lines, a, b):
    url = src_name.replace(" ", "%20")
    body = "".join(lines[a:b]).rstrip("\n")
    out_path.write_text(
        f"> **Shard of [{label}](../../{url}) {section}.**\n"
        f"> Derived file — edit the source document and re-shard, never this copy.\n\n"
        f"{body}\n", encoding="utf-8")
    return body.count("\n") + 1

def main():
    total, report = 0, []
    for key, (fname, label, outdir) in SRC.items():
        src = ROOT / fname
        lines = src.read_text(encoding="utf-8").splitlines(keepends=True)
        outp = ROOT / outdir
        secs = headings(lines, r"^## (\d+)\.")
        order = sorted(secs)
        # end of section n = start of next ## heading, or EOF
        def span(n):
            i = order.index(n)
            return secs[n], (secs[order[i+1]] if i + 1 < len(order) else len(lines))

        table = {"arch": ARCH, "prd": PRD, "fes": FES}[key]
        covered = []
        for num, slug in table.items():
            if num not in secs:
                report.append(f"  !! §{num} not found in {fname}")
                continue
            a, b = span(num)
            n = write(outp / f"{slug}.md", fname, label, f"§{num}", lines, a, b)
            covered.append((a, b)); total += 1

        if key == "prd":
            epics = headings(lines, r"^### Epic (\d+) ")
            eorder = sorted(epics)
            # epic-list: §5 through the first epic heading (captures §6's preamble)
            a5, _ = span(5)
            first_epic = epics[eorder[0]]
            n = write(outp / "epic-list.md", fname, label, "§5–§6 preamble",
                      lines, a5, first_epic); total += 1
            covered.append((a5, first_epic))
            for i, num in enumerate(eorder):
                a = epics[num]
                b = epics[eorder[i+1]] if i + 1 < len(eorder) else span(7)[0]
                n = write(outp / f"{EPIC_SLUG[num]}.md", fname, label,
                          f"§6 Epic {num}", lines, a, b); total += 1
                covered.append((a, b))

        # contiguity check over the covered span
        covered.sort()
        gaps = []
        for (a1, b1), (a2, b2) in zip(covered, covered[1:]):
            if a2 < b1:   gaps.append(f"OVERLAP at line {a2+1}")
            elif a2 > b1: gaps.append(f"GAP lines {b1+1}-{a2}")
        report.append(f"{fname}: {len(covered)} shards, lines {covered[0][0]+1}-{covered[-1][1]} | "
                      + ("; ".join(gaps) if gaps else "contiguous"))

    print("\n".join(report))
    print(f"\n{total} shards written")

    # every shard must begin on a heading
    # A shard identifies itself by its breadcrumb. Anything else under docs/ —
    # index.md, story files, the traceability matrix — is authored, not derived,
    # and must not be checked as a slice (or silently overwritten by a future
    # run). Detecting that from the file beats maintaining an exclusion list.
    bad, checked = [], 0
    for f in sorted((ROOT/"docs").glob("*/*.md")):
        lines = f.read_text(encoding="utf-8").splitlines()
        if not lines or not lines[0].startswith("> **Shard of"): continue
        checked += 1
        rest = [l for l in lines[2:] if l.strip() and l.strip() != "---"]
        if not rest or not rest[0].startswith("#"):
            bad.append(f"{f.relative_to(ROOT)} -> {rest[0][:50] if rest else 'EMPTY'}")
    print(f"heading check ({checked} shards): "
          + ("ALL OK" if not bad else "FAILED\n  " + "\n  ".join(bad)))

main()
