#!/usr/bin/env python3
"""Detectează duplicate de tip prefix-titlu în characters.json.

Scanează toate personajele, normalizează numele (elimină diacritice + prefixe de titlu),
grupează pe numele normalizat, apoi validează cu semnale suplimentare (relații de familie,
membru_al comun, moarte similară, surse comune, house comun).

Output:
  - title_prefix_duplicates.json — grupuri confirmate (cu cel puțin un semnal suplimentar)
  - nume_similare_neconfirmate.json — grupuri doar pe baza numelui (fără confirmare)
"""

import sys
# ── Safety guard ──────────────────────────────────────────────────────────────
# This script writes to data/_import/etl_output/.
# Pass --i-know-what-im-doing to confirm intentional execution.
if "--i-know-what-im-doing" not in sys.argv:
    print("REFUSED: acest script scrie în data/_import/etl_output/.")
    print("Dacă ești sigur, rulează cu:  python scripts/find_title_prefix_duplicates.py --i-know-what-im-doing")
    sys.exit(1)
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations

import difflib
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_PATH = ROOT / "data" / "characters" / "characters.json"
OUTPUT_DIR = ROOT / "data" / "_import" / "etl_output"
CONFIRMED_PATH = OUTPUT_DIR / "title_prefix_duplicates.json"
UNCONFIRMED_PATH = OUTPUT_DIR / "nume_similare_neconfirmate.json"

# ── Lista completă de prefixe de titlu ASOIAF ────────────────────────────────

TITLE_PREFIXES = [
    # Titluri englezești
    r'\bser\b', r'\bsir\b', r'\blord\b', r'\blady\b',
    r'\bking\b', r'\bqueen\b', r'\bprince\b', r'\bprincess\b',
    r'\bmaester\b', r'\bgrand\s+maester\b', r'\barchmaester\b',
    r'\bsepton\b', r'\bsepta\b', r'\bkhal\b', r'\bkhaleesi\b',
    r'\bthe\b', r'\bsire\b',
    # Titluri românești (folosite în date)
    r'\blordul\b', r'\blord\b', r'\bregele\b', r'\bregina\b', r'\brege\b',
    r'\bprintul\b', r'\bprintesa\b', r'\bprinţul\b', r'\bprinţesa\b',
    r'\bprințul\b', r'\bprințesa\b', r'\bprint\b',
    r'\bmaester\b', r'\bmarele\s+maester\b',
    r'\bsepton\b', r'\bsepta\b',
    r'\bsire\b', r'\bsir\b',
    # Prefixe suplimentare comune
    r'\bcaptain\b', r'\bcăpitan\b',
    r'\bmaestrul\b',
]

TITLE_REGEX = re.compile('|'.join(TITLE_PREFIXES), re.IGNORECASE)


def remove_diacritics(text: str) -> str:
    """Elimină diacritice și normalizează caractere speciale românești."""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    result = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Tratează cazuri speciale care nu se normalizează cu NFKD
    result = result.replace('ș', 's').replace('ț', 't')
    result = result.replace('Ș', 'S').replace('Ț', 'T')
    result = result.replace('Ş', 'S').replace('Ţ', 'T')
    result = result.replace('ş', 's').replace('ţ', 't')
    return result


