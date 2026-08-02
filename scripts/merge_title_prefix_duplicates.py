#!/usr/bin/env python3
"""Unifică duplicatele confirmate din title_prefix_duplicates.json
și clusterele din duplicate_identities_needs_review.json cu scor ≥ 0.85.

Excluderi manuale: cluster_001 (Aegon cel Nesigur vs Aegon II — persoane diferite).

Reguli de consolidare:
- Intrare principală: cea cu scor_total mai mare (sau mai multe câmpuri populate)
- titles: combine deduplicate (exact_unique)
- relații familiale: unire seturi
- moarte: păstrează descrierea cu confidence mai ridicat
- id_intern secundar → aliasuri
- actualizare referințe inverse în tot characters.json
- actualizare id_map.json
"""

from __future__ import annotations

import copy
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_PATH = ROOT / "data" / "characters" / "characters.json"
OUTPUT_DIR = ROOT / "data" / "_import" / "etl_output"
TITLE_PREFIX_DUPS_PATH = OUTPUT_DIR / "title_prefix_duplicates.json"
CLUSTER_DUPS_PATH = OUTPUT_DIR / "duplicate_identities_needs_review.json"
ID_MAP_PATH = OUTPUT_DIR / "id_map.json"

CONFIDENCE_ORDER = {"uncertain": 0, "probable": 1, "confirmed": 2, None: -1}

# Clustere excluse manual (persoane diferite confirmate)
EXCLUDED_CLUSTERS = {"cluster_001"}  # Aegon V vs Aegon II Targaryen

# Pragul de scor pentru unificare automată a clusterelor existente
SCORE_THRESHOLD = 0.85

ARRAY_RELATION_KEYS = ("parinti", "copii", "frati", "casatorit_cu",
                       "possible_parent_of", "age_at", "member_of")


def read_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def exact_unique(items: list) -> list:
    """Deduplică o listă de elemente (string sau dict) păstrând ordinea."""
    result, seen = [], set()
    for item in items:
        marker = json.dumps(item, ensure_ascii=False, sort_keys=True) if isinstance(item, dict) else str(item)
        if marker not in seen:
            result.append(copy.deepcopy(item) if isinstance(item, dict) else item)
            seen.add(marker)
    return result


def is_missing(value):
    """Verifică dacă o valoare e 'goală' (None, "", [], {})."""
    return value is None or value == "" or value == [] or value == {}


def get_scor_total(char: dict) -> float:
    """Extrage _completitudine.scor_total sau -1 dacă nu există."""
    c = char.get("_completitudine")
    if isinstance(c, dict):
        s = c.get("scor_total")
        if isinstance(s, (int, float)):
            return float(s)
    return -1.0


def count_populated(char: dict) -> int:
    """Numără câmpuri populate (non-null, non-empty)."""
    count = 0
    for key in ("name", "description", "house", "born", "died", "locatie_asociata",
                "titlu_curent", "membru_al"):
        val = char.get(key)
        if val is not None and val != "" and val != []:
            count += 1
    for key in ("titles", "parinti", "copii", "frati", "casatorit_cu", "timeline", "surse"):
        val = char.get(key)
        if isinstance(val, list) and len(val) > 0:
            count += 1
    moarte = char.get("moarte")
    if isinstance(moarte, dict) and moarte.get("descriere"):
        count += 1
    return count


def select_primary(chars: list[dict]) -> tuple[dict, list[dict]]:
    """Selectează intrarea principală din grup.
    
    Criterii (în ordine):
    1. scor_total mai mare
    2. Mai multe câmpuri populate  
    3. ID mai scurt (fără prefix de titlu)
    
    Returns: (primary, [secondaries])
    """
    scored = []
    for c in chars:
        scored.append((get_scor_total(c), count_populated(c), -len(c.get("id", "")), c))
    
    scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    
    primary = scored[0][3]
    secondaries = [s[3] for s in scored[1:]]
    return primary, secondaries


