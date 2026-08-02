#!/usr/bin/env python3
"""
scripts/raport_completitudine.py
================================
Auditează completitudinea datelor din cele 6 fișiere ASOIAF:
  - Native completitudine: houses, locations, characters, events
  - Ad-hoc completitudine: objects, titles

Generează raportul în data/_import/etl_output/raport_completitudine.json
și afișează un sumar complet la consolă.
"""

import sys
# ── Safety guard ──────────────────────────────────────────────────────────────
# This script writes a report to data/_import/etl_output/.
# Pass --i-know-what-im-doing to confirm intentional execution.
if "--i-know-what-im-doing" not in sys.argv:
    print("REFUSED: acest script scrie raport în data/_import/etl_output/.")
    print("Dacă ești sigur, rulează cu:  python scripts/raport_completitudine.py --i-know-what-im-doing")
    sys.exit(1)
# ──────────────────────────────────────────────────────────────────────────────

import json
import os
import re
from pathlib import Path

# Set UTF-8 encoding for stdout/stderr
if sys.stdout and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
OUTPUT_DIR = DATA_DIR / "_import" / "etl_output"
OUTPUT_FILE = OUTPUT_DIR / "raport_completitudine.json"

NATIVE_CATEGORIES = {
    "houses": DATA_DIR / "houses" / "houses.json",
    "locations": DATA_DIR / "locations" / "locations.json",
    "characters": DATA_DIR / "characters" / "characters.json",
    "events": DATA_DIR / "events" / "events.json"
}

ADHOC_CATEGORIES = {
    "objects": DATA_DIR / "objects" / "objects.json",
    "titles": DATA_DIR / "titles" / "titles.json"
}

NOISE_TITLE_PATTERNS = [
    re.compile(r"^pagina\s*:\s*\d+$", re.IGNORECASE),
    re.compile(r"^pag\.\s*\d+$", re.IGNORECASE),
    re.compile(r"^pagina\s+\d+$", re.IGNORECASE),
    re.compile(r"^pag\s+\d+$", re.IGNORECASE),
]

def is_noise_desc(desc_str):
    if not desc_str or not isinstance(desc_str, str):
        return True
    cleaned = desc_str.strip()
    if not cleaned:
        return True
    for pat in NOISE_TITLE_PATTERNS:
        if pat.match(cleaned):
            return True
    return False

def count_raw_sources(entity):
    """
    Calculează numărul de surse brute / afirmații disponibile pentru entitate.
    """
    # 1. Lista surse
    surse = entity.get("surse")
    surse_count = len(surse) if isinstance(surse, list) else 0

    # 2. Dict _afirmatii_pe_predicat
    afirm = entity.get("_afirmatii_pe_predicat")
    afirm_count = 0
    if isinstance(afirm, dict):
        for k, v in afirm.items():
            if isinstance(v, list):
                afirm_count += len(v)
            elif isinstance(v, int):
                afirm_count += v
            elif v:
                afirm_count += 1

    return max(surse_count, afirm_count)

def bin_score(score):
    """
    Categorisește scorul în histogramă 5-bin.
    """
    if score < 0.2:
        return "0.0-0.2"
    elif score < 0.4:
        return "0.2-0.4"
    elif score < 0.6:
        return "0.4-0.6"
    elif score < 0.8:
        return "0.6-0.8"
    else:
        return "0.8-1.0"