def normalize_name(name: str) -> str:
    """Normalizează un nume: elimină diacritice, prefixe de titlu, lowercase."""
    if not name:
        return ""
    s = remove_diacritics(name).lower()
    # Elimină paranteze și conținutul lor (ex. "(ser)" sau "(născută Tully)")
    s = re.sub(r'\([^)]*\)', '', s)
    # Elimină prefixele de titlu
    s = TITLE_REGEX.sub(' ', s)
    # Normalizează spații
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def normalize_id(char_id: str) -> str:
    """Normalizează un ID: elimină PERSON_, prefixe de titlu, underscore→space."""
    if not char_id:
        return ""
    s = char_id
    if s.startswith("PERSON_"):
        s = s[7:]
    s = remove_diacritics(s).lower()
    s = s.replace('_', ' ')
    s = TITLE_REGEX.sub(' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def get_rel_set(char: dict, key: str) -> set[str]:
    """Extrage setul de valori (curățate) dintr-un câmp relațional."""
    vals = char.get(key) or []
    if not isinstance(vals, list):
        return set()
    result = set()
    for v in vals:
        if isinstance(v, str) and v:
            clean = normalize_id(v)
            if clean:
                result.add(clean)
    return result


def get_raw_rel_set(char: dict, key: str) -> set[str]:
    """Extrage setul de valori brute dintr-un câmp relațional."""
    vals = char.get(key) or []
    if not isinstance(vals, list):
        return set()
    return {v for v in vals if isinstance(v, str) and v}


def get_sources(char: dict) -> set[str]:
    """Extrage sursele de carte ale unui personaj."""
    sources = set()
    for s in (char.get("surse") or []):
        if isinstance(s, dict) and s.get("source_book"):
            sources.add(remove_diacritics(s["source_book"]).lower())
    # Verifică și sursele din afirmații
    for pred_key, stmts in (char.get("_afirmatii_pe_predicat") or {}).items():
        if isinstance(stmts, list):
            for stmt in stmts:
                if isinstance(stmt, dict) and stmt.get("source_book"):
                    sources.add(remove_diacritics(stmt["source_book"]).lower())
    return sources


def death_description(char: dict) -> str:
    """Extrage descrierea morții unui personaj."""
    moarte = char.get("moarte")
    if isinstance(moarte, dict) and moarte.get("descriere"):
        return remove_diacritics(str(moarte["descriere"])).lower()
    return ""


def check_signals(chars_in_group: list[dict]) -> dict:
    """Verifică semnale suplimentare pentru un grup de candidați.
    
    Returnează dict cu semnalele găsite sau {} dacă nu există niciun semnal.
    """
    signals = {}
    
    # Colectează seturile relaționale per personaj
    all_parinti = [get_rel_set(c, "parinti") for c in chars_in_group]
    all_copii = [get_rel_set(c, "copii") for c in chars_in_group]
    all_frati = [get_rel_set(c, "frati") for c in chars_in_group]
    all_casatorit = [get_rel_set(c, "casatorit_cu") for c in chars_in_group]
    all_membru = []
    for c in chars_in_group:
        m = set()
        val = c.get("membru_al")
        if isinstance(val, str) and val:
            m.add(normalize_id(val))
        for v in (c.get("member_of") or []):
            if isinstance(v, str) and v:
                m.add(normalize_id(v))
        all_membru.append(m)
    
    # Verifică intersecții (orice pereche din grup)
    def any_intersection(sets_list):
        for i in range(len(sets_list)):
            for j in range(i + 1, len(sets_list)):
                inter = sets_list[i] & sets_list[j]
                if inter:
                    return inter
        return set()
    
    common_parinti = any_intersection(all_parinti)
    common_copii = any_intersection(all_copii)
    common_frati = any_intersection(all_frati)
    common_casatorit = any_intersection(all_casatorit)
    common_membru = any_intersection(all_membru)
    
    if common_copii:
        signals["copii_comuni"] = sorted(common_copii)
    if common_parinti:
        signals["parinti_comuni"] = sorted(common_parinti)
    if common_frati:
        signals["frati_comuni"] = sorted(common_frati)
    if common_casatorit:
        signals["casatorit_cu_comuni"] = sorted(common_casatorit)
    if common_membru:
        signals["membru_al_comun"] = sorted(common_membru)
    
    # Verifică house comun
    houses = set()
    for c in chars_in_group:
        h = c.get("house")
        if isinstance(h, str) and h:
            houses.add(h.lower())
    if len(houses) == 1 and houses != {""}:
        signals["house_comun"] = list(houses)[0]
    
    # Verifică moarte similară
    deaths = [death_description(c) for c in chars_in_group]
    deaths_nonempty = [d for d in deaths if d]
    if len(deaths_nonempty) >= 2:
        for i in range(len(deaths_nonempty)):
            for j in range(i + 1, len(deaths_nonempty)):
                ratio = difflib.SequenceMatcher(None, deaths_nonempty[i], deaths_nonempty[j]).ratio()
                if ratio >= 0.5:
                    signals["moarte_similara"] = {
                        "texte": [deaths_nonempty[i], deaths_nonempty[j]],
                        "similaritate": round(ratio, 2)
                    }
    
    # Verifică surse comune
    all_sources = [get_sources(c) for c in chars_in_group]
    common_sources = any_intersection(all_sources)
    if common_sources:
        signals["surse_comune"] = sorted(common_sources)
    
    return signals


def is_title_prefix_pair(id1: str, id2: str, name1: str, name2: str) -> bool:
    """Verifică dacă diferența între două intrări este doar un prefix de titlu.
    
    Adică, unul din ID-uri/nume conține un prefix de titlu pe care celălalt nu-l are,
    iar restul numelui este identic.
    """
    norm_id1 = normalize_id(id1)
    norm_id2 = normalize_id(id2)
    norm_name1 = normalize_name(name1)
    norm_name2 = normalize_name(name2)
    
    return (norm_id1 == norm_id2) or (norm_name1 == norm_name2 and norm_name1 != "")


def count_populated_fields(char: dict) -> int:
    """Numără câte câmpuri relevante sunt populate (non-null, non-empty)."""
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


def main():
    print("═" * 70)
    print("  DETECȚIE DUPLICATE PREFIX-TITLU")
    print("═" * 70)
    
    with open(CHARACTERS_PATH, encoding="utf-8") as f:
        chars = json.load(f)
    
    print(f"\nTotal personaje analizate: {len(chars)}")
    
    # Pasul 1: Grupare pe numele normalizat
    groups: dict[str, list[dict]] = defaultdict(list)
    for c in chars:
        norm = normalize_name(c.get("name", ""))
        if norm:
            groups[norm].append(c)
    
    # Filtrare: doar grupurile cu 2+ intrări
    candidate_groups = {k: v for k, v in groups.items() if len(v) >= 2}
    print(f"Grupuri cu 2+ intrări pe același nume normalizat: {len(candidate_groups)}")
    
    # Pasul 2: Validare cu semnale suplimentare
    confirmed = []
    unconfirmed = []
    
    for norm_name, group_chars in sorted(candidate_groups.items()):
        # Verifică dacă e într-adevăr o diferență de prefix-titlu
        ids = [c["id"] for c in group_chars]
        names = [c.get("name", "") for c in group_chars]
        
        # Verifică dacă diferențele sunt doar de prefix-titlu
        all_title_prefix = True
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                if not is_title_prefix_pair(ids[i], ids[j], names[i], names[j]):
                    all_title_prefix = False
                    break
            if not all_title_prefix:
                break
        
        if not all_title_prefix:
            continue  # Nu e o pereche de prefix-titlu, skip
        
        # Verifică semnale suplimentare
        signals = check_signals(group_chars)
        
        entry = {
            "nume_normalizat": norm_name,
            "id_uri": ids,
            "id_intern_uri": [c.get("id_intern", "") for c in group_chars],
            "names": names,
            "numar_variante": len(group_chars),
            "semnale": signals,
            "scor_completitudine": [
                {
                    "id": c["id"],
                    "scor_total": (c.get("_completitudine") or {}).get("scor_total"),
                    "campuri_populate": count_populated_fields(c)
                }
                for c in group_chars
            ]
        }
        
        if signals:
            confirmed.append(entry)
        else:
            unconfirmed.append(entry)
    
    # Pasul 3: Scriere output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    confirmed_output = {
        "metadate": {
            "total_personaje": len(chars),
            "total_grupuri_candidat": len(candidate_groups),
            "total_confirmate": len(confirmed),
            "total_neconfirmate": len(unconfirmed)
        },
        "grupuri_confirmate": confirmed
    }
    
    with open(CONFIRMED_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(confirmed_output, f, ensure_ascii=False, indent=2)
        f.write("\n")
    
    unconfirmed_output = {
        "metadate": {
            "total_neconfirmate": len(unconfirmed),
            "motiv": "Aceste grupuri au același nume normalizat dar FĂRĂ niciun semnal suplimentar de confirmare — necesită decizie manuală."
        },
        "grupuri_neconfirmate": unconfirmed
    }
    
    with open(UNCONFIRMED_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(unconfirmed_output, f, ensure_ascii=False, indent=2)
        f.write("\n")
    
    # Raport
    print(f"\n{'─' * 50}")
    print(f"REZULTATE DETECȚIE:")
    print(f"{'─' * 50}")
    print(f"  Grupuri confirmate (cu semnal suplimentar):   {len(confirmed)}")
    print(f"  Grupuri neconfirmate (doar nume similar):     {len(unconfirmed)}")
    print(f"  Total candidați prefix-titlu:                 {len(confirmed) + len(unconfirmed)}")
    
    print(f"\nGrupuri CONFIRMATE:")
    for g in confirmed:
        signals_str = ", ".join(g["semnale"].keys())
        print(f"  • {g['nume_normalizat']}: {g['id_uri']} [{signals_str}]")
    
    if unconfirmed:
        print(f"\nGrupuri NECONFIRMATE (salvate în {UNCONFIRMED_PATH.name}):")
        for g in unconfirmed:
            print(f"  ○ {g['nume_normalizat']}: {g['id_uri']}")
    
    print(f"\nFișiere generate:")
    print(f"  ✓ {CONFIRMED_PATH}")
    print(f"  ✓ {UNCONFIRMED_PATH}")


if __name__ == "__main__":
    main()