def merge_moarte(existing: dict | None, incoming: dict | None) -> dict:
    """Consolidează câmpul moarte. Păstrează descrierea cu confidence mai ridicat."""
    if is_missing(existing) or is_missing(existing if not isinstance(existing, dict) else existing.get("descriere")):
        if isinstance(incoming, dict) and incoming.get("descriere"):
            return copy.deepcopy(incoming)
        return existing or {"descriere": None, "confidence": None}
    
    if is_missing(incoming) or not isinstance(incoming, dict) or is_missing(incoming.get("descriere")):
        return copy.deepcopy(existing) if isinstance(existing, dict) else {"descriere": None, "confidence": None}
    
    # Ambele au descriere — selectează pe baza confidence
    ex_conf = CONFIDENCE_ORDER.get(existing.get("confidence"), -1)
    in_conf = CONFIDENCE_ORDER.get(incoming.get("confidence"), -1)
    
    result = copy.deepcopy(existing)
    
    if in_conf > ex_conf:
        # Incoming e mai sigur — swap
        old_desc = result.get("descriere")
        result["descriere"] = incoming.get("descriere")
        result["confidence"] = incoming.get("confidence")
        # Salvează vechea descriere ca variantă
        variante = result.get("variante") or []
        if isinstance(variante, list):
            if old_desc and old_desc != incoming.get("descriere"):
                variante.append({"descriere": old_desc, "confidence": existing.get("confidence")})
        result["variante"] = variante
    else:
        # Existing e mai sigur — adaugă incoming ca variantă
        variante = result.get("variante") or []
        if isinstance(variante, list):
            inc_desc = incoming.get("descriere")
            if inc_desc and inc_desc != result.get("descriere"):
                variante.append({"descriere": inc_desc, "confidence": incoming.get("confidence")})
        result["variante"] = variante if variante else None
    
    return result


def merge_character(primary: dict, secondary: dict) -> dict:
    """Combină un personaj secundar în cel primar.
    
    Refolosește logica din merge_characters_nivel4.py cu adăugiri.
    """
    result = copy.deepcopy(primary)
    
    # 1. Câmpuri scalare: păstrează existentul non-null, completează din secundar
    for key in ("titlu_curent", "membru_al", "locatie_asociata", "description",
                "house", "born", "died", "canon"):
        if is_missing(result.get(key)) and not is_missing(secondary.get(key)):
            result[key] = copy.deepcopy(secondary[key])
    
    # 2. moarte — consolidare cu regula de confidence
    result["moarte"] = merge_moarte(result.get("moarte"), secondary.get("moarte"))
    
    # 3. Relații familiale — unire seturi, eliminare duplicate
    for key in ARRAY_RELATION_KEYS:
        curr = result.get(key) or []
        inc = secondary.get(key) or []
        if isinstance(curr, list) and isinstance(inc, list):
            combined = list(dict.fromkeys(curr + inc))
            result[key] = combined
    
    # 4. Titles — combine deduplicate
    curr_titles = result.get("titles") or []
    inc_titles = secondary.get("titles") or []
    if curr_titles or inc_titles:
        result["titles"] = exact_unique(curr_titles + inc_titles)
    
    # 5. Timeline — combine deduplicate
    curr_tl = result.get("timeline") or []
    inc_tl = secondary.get("timeline") or []
    if curr_tl or inc_tl:
        result["timeline"] = exact_unique(curr_tl + inc_tl)
    
    # 6. Surse — combine deduplicate
    curr_surse = result.get("surse") or []
    inc_surse = secondary.get("surse") or []
    if curr_surse or inc_surse:
        result["surse"] = exact_unique(curr_surse + inc_surse)
    
    # 7. Aliasuri — adaugă id_intern al secundarului
    aliasuri = result.get("aliasuri") or []
    if not isinstance(aliasuri, list):
        aliasuri = []
    sec_id_intern = secondary.get("id_intern", "")
    if sec_id_intern and sec_id_intern not in aliasuri:
        aliasuri.append(sec_id_intern)
    # Adaugă și aliasurile secundarului
    for alias in (secondary.get("aliasuri") or []):
        if alias and alias not in aliasuri:
            aliasuri.append(alias)
    # Adaugă și id-ul app al secundarului ca alias
    sec_id = secondary.get("id", "")
    sec_id_as_intern = f"PERSON_{sec_id.upper()}" if sec_id else ""
    if sec_id_as_intern and sec_id_as_intern not in aliasuri and sec_id_as_intern != result.get("id_intern"):
        aliasuri.append(sec_id_as_intern)
    result["aliasuri"] = aliasuri
    
    # 8. _afirmatii_pe_predicat — merge arrays per predicate
    existing_afirm = result.get("_afirmatii_pe_predicat") or {}
    incoming_afirm = secondary.get("_afirmatii_pe_predicat") or {}
    merged_afirm = copy.deepcopy(existing_afirm)
    for pred, stmts in incoming_afirm.items():
        if pred not in merged_afirm:
            merged_afirm[pred] = copy.deepcopy(stmts)
        else:
            merged_afirm[pred] = exact_unique((merged_afirm[pred] or []) + (stmts or []))
    result["_afirmatii_pe_predicat"] = merged_afirm
    
    # 9. _completitudine — recalculează dacă există
    # Păstrăm doar cel mai bun scor
    pri_scor = get_scor_total(result)
    sec_scor = get_scor_total(secondary)
    if sec_scor > pri_scor and secondary.get("_completitudine"):
        result["_completitudine"] = copy.deepcopy(secondary["_completitudine"])
    
    return result