def process_native_category(cat_name, file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_entitatile = len(data)
    fara_completitudine = []
    entitati_cu_scor = []

    histogram = {
        "0.0-0.2": 0,
        "0.2-0.4": 0,
        "0.4-0.6": 0,
        "0.6-0.8": 0,
        "0.8-1.0": 0
    }

    for item in data:
        ent_id = item.get("id", "N/A")
        ent_name = item.get("name") or item.get("nume") or ent_id
        comp = item.get("_completitudine")

        if not isinstance(comp, dict) or "scor_total" not in comp or comp["scor_total"] is None:
            fara_completitudine.append({
                "id": ent_id,
                "nume": ent_name,
                "motiv": "lipsa_camp_sau_null"
            })
            continue

        scor = float(comp["scor_total"])
        histogram[bin_score(scor)] += 1

        raw_src = count_raw_sources(item)
        legitim_minora = raw_src < 3

        entitati_cu_scor.append({
            "id": ent_id,
            "nume": ent_name,
            "scor_total": scor,
            "raw_sources": raw_src,
            "legitim_minora": legitim_minora,
            "detalii_completitudine": comp
        })

    # Sortări
    # 1. Cele mai slabe 30 entități în general
    cele_mai_slabe_30 = sorted(entitati_cu_scor, key=lambda x: (x["scor_total"], -x["raw_sources"]))[:30]

    # 2. Cele mai slabe 30 entități NON-minore (raw_sources >= 3)
    non_minore = [e for e in entitati_cu_scor if not e["legitim_minora"]]
    cele_mai_slabe_non_minore_30 = sorted(non_minore, key=lambda x: (x["scor_total"], -x["raw_sources"]))[:30]

    # 3. Entități suspecte ("scor mic, surse multe"): scor < 0.5 și raw_sources >= 3
    suspecte = [e for e in entitati_cu_scor if e["scor_total"] < 0.5 and e["raw_sources"] >= 3]
    suspecte_sortate = sorted(suspecte, key=lambda x: (-x["raw_sources"], x["scor_total"]))

    return {
        "total_entitati": total_entitatile,
        "cu_completitudine_count": len(entitati_cu_scor),
        "fara_completitudine_count": len(fara_completitudine),
        "fara_completitudine_lista": [x["id"] for x in fara_completitudine],
        "distributie_scoruri": histogram,
        "cele_mai_slabe_30": cele_mai_slabe_30,
        "cele_mai_slabe_non_minore_30": cele_mai_slabe_non_minore_30,
        "suspecte_scor_mic_surse_multe": suspecte_sortate
    }

def process_adhoc_objects(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    histogram = {
        "0.0-0.2": 0,
        "0.2-0.4": 0,
        "0.4-0.6": 0,
        "0.6-0.8": 0,
        "0.8-1.0": 0
    }

    evaluari = []
    target_fields = ["material", "owned_by", "given_by", "made_by", "descrieri"]

    for item in data:
        ent_id = item.get("id", "N/A")
        ent_name = item.get("nume") or ent_id

        populated = []
        for field in target_fields:
            val = item.get(field)
            if val:
                if isinstance(val, (list, dict, str)) and len(val) > 0:
                    populated.append(field)
                elif not isinstance(val, (list, dict, str)):
                    populated.append(field)

        score = round(len(populated) / len(target_fields), 2)
        histogram[bin_score(score)] += 1

        evaluari.append({
            "id": ent_id,
            "nume": ent_name,
            "scor_adhoc": score,
            "campuri_populate": populated,
            "numar_campuri_populate": len(populated),
            "total_campuri": len(target_fields)
        })

    evaluari_sortate_crescator = sorted(evaluari, key=lambda x: x["scor_adhoc"])
    evaluari_sortate_descrescator = sorted(evaluari, key=lambda x: -x["scor_adhoc"])

    return {
        "marcat_adhoc": True,
        "nota": "Metrică ad-hoc bazată pe prezența câmpurilor (material, owned_by, given_by, made_by, descrieri). NU este comparabilă direct cu completitudinea nativă.",
        "total_entitati": len(data),
        "distributie_scoruri": histogram,
        "cele_mai_puţin_complete": evaluari_sortate_crescator[:20],
        "cele_mai_complete": evaluari_sortate_descrescator[:20]
    }

def process_adhoc_titles(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    histogram = {
        "0.0-0.2": 0,
        "0.2-0.4": 0,
        "0.4-0.6": 0,
        "0.6-0.8": 0,
        "0.8-1.0": 0
    }

    evaluari = []

    for item in data:
        ent_id = item.get("id", "N/A")
        ent_name = item.get("nume") or ent_id

        purtatori_valid = bool(item.get("purtatori"))

        raw_desc = item.get("descrieri", [])
        valid_desc = [d for d in raw_desc if not is_noise_desc(d)]
        descrieri_valid = bool(valid_desc)

        populated = []
        if purtatori_valid:
            populated.append("purtatori")
        if descrieri_valid:
            populated.append("descrieri")

        score = round(len(populated) / 2.0, 2)
        histogram[bin_score(score)] += 1

        evaluari.append({
            "id": ent_id,
            "nume": ent_name,
            "scor_adhoc": score,
            "campuri_populate": populated,
            "numar_descrieri_valide": len(valid_desc),
            "numar_purtatori": len(item.get("purtatori") or [])
        })

    evaluari_sortate_crescator = sorted(evaluari, key=lambda x: x["scor_adhoc"])
    evaluari_sortate_descrescator = sorted(evaluari, key=lambda x: -x["scor_adhoc"])

    return {
        "marcat_adhoc": True,
        "nota": "Metrică ad-hoc bazată pe prezența câmpurilor (purtatori, descrieri nevide/fără zgomot gen 'Pagina: N'). NU este comparabilă direct cu completitudinea nativă.",
        "total_entitati": len(data),
        "distributie_scoruri": histogram,
        "cele_mai_puţin_complete": evaluari_sortate_crescator[:20],
        "cele_mai_complete": evaluari_sortate_descrescator[:20]
    }

def main():
    print("=== Generare Raport Completitudine ASOIAF ===")

    report_data = {
        "entitati_cu_completitudine_nativa": {},
        "entitati_cu_metrica_adhoc": {},
        "top_suspecte_global_scor_mic_surse_multe": []
    }

    global_suspects = []

    # 1. Procesare categorii native
    for cat_name, file_path in NATIVE_CATEGORIES.items():
        print(f"Procesare {cat_name} ({file_path.name})...")
        res = process_native_category(cat_name, file_path)
        report_data["entitati_cu_completitudine_nativa"][cat_name] = res

        for item in res["suspecte_scor_mic_surse_multe"]:
            global_suspects.append({
                "categorie": cat_name,
                "id": item["id"],
                "nume": item["nume"],
                "scor_total": item["scor_total"],
                "raw_sources": item["raw_sources"]
            })

    # Sortare suspecte global după raw_sources descrescător, apoi scor_total crescător
    global_suspects_sorted = sorted(global_suspects, key=lambda x: (-x["raw_sources"], x["scor_total"]))
    report_data["top_suspecte_global_scor_mic_surse_multe"] = global_suspects_sorted[:30]

    # 2. Procesare categorii ad-hoc
    print("Procesare objects (objects.json)...")
    report_data["entitati_cu_metrica_adhoc"]["objects"] = process_adhoc_objects(ADHOC_CATEGORIES["objects"])

    print("Procesare titles (titles.json)...")
    report_data["entitati_cu_metrica_adhoc"]["titles"] = process_adhoc_titles(ADHOC_CATEGORIES["titles"])

    # 3. Salvare raport JSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Raport salvat cu succes în: {OUTPUT_FILE}")

    # 4. Afișare sumar în consolă
    print("\n" + "="*65)
    print("SUMAR DISTRIBUȚIE COMPLETITUDINE PE CATEGORII")
    print("="*65)

    print("\n--- Categorii cu _completitudine nativă ---")
    for cat_name, res in report_data["entitati_cu_completitudine_nativa"].items():
        dist = res["distributie_scoruri"]
        print(f"\n🔹 {cat_name.upper()} (Total: {res['total_entitati']}, Fără _completitudine [necunoscut]: {res['fara_completitudine_count']})")
        print(f"   Distribuție scoruri: 0.0-0.2: {dist['0.0-0.2']} | 0.2-0.4: {dist['0.2-0.4']} | 0.4-0.6: {dist['0.4-0.6']} | 0.6-0.8: {dist['0.6-0.8']} | 0.8-1.0: {dist['0.8-1.0']}")

    print("\n--- Categorii cu metrică ad-hoc (Objects & Titles) ---")
    for cat_name, res in report_data["entitati_cu_metrica_adhoc"].items():
        dist = res["distributie_scoruri"]
        print(f"\n🔹 {cat_name.upper()} [AD-HOC] (Total: {res['total_entitati']})")
        print(f"   Distribuție ad-hoc: 0.0-0.2: {dist['0.0-0.2']} | 0.2-0.4: {dist['0.2-0.4']} | 0.4-0.6: {dist['0.4-0.6']} | 0.6-0.8: {dist['0.6-0.8']} | 0.8-1.0: {dist['0.8-1.0']}")

    print("\n" + "="*65)
    print("TOP 15 CELE MAI SUSPECTE ENTITĂȚI (Scor mic, surse multe)")
    print("="*65)
    for idx, item in enumerate(global_suspects_sorted[:15], 1):
        print(f"{idx:2d}. [{item['categorie'].upper()}] {item['nume']} (ID: {item['id']})")
        print(f"    Scor: {item['scor_total']:.2f} | Surse brute: {item['raw_sources']}")

if __name__ == "__main__":
    main()
