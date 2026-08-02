#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/dedup_person_entities.py

Deduplicates person entities extracted in entities_part1-4.json.

Canonical ID Selection Rule:
----------------------------
For each automatically confirmed group of duplicate person entities, the canonical ID is chosen as:
1. The ID with the HIGHEST number of own statements in statements_persoane_part1-3.json (subject or object).
2. If statement counts are equal, the ALPHABETICALLY EARLIEST ID is chosen as tie-breaker.

Outputs generated:
------------------
- data/_import/etl_output/id_map.json (Extended, preserving existing house/location/event mappings)
- data/_import/entitati_ambigue_persoane_needecise.json (Ambiguous candidate groups for manual decision)
- data/_import/entitati_de_spart.json (Concatenated ghost entities and their statements for manual splitting)
"""

import json
import glob
import re
import os
import sys

def normalize_text(text):
    if not text:
        return ""
    text = text.lower()
    repl = {'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't'}
    for k, v in repl.items():
        text = text.replace(k, v)
    text = re.sub(r'[^\w\s]', ' ', text)
    return " ".join(text.split())

def strip_titles(name):
    if not name:
        return ""
    clean = re.sub(r"\(.*?\)", "", name)
    clean = re.sub(r'["“„”]', '', clean)
    clean = re.sub(r'/.*$', '', clean)
    titles = [
        r"^lordul\s+", r"^lady\s+", r"^regele\s+", r"^regina\s+", r"^ser\s+", r"^sir\s+",
        r"^maester\s+", r"^principele\s+", r"^prințul\s+", r"^printul\s+", r"^lord\s+",
        r"^comandantul\s+", r"^septul\s+", r"^septa\s+"
    ]
    for t in titles:
        clean = re.sub(t, "", clean, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def extract_name_variants(p):
    raw_name = p.get("nume_canonic") or ""
    aliases = p.get("aliasuri") or []
    
    variants = set()
    norm_raw = normalize_text(raw_name)
    if norm_raw:
        variants.add(norm_raw)

    # Remove title prefixes
    name_no_title = strip_titles(raw_name)
    norm_no_title = normalize_text(name_no_title)
    if norm_no_title:
        variants.add(norm_no_title)

    # 1. Remove text inside quotes e.g. Eddard „Ned" Stark -> Eddard Stark, Ned
    m_quotes = re.search(r'^(.*?)\s*["“„”](.*?)["“„”]\s*(.*)$', name_no_title)
    if m_quotes:
        b = m_quotes.group(1).strip()
        q = m_quotes.group(2).strip()
        a = m_quotes.group(3).strip()
        v_no_quote = normalize_text(f"{b} {a}")
        if v_no_quote: variants.add(v_no_quote)
        v_quote_name = normalize_text(f"{q} {a}")
        if v_quote_name: variants.add(v_quote_name)
        v_q = normalize_text(q)
        if v_q: variants.add(v_q)

    # 2. Handle parenthetical text e.g. Catelyn Tully (Stark) or Ned (Eddard) Stark
    m_paren = re.search(r"^(.*?)\s*\((.*?)\)\s*(.*)$", name_no_title)
    if m_paren:
        before = m_paren.group(1).strip()
        inside = m_paren.group(2).strip()
        after = m_paren.group(3).strip()
        
        v1 = normalize_text(f"{before} {after}")
        if v1: variants.add(v1)
        v2 = normalize_text(f"{inside} {after}")
        if v2: variants.add(v2)
        # If inside is a surname like "Stark" or "Tully", combine with first name of before
        words_before = before.split()
        if words_before and len(inside.split()) == 1:
            v_combo = normalize_text(f"{words_before[0]} {inside}")
            if v_combo: variants.add(v_combo)
        v3 = normalize_text(inside)
        if v3: variants.add(v3)

    # 3. Handle comma separated epithets e.g. Robb Stark, „Tânărul Lup"
    if "," in name_no_title:
        parts = [sp.strip() for sp in name_no_title.split(",")]
        for pt in parts:
            pt_clean = re.sub(r'["“„”]', '', pt).strip()
            norm_pt = normalize_text(pt_clean)
            if norm_pt: variants.add(norm_pt)

    for a in aliases:
        norm_a = normalize_text(a)
        if norm_a: variants.add(norm_a)

    return {v for v in variants if len(v) > 1}

def get_person_surname(p):
    raw_name = p.get("nume_canonic") or ""
    core = strip_titles(raw_name)
    tokens = normalize_text(core).split()
    if len(tokens) >= 2:
        return tokens[-1]
    return ""

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    import_dir = os.path.join(root_dir, "data", "_import")
    etl_output_dir = os.path.join(import_dir, "etl_output")

    # 1. Load person entities
    persons = []
    for path in sorted(glob.glob(os.path.join(import_dir, "entities_part*.json"))):
        if "additions" in path:
            continue
        with open(path, "r", encoding="utf-8") as f:
            for e in json.load(f):
                if e.get("tip") == "persoana":
                    e["_file"] = os.path.basename(path)
                    persons.append(e)

    persons_by_id = {p["id"]: p for p in persons}
    print(f"Loaded {len(persons)} person entities from entities_part1-4.json.")

    # 2. Load statements to count own statements per person ID & collect statements for split entities
    stmt_counts = {p["id"]: 0 for p in persons}
    person_statements = {p["id"]: [] for p in persons}
    
    for path in sorted(glob.glob(os.path.join(import_dir, "statements_persoane_part*.json"))):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for s in data:
                subj = s.get("subject")
                obj = s.get("object")
                if subj in stmt_counts:
                    stmt_counts[subj] += 1
                    person_statements[subj].append(s)
                if obj in stmt_counts:
                    stmt_counts[obj] += 1
                    person_statements[obj].append(s)

    # 3. Detect "entități de spart" (split entities)
    split_entities = []
    split_ids = set()
    
    title_words = ["numit", "zis", "lord", "lady", "sir", "ser", "rege", "regina", "print", "prinț", "fiu", "fiica", "fiică", "frate", "sora", "soră", "maestru", "comandant", "primul", "fata", "cavaler"]
    
    for p in persons:
        pid = p["id"]
        name = p.get("nume_canonic") or ""
        aliases = p.get("aliasuri") or []
        
        # Strip text inside parentheses for name-based split detection
        # Parenthetical text contains aliases/nicknames, not separate person names
        name_no_paren = re.sub(r"\(.*?\)", "", name).strip()
        
        reasons = []
        if "_SI_" in pid or "_AND_" in pid:
            if not any(w in pid for w in ["_VEZI_SI_", "_3A"]):
                reasons.append("ID contains _SI_ or _AND_")
        elif pid in ["PERSON_BRAN_STARK_RICKON_STARK", "PERSON_BRAN_STARK_SI_RICKON_STARK", "PERSON_ARYA_STARK_GENDRY"]:
            reasons.append("Known concatenated ID")
        elif " și " in name_no_paren.lower() or " si " in name_no_paren.lower():
            if not any(t in name_no_paren.lower() for t in ["vezi", "anexa", "3a"]):
                reasons.append("Name contains 'și' / 'si'")
        elif "," in name_no_paren:
            subparts = [sp.strip() for sp in name_no_paren.split(",")]
            if len(subparts) == 2:
                sp1, sp2 = subparts[0], subparts[1]
                words2 = sp2.split()
                if words2 and words2[0][0].isupper() and not any(w in normalize_text(sp2) for w in title_words):
                    if not (sp2.startswith('"') or sp2.startswith('(')):
                        reasons.append(f"Name contains multiple person names: '{sp1}' + '{sp2}'")

        if reasons:
            split_ids.add(pid)
            raw_parts = [sp.strip() for sp in re.split(r" și | si | & |, | / ", name) if sp.strip()]
            split_entities.append({
                "id_original": pid,
                "nume_canonic": name,
                "aliasuri": aliases,
                "nume_concatenate_presupuse": raw_parts,
                "motiv_detectie": reasons,
                "sursa": p.get("_file"),
                "numar_afirmatii": len(person_statements.get(pid, [])),
                "afirmatii": person_statements.get(pid, [])
            })

    print(f"Detected {len(split_entities)} split entities ('entități de spart').")

    # 4. Group candidate unifications & ambiguous cases for remaining entities
    remaining = [p for p in persons if p["id"] not in split_ids]

    # Step 4: Transitive graph clustering over name variants under the same surname/first name
    # Build candidate graph
    adj = {p["id"]: set() for p in remaining}
    
    # 4A. Connect entities that share exact normalized core name or significant variant overlap
    # Group entities by surname or first name for comparison
    by_surname = {}
    for p in remaining:
        sn = get_person_surname(p)
        if sn:
            by_surname.setdefault(sn, []).append(p)
        else:
            # no surname (e.g. Aegon, Hodor, Gendry)
            norm_c = normalize_text(strip_titles(p.get("nume_canonic") or ""))
            if norm_c:
                first_w = norm_c.split()[0]
                by_surname.setdefault(first_w, []).append(p)

    for key, p_list in by_surname.items():
        if len(p_list) <= 1:
            continue
        
        for i in range(len(p_list)):
            p1 = p_list[i]
            vars1 = extract_name_variants(p1)
            core1 = normalize_text(strip_titles(p1.get("nume_canonic") or ""))
            
            for j in range(i + 1, len(p_list)):
                p2 = p_list[j]
                vars2 = extract_name_variants(p2)
                core2 = normalize_text(strip_titles(p2.get("nume_canonic") or ""))
                
                # Check for conflict: roman numerals (I vs II vs III) or historical kinship (unchiul, bunicul)
                num1 = set(re.findall(r"\b(I|II|III|IV|V|VI)\b", p1.get("nume_canonic") or ""))
                num2 = set(re.findall(r"\b(I|II|III|IV|V|VI)\b", p2.get("nume_canonic") or ""))
                if num1 and num2 and num1 != num2:
                    continue
                    
                has_kinship1 = any(k in (p1.get("nume_canonic") or "").lower() for k in ["unchiul", "bunicul", "tatal", "tatăl", "fostul"])
                has_kinship2 = any(k in (p2.get("nume_canonic") or "").lower() for k in ["unchiul", "bunicul", "tatal", "tatăl", "fostul"])
                if has_kinship1 or has_kinship2:
                    continue

                # Check variant overlap
                overlap = vars1.intersection(vars2)
                is_match = False
                
                if core1 and core2 and core1 == core2:
                    is_match = True
                elif overlap:
                    for v in overlap:
                        if key in v or v in ["ned", "tanarul lup", "alayne", "catelyn stark", "eddard stark"]:
                            is_match = True
                            break

                if is_match:
                    adj[p1["id"]].add(p2["id"])
                    adj[p2["id"]].add(p1["id"])

    # 4B. Find connected components
    visited = set()
    auto_unified_groups = []
    needecise_groups = []

    for p in remaining:
        pid = p["id"]
        if pid in visited:
            continue
        
        # BFS to find component
        component = []
        queue = [pid]
        visited.add(pid)
        
        while queue:
            curr = queue.pop(0)
            component.append(persons_by_id[curr])
            for nxt in adj[curr]:
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)

        if len(component) > 1:
            group_ids = [comp["id"] for comp in component]
            sorted_group = sorted(component, key=lambda comp: (-stmt_counts[comp["id"]], comp["id"]))
            canonical_id = sorted_group[0]["id"]
            
            auto_unified_groups.append({
                "id_canonic": canonical_id,
                "grup_id_uri": group_ids,
                "motiv": f"Unificare automată pe nume canonic/variante/alias",
                "entitati": [{
                    "id": comp["id"],
                    "nume_canonic": comp.get("nume_canonic"),
                    "aliasuri": comp.get("aliasuri"),
                    "sursa": comp.get("_file"),
                    "numar_afirmatii": stmt_counts[comp["id"]]
                } for comp in sorted_group]
            })

    # Step 4C: Identify suspicious surname overlaps (same surname, different first names or uncertain) for needecise
    for surname, p_list in by_surname.items():
        if len(p_list) >= 2:
            for i in range(len(p_list)):
                for j in range(i + 1, len(p_list)):
                    p1 = p_list[i]
                    p2 = p_list[j]
                    # check if they are in different components but have similar first names
                    t1 = normalize_text(strip_titles(p1.get("nume_canonic") or "")).split()
                    t2 = normalize_text(strip_titles(p2.get("nume_canonic") or "")).split()
                    if t1 and t2:
                        f1, f2 = t1[0], t2[0]
                        if f1 != f2 and (f1.startswith(f2[:3]) or f2.startswith(f1[:3])) and f1 not in ["lordul", "lady", "regele"] and f2 not in ["lordul", "lady", "regele"]:
                            needecise_groups.append({
                                "candidate_ids": [p1["id"], p2["id"]],
                                "motiv_suspiciune": f"Nume de familie comun ({surname.capitalize()}) și prenume similare ({f1.capitalize()} vs {f2.capitalize()}) dar neidentice",
                                "entitati": [
                                    {"id": p1["id"], "nume_canonic": p1.get("nume_canonic"), "sursa": p1.get("_file"), "numar_afirmatii": stmt_counts[p1["id"]]},
                                    {"id": p2["id"], "nume_canonic": p2.get("nume_canonic"), "sursa": p2.get("_file"), "numar_afirmatii": stmt_counts[p2["id"]]}
                                ]
                            })

    print(f"Auto-unified groups: {len(auto_unified_groups)}")
    print(f"Needecise groups: {len(needecise_groups)}")

    # 5. Extend id_map.json
    id_map_path = os.path.join(etl_output_dir, "id_map.json")
    with open(id_map_path, "r", encoding="utf-8") as f:
        id_map = json.load(f)

    new_id_map_entries = {}
    for group in auto_unified_groups:
        canonical_id = group["id_canonic"]
        for member_id in group["grup_id_uri"]:
            if member_id == canonical_id:
                entry = {
                    "app_id": canonical_id,
                    "collection": "persoane",
                    "status": "canonical",
                    "candidates": [canonical_id]
                }
            else:
                entry = {
                    "app_id": canonical_id,
                    "collection": "persoane",
                    "status": "redirect",
                    "candidates": [canonical_id]
                }
            id_map[member_id] = entry
            new_id_map_entries[member_id] = entry

    with open(id_map_path, "w", encoding="utf-8") as f:
        json.dump(id_map, f, indent=2, ensure_ascii=False)

    print(f"Updated id_map.json with {len(new_id_map_entries)} person mappings.")

    # 6. Write entitati_ambigue_persoane_needecise.json
    needecise_path = os.path.join(import_dir, "entitati_ambigue_persoane_needecise.json")
    with open(needecise_path, "w", encoding="utf-8") as f:
        json.dump(needecise_groups, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(needecise_groups)} ambiguous groups to {needecise_path}.")

    # 7. Write entitati_de_spart.json
    spart_path = os.path.join(import_dir, "entitati_de_spart.json")
    with open(spart_path, "w", encoding="utf-8") as f:
        json.dump(split_entities, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(split_entities)} split entities to {spart_path}.")

    print("\n=================== DEDUP PERSON SUMMARY ===================")
    print(f"Auto-unified groups count: {len(auto_unified_groups)}")
    print(f"Needecise groups count: {len(needecise_groups)}")
    print(f"Split entities count: {len(split_entities)}")
    print(f"New entries in id_map.json: {len(new_id_map_entries)}")

    stark_groups = [g for g in auto_unified_groups if any("STARK" in pid for pid in g["grup_id_uri"])]
    print(f"\nStark Family Unified Groups ({len(stark_groups)}):")
    for g in stark_groups:
        print(f"  Canonical ID: {g['id_canonic']} <- Members: {g['grup_id_uri']}")

if __name__ == "__main__":
    main()