def main():
    print("═" * 70)
    print("  UNIFICARE DUPLICATE — MERGE")
    print("═" * 70)
    
    # ── Citire date ──────────────────────────────────────────────────────
    chars = read_json(CHARACTERS_PATH)
    initial_count = len(chars)
    print(f"\nPersonaje inițiale: {initial_count}")
    
    char_by_id = {c["id"]: c for c in chars}
    
    title_prefix_data = read_json(TITLE_PREFIX_DUPS_PATH) if TITLE_PREFIX_DUPS_PATH.exists() else {"grupuri_confirmate": []}
    cluster_data = read_json(CLUSTER_DUPS_PATH) if CLUSTER_DUPS_PATH.exists() else {"clustere_duplicate": []}
    id_map = read_json(ID_MAP_PATH) if ID_MAP_PATH.exists() else {}
    
    # ── Construire setul de grupuri de unificat ──────────────────────────
    
    # Sursă 1: title_prefix_duplicates.json (confirmate)
    merge_groups = []
    tp_count = 0
    for group in title_prefix_data.get("grupuri_confirmate", []):
        ids = group.get("id_uri", [])
        # Filtrare: doar ID-uri care există în characters.json
        valid_ids = [i for i in ids if i in char_by_id]
        if len(valid_ids) >= 2:
            merge_groups.append({
                "source": "title_prefix",
                "ids": valid_ids,
                "nume": group.get("nume_normalizat", "")
            })
            tp_count += 1
    
    print(f"Grupuri prefix-titlu confirmate: {tp_count}")
    
    # Sursă 2: duplicate_identities_needs_review.json (scor >= 0.85, excluse manuale)
    cluster_count = 0
    cluster_skipped = 0
    for cluster in cluster_data.get("clustere_duplicate", []):
        cid = cluster.get("cluster_id", "")
        score = cluster.get("scor_incredere", 0)
        
        if cid in EXCLUDED_CLUSTERS:
            print(f"  ⚠ Cluster exclus manual: {cid} ({cluster.get('nume_reprezentativ', '')})")
            cluster_skipped += 1
            continue
        
        if score < SCORE_THRESHOLD:
            cluster_skipped += 1
            continue
        
        ids = cluster.get("id_uri", [])
        valid_ids = [i for i in ids if i in char_by_id]
        if len(valid_ids) >= 2:
            merge_groups.append({
                "source": "cluster",
                "cluster_id": cid,
                "ids": valid_ids,
                "score": score,
                "nume": cluster.get("nume_reprezentativ", "")
            })
            cluster_count += 1
    
    print(f"Clustere existente unificate (scor ≥ {SCORE_THRESHOLD}): {cluster_count}")
    print(f"Clustere sărite (sub prag sau excluse): {cluster_skipped}")
    
    # ── Deduplicare grupuri (unele IDs pot fi în ambele surse) ────────────
    # Construiește un graf de echivalență
    equivalence = {}  # id → set of equivalent ids
    
    for group in merge_groups:
        ids = group["ids"]
        # Unește toate ID-urile din grup
        merged_set = set()
        for i in ids:
            if i in equivalence:
                merged_set |= equivalence[i]
            else:
                merged_set.add(i)
        
        # Actualizează toate referințele
        for i in merged_set:
            equivalence[i] = merged_set
    
    # Extrage grupuri unice
    seen = set()
    unique_groups = []
    for id_val, group_set in equivalence.items():
        key = frozenset(group_set)
        if key not in seen:
            seen.add(key)
            unique_groups.append(sorted(group_set))
    
    print(f"\nGrupuri unice de unificat (după deduplicare): {len(unique_groups)}")
    
    # ── Execuție unificare ───────────────────────────────────────────────
    
    # Mapping: id_secundar → id_primar (pentru actualizare referințe)
    redirect_map = {}  # secondary_id → primary_id
    id_intern_redirect = {}  # PERSON_SECONDARY → PERSON_PRIMARY
    
    merged_count = 0
    deleted_ids = set()
    
    for group_ids in unique_groups:
        group_chars = [char_by_id[i] for i in group_ids if i in char_by_id and i not in deleted_ids]
        if len(group_chars) < 2:
            continue
        
        primary, secondaries = select_primary(group_chars)
        primary_id = primary["id"]
        primary_id_intern = primary.get("id_intern", f"PERSON_{primary_id.upper()}")
        
        # Merge fiecare secundar în primar
        for sec in secondaries:
            sec_id = sec["id"]
            sec_id_intern = sec.get("id_intern", f"PERSON_{sec_id.upper()}")
            
            char_by_id[primary_id] = merge_character(char_by_id[primary_id], sec)
            
            # Tracking redirects
            redirect_map[sec_id] = primary_id
            id_intern_redirect[sec_id_intern] = primary_id_intern
            
            # Și redirect-uri pe baza ID-ului app convertit la format intern
            sec_app_as_intern = f"PERSON_{sec_id.upper()}"
            if sec_app_as_intern != sec_id_intern:
                id_intern_redirect[sec_app_as_intern] = primary_id_intern
            
            deleted_ids.add(sec_id)
            merged_count += 1
    
    print(f"\nTotal intrări secundare absorbite: {merged_count}")
    print(f"Total intrări de șters: {len(deleted_ids)}")
    
    # ── Actualizare referințe inverse ────────────────────────────────────
    
    print(f"\nActualizare referințe inverse...")
    refs_updated = 0
    
    for char_id, char in char_by_id.items():
        if char_id in deleted_ids:
            continue
        
        modified = False
        
        # Actualizează câmpurile relaționale
        for key in ARRAY_RELATION_KEYS:
            vals = char.get(key)
            if not isinstance(vals, list):
                continue
            
            new_vals = []
            for v in vals:
                if isinstance(v, str):
                    # Verifică redirect pe format id_intern (PERSON_...)
                    if v in id_intern_redirect:
                        new_v = id_intern_redirect[v]
                        if new_v != v:
                            modified = True
                            v = new_v
                    # Verifică redirect pe format app id  
                    elif v in redirect_map:
                        new_v = redirect_map[v]
                        if new_v != v:
                            modified = True
                            v = new_v
                new_vals.append(v)
            
            # Deduplicate
            deduped = list(dict.fromkeys(new_vals))
            if deduped != vals:
                char[key] = deduped
                modified = True
        
        # Actualizează referințe în casatorit_cu (deja acoperit de ARRAY_RELATION_KEYS dar verificăm explicit)
        # Și actualizează _afirmatii_pe_predicat
        afirm = char.get("_afirmatii_pe_predicat")
        if isinstance(afirm, dict):
            for pred, stmts in afirm.items():
                if not isinstance(stmts, list):
                    continue
                for stmt in stmts:
                    if isinstance(stmt, dict):
                        val = stmt.get("valoare")
                        if isinstance(val, str):
                            if val in id_intern_redirect:
                                stmt["valoare"] = id_intern_redirect[val]
                                modified = True
                            elif val in redirect_map:
                                stmt["valoare"] = redirect_map[val]
                                modified = True
        
        if modified:
            refs_updated += 1
    
    print(f"Personaje cu referințe actualizate: {refs_updated}")
    
    # ── Ștergere intrări secundare ───────────────────────────────────────
    
    # Reconstruiește lista păstrând ordinea originală
    final_chars = [char_by_id[c["id"]] for c in chars if c["id"] not in deleted_ids]
    
    final_count = len(final_chars)
    print(f"\nPersonaje finale: {final_count}")
    print(f"Reducere: {initial_count} → {final_count} (−{initial_count - final_count})")
    
    # ── Actualizare id_map.json ──────────────────────────────────────────
    
    for sec_id, pri_id in redirect_map.items():
        sec_id_intern = f"PERSON_{sec_id.upper()}"
        pri_id_intern = f"PERSON_{pri_id.upper()}"
        
        # Adaugă redirect pentru ID-ul intern
        if sec_id_intern not in id_map:
            id_map[sec_id_intern] = {
                "app_id": pri_id,
                "collection": "persoane",
                "status": "redirect",
                "candidates": [pri_id]
            }
        else:
            id_map[sec_id_intern]["app_id"] = pri_id
            id_map[sec_id_intern]["status"] = "redirect"
    
    # Verifică și actualizează redirecturile existente care pointează la ID-uri șterse
    for key, mapping in id_map.items():
        if isinstance(mapping, dict):
            app_id = mapping.get("app_id")
            if app_id in redirect_map:
                mapping["app_id"] = redirect_map[app_id]
    
    # ── Scriere rezultate ────────────────────────────────────────────────
    
    write_json(CHARACTERS_PATH, final_chars)
    write_json(ID_MAP_PATH, id_map)
    
    # ── Raport final ─────────────────────────────────────────────────────
    
    print(f"\n{'═' * 70}")
    print(f"  RAPORT FINAL")
    print(f"{'═' * 70}")
    print(f"  Personaje înainte:                  {initial_count}")
    print(f"  Personaje după:                     {final_count}")
    print(f"  Grupuri prefix-titlu unificate:      {tp_count}")
    print(f"  Clustere existente unificate:        {cluster_count}")
    print(f"  Clustere excluse/sub prag:           {cluster_skipped}")
    print(f"  Intrări secundare absorbite:         {merged_count}")
    print(f"  Referințe inverse actualizate:        {refs_updated}")
    print(f"  Fișiere actualizate: characters.json, id_map.json")
    print(f"{'═' * 70}")
    
    # Detalii despre redirecturi
    print(f"\nRedirecturi create ({len(redirect_map)}):")
    for sec, pri in sorted(redirect_map.items()):
        print(f"  {sec} → {pri}")


if __name__ == "__main__":
    main()
