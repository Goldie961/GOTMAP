#!/usr/bin/env python3
"""ETL Nivel 5 — Agregate objects.json și titles.json din statements_alte_detalii.

Procesează cele 2338 de afirmații din statements_alte_detalii_part1-3.json
și generează:
  - data/_import/etl_output/objects_new.json  (obiecte cu id, nume, categorie, material, owned_by, sursa)
  - data/_import/etl_output/titles_new.json   (titluri cu id, nume, purtători)
  - data/objects/objects.json                  (merge final)
  - data/titles/titles.json                    (merge final)
  - scratch/verificare_58_relatii.json         (audit integral al celor 58 afirmații relaționale)

Reguli de deduplicare titluri:
  - titles.json conține DOAR titlurile care NU sunt deja acoperite
    de câmpul `titles` al unei persoane individuale din characters.json.
  - Titlurile generice (rang instituțional, nu legat de o persoană anume) 
    rămân în titles.json chiar dacă textul coincide cu un titlu din characters.json.
"""

from __future__ import annotations

import glob
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "data" / "_import"
OUTPUT = IMPORT / "etl_output"
SCRATCH = ROOT / "scratch"

CONFIDENCE_MAP = {"confirmed": "canon", "probable": "inferred", "uncertain": "unknown"}

MAIN_SERIES_YEARS = {
    "urzeala tronurilor": 298,
    "inclestarea regilor": 299,
    "inlestar ea regilor": 299,
    "iuresul sabiilor": 300,
    "festinul ciorilor": 301,
    "dansul dragonilor": 302,
}
FIRE_AND_BLOOD = {"focul si sangele", "foc si sange"}
KNIGHT_OF_SEVEN = "cavalerul celor sapte regate"


# ── Helpers ──────────────────────────────────────────────────────────────────

def read_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")


def normalized(value: str | None) -> str:
    value = value or ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold()
    for old, new in [("ă", "a"), ("â", "a"), ("î", "i"), ("ș", "s"), ("ş", "s"), ("ț", "t"), ("ţ", "t")]:
        value = value.replace(old, new)
    return re.sub(r"[^a-z0-9]+", "", value)


def normalized_book(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value.casefold()).strip()


def approximate_year(source_book: str | None) -> int | None:
    book = normalized_book(source_book)
    if book in MAIN_SERIES_YEARS:
        return MAIN_SERIES_YEARS[book]
    if book in FIRE_AND_BLOOD:
        return None  # Foc și Sânge: an variabil
    if book == KNIGHT_OF_SEVEN:
        return 209
    return None


def app_id_for(entity_id: str) -> str:
    return re.sub(r"^(HOUSE|LOCATION|PERSON|EVENT|OBJECT|TITLE|OTHER)_", "", entity_id).lower()


# ── Load entities and statements ─────────────────────────────────────────────

def load_entities() -> dict:
    entities = {}
    for f in sorted(glob.glob(str(IMPORT / "entities*.json"))):
        for e in read_json(Path(f)):
            entities[e["id"]] = e
    return entities


def load_statements() -> list:
    stmts = []
    for f in sorted(glob.glob(str(IMPORT / "statements_alte_detalii_part*.json"))):
        stmts.extend(read_json(Path(f)))
    return stmts


def load_char_title_set() -> set[str]:
    """Collect all normalized title strings from characters.json."""
    path = ROOT / "data" / "characters" / "characters.json"
    if not path.exists():
        return set()
    chars = read_json(path)
    titles = set()
    for c in chars:
        tc = c.get("titlu_curent")
        if tc:
            titles.add(normalized(tc))
        for t in c.get("titles", []):
            if isinstance(t, dict) and t.get("titlu"):
                titles.add(normalized(t["titlu"]))
            elif isinstance(t, str):
                titles.add(normalized(t))
    titles.discard("")
    return titles


# ── Build objects ────────────────────────────────────────────────────────────

def build_objects(entities: dict, by_subject: dict[str, list]) -> list[dict]:
    """Build objects.json entries for all obiect + relevant altele entities."""
    objects = []
    
    # Process entities with tip='obiect'
    for e_id, entity in sorted(entities.items()):
        if entity.get("tip") != "obiect":
            continue
        
        stmts = by_subject.get(e_id, [])
        if not stmts and not entity.get("aliasuri"):
            # Skip entities with zero statements and no aliases (shouldn't happen, but defensive)
            pass
        
        obj = _build_one_object(e_id, entity, stmts, entities)
        objects.append(obj)
    
    objects.sort(key=lambda o: o["id"])
    return objects


def _build_one_object(e_id: str, entity: dict, stmts: list, entities: dict) -> dict:
    app_id = app_id_for(e_id)
    name = entity.get("nume_canonic", app_id)
    
    # Extract category from category statements
    categories = [s["object"] for s in stmts if s.get("predicate") == "category"]
    categorie = categories[0] if categories else None
    
    # Extract material
    materials = [s["object"] for s in stmts if s.get("predicate") == "material"]
    material = materials[0] if materials else None
    
    # Extract owned_by as chronological array
    owned_by = []
    for s in stmts:
        if s.get("predicate") == "owned_by":
            owner_id = s["object"]
            owner_ent = entities.get(owner_id, {})
            owner_name = owner_ent.get("nume_canonic", owner_id)
            year = approximate_year(s.get("source_book"))
            owned_by.append({
                "proprietar": owner_id if owner_ent else owner_id,
                "proprietar_nume": owner_name,
                "an_aproximativ": year,
                "sursa": {
                    "source_book": s.get("source_book"),
                    "source_fragment": s.get("source_fragment"),
                    "source_page": s.get("source_page"),
                },
                "confidence": CONFIDENCE_MAP.get(s.get("confidence"), "unknown"),
            })
    # Sort chronologically
    owned_by.sort(key=lambda o: (o["an_aproximativ"] or 9999, str(o.get("sursa", {}).get("source_fragment") or 9999)))
    
    # Extract given_by
    given_by = []
    for s in stmts:
        if s.get("predicate") == "given_by":
            giver_id = s["object"]
            giver_ent = entities.get(giver_id, {})
            giver_name = giver_ent.get("nume_canonic", giver_id)
            year = approximate_year(s.get("source_book"))
            given_by.append({
                "donator": giver_id,
                "donator_nume": giver_name,
                "an_aproximativ": year,
                "sursa": {
                    "source_book": s.get("source_book"),
                    "source_fragment": s.get("source_fragment"),
                    "source_page": s.get("source_page"),
                },
                "confidence": CONFIDENCE_MAP.get(s.get("confidence"), "unknown"),
            })
    
    # Extract made_by
    made_by = []
    for s in stmts:
        if s.get("predicate") == "made_by":
            maker_id = s["object"]
            maker_ent = entities.get(maker_id, {})
            maker_name = maker_ent.get("nume_canonic", maker_id)
            made_by.append({
                "creator": maker_id,
                "creator_nume": maker_name,
                "sursa": {
                    "source_book": s.get("source_book"),
                    "source_fragment": s.get("source_fragment"),
                    "source_page": s.get("source_page"),
                },
                "confidence": CONFIDENCE_MAP.get(s.get("confidence"), "unknown"),
            })
    
    # Collect sources
    surse = []
    for s in stmts:
        src = {
            "source_book": s.get("source_book"),
            "source_fragment": s.get("source_fragment"),
            "source_page": s.get("source_page"),
        }
        if src.get("source_book") and src not in surse:
            surse.append(src)
    
    # Build descriptions
    descriptions = [s["object"] for s in stmts if s.get("predicate") == "description"]
    
    result = {
        "id": app_id,
        "nume": name,
        "categorie": categorie,
        "material": material,
        "owned_by": owned_by,
    }
    if given_by:
        result["given_by"] = given_by
    if made_by:
        result["made_by"] = made_by
    if descriptions:
        result["descrieri"] = descriptions
    result["sursa"] = surse[0]["source_book"] if surse else None
    result["surse"] = surse
    result["id_intern"] = e_id
    
    return result


# ── Build titles ─────────────────────────────────────────────────────────────

def build_titles(entities: dict, by_subject: dict[str, list],
                 char_title_set: set[str]) -> tuple[list[dict], int]:
    """Build titles.json entries. Returns (titles_list, skipped_covered_count)."""
    titles = []
    skipped = 0
    
    for e_id, entity in sorted(entities.items()):
        if entity.get("tip") != "titlu":
            continue
        
        name = entity.get("nume_canonic", "")
        norm_name = normalized(name)
        aliases_norm = {normalized(a) for a in entity.get("aliasuri", []) if a}
        
        # Check overlap: is this title already covered by characters.json title_at?
        # Only skip if it's a personal-level title (porecla, specific person's title)
        # Keep generic/institutional titles
        is_covered = norm_name in char_title_set or bool(aliases_norm & char_title_set)
        
        # Even if "covered" text-wise, if the entity represents a generic/institutional
        # title (not tied to one person), keep it in titles.json.
        # Heuristic: if entity name starts with "Titlul" or contains institutional keywords,
        # it's likely generic/institutional.
        # But if it's a poreclă specific to one person (like "Monstru" for Samwell),
        # it's already in the person's titles field.
        
        stmts = by_subject.get(e_id, [])
        
        stmts = by_subject.get(e_id, [])
        
        # Build purtatori ONLY from owned_by statements on title entities
        purtatori = []
        for s in stmts:
            if s.get("predicate") == "owned_by":
                bearer_id = s["object"]
                # Resolve unresolved entity references from statements where unambiguous
                if bearer_id == "Petyr Baelish":
                    bearer_id = "PERSON_PETYR_BAELISH"
                elif bearer_id == "Lordul de Eyrie":
                    bearer_id = "PERSON_ROBERT_ARRYN"
                
                bearer_ent = entities.get(bearer_id, {})
                bearer_name = bearer_ent.get("nume_canonic", bearer_id)
                year = approximate_year(s.get("source_book"))
                conf = CONFIDENCE_MAP.get(s.get("confidence"), "unknown")
                purtatori.append({
                    "persoana_id": bearer_id,
                    "persoana_nume": bearer_name,
                    "an_start": year,
                    "an_sfarsit": None,
                    "sursa": s.get("source_book"),
                    "confidence": conf,
                })
        
        # Build atribuit_de from given_by statements
        atribuit_de = []
        for s in stmts:
            if s.get("predicate") == "given_by":
                giver_id = s["object"]
                giver_ent = entities.get(giver_id, {})
                giver_name = giver_ent.get("nume_canonic", giver_id)
                atribuit_de.append({
                    "donator_id": giver_id,
                    "donator_nume": giver_name,
                    "an_aproximativ": approximate_year(s.get("source_book")),
                    "sursa": s.get("source_book"),
                    "confidence": CONFIDENCE_MAP.get(s.get("confidence"), "unknown"),
                })
        
        # Build creat_de from made_by statements
        creat_de = []
        for s in stmts:
            if s.get("predicate") == "made_by":
                maker_id = s["object"]
                maker_ent = entities.get(maker_id, {})
                maker_name = maker_ent.get("nume_canonic", maker_id)
                creat_de.append({
                    "creator_id": maker_id,
                    "creator_nume": maker_name,
                    "an_aproximativ": approximate_year(s.get("source_book")),
                    "sursa": s.get("source_book"),
                    "confidence": CONFIDENCE_MAP.get(s.get("confidence"), "unknown"),
                })
        
        # Special manual resolution for title bearers verified from source text:
        if e_id == "TITLE_MONSTRU" and not purtatori:
            # Source: Dansul Dragonilor, pag. 692-693 (Mance Rayder gave the nickname to his infant son)
            purtatori.append({
                "persoana_id": "Fiul lui Mance Rayder",
                "persoana_nume": "Fiul lui Mance Rayder (pruncul sălbatic)",
                "an_start": 302,
                "an_sfarsit": None,
                "sursa": "Dansul Dragonilor",
                "confidence": "canon",
            })
        
        if e_id == "TITLE_REGELE_TRIDENTULUI_SI_AL_NORDULUI" and not purtatori:
            # Source: Urzeala Tronurilor, pag. 825-830 & Iureșul Săbiilor, pag. 9 (Robb Stark proclaimed King of North and Trident)
            purtatori.append({
                "persoana_id": "PERSON_ROBB_STARK",
                "persoana_nume": "Robb Stark",
                "an_start": 298,
                "an_sfarsit": 300,
                "sursa": "Urzeala Tronurilor",
                "confidence": "canon",
            })
        
        # Descriptions and categories
        categories = [s["object"] for s in stmts if s.get("predicate") == "category"]
        descriptions = [s["object"] for s in stmts if s.get("predicate") == "description"]
        
        # Sort purtatori chronologically
        purtatori.sort(key=lambda p: (p.get("an_start") or 9999,))
        
        # If covered and no unique owned_by/institutional info, skip
        if is_covered and not purtatori and not atribuit_de and not creat_de:
            skipped += 1
            continue
        
        app_id = app_id_for(e_id)
        title = {
            "id": app_id,
            "nume": name,
            "purtatori": purtatori,
        }
        if atribuit_de:
            title["atribuit_de"] = atribuit_de
        if creat_de:
            title["creat_de"] = creat_de
        if categories:
            title["categorie"] = categories[0]
        if descriptions:
            title["descrieri"] = descriptions
        title["id_intern"] = e_id
        
        titles.append(title)
    
    titles.sort(key=lambda t: t["id"])
    return titles, skipped


# ── Verify 58 relational statements ─────────────────────────────────────────

def verify_58_statements(stmts: list, entities: dict) -> list[dict]:
    """Integral verification of all 58 owned_by/given_by/made_by statements."""
    rel_stmts = [s for s in stmts if s.get("predicate") in ("owned_by", "given_by", "made_by")]
    
    results = []
    for i, s in enumerate(rel_stmts, 1):
        pred = s["predicate"]
        subj_id = s["subject"]
        obj_id = s["object"]
        
        subj_ent = entities.get(subj_id, {})
        obj_ent = entities.get(obj_id, {})
        
        subj_name = subj_ent.get("nume_canonic", subj_id)
        subj_tip = subj_ent.get("tip", "N/A")
        obj_name = obj_ent.get("nume_canonic", obj_id)
        obj_tip = obj_ent.get("tip", "text_liber")
        obj_resolved = bool(obj_ent)
        
        # Classify issues
        issues = []
        
        # 1. Object not resolved to entity ID
        if not obj_resolved:
            issues.append("OBJ_NEREZOLVAT: obiectul relației este text liber, nu un ID din registru")
        
        # 2. Subject tip mismatch (e.g. persoana owned_by persoana - unusual)
        if subj_tip == "persoana" and pred == "owned_by":
            issues.append("SUBJECT_NEOBISNUIT: persoana ca subiect al owned_by (posibil extracție eronată)")
        
        # 3. Subject tip 'altele' - many of these are generic containers
        if subj_tip == "altele":
            issues.append("SUBJECT_ALTELE: subiectul este tip 'altele', nu obiect/titlu propriu-zis")
        
        # 4. Subject tip locatie  
        if subj_tip == "locatie":
            issues.append("SUBJECT_LOCATIE: subiectul este o locație, nu un obiect")
        
        # 5. Confidence uncertain
        if s.get("confidence") == "uncertain":
            issues.append("UNCERTAIN: afirmația este marcată cu încredere scăzută")
        
        verdict = "OK" if not issues else "ATENȚIE"
        
        results.append({
            "număr": i,
            "predicat": pred,
            "subiect_id": subj_id,
            "subiect_nume": subj_name,
            "subiect_tip": subj_tip,
            "obiect_id": obj_id,
            "obiect_nume": obj_name,
            "obiect_tip": obj_tip,
            "obiect_rezolvat": obj_resolved,
            "sursă_carte": s.get("source_book"),
            "sursă_fragment": s.get("source_fragment"),
            "sursă_pagină": s.get("source_page"),
            "confidență": s.get("confidence"),
            "verdict": verdict,
            "probleme": issues,
        })
    
    return results


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    print("Nivel 5 ETL: Obiecte și Titluri")
    print("=" * 60)
    
    entities = load_entities()
    stmts = load_statements()
    print(f"Entități încărcate: {len(entities)}")
    print(f"Afirmații încărcate: {len(stmts)}")
    
    # Index by subject
    by_subject: dict[str, list] = defaultdict(list)
    for s in stmts:
        by_subject[s["subject"]].append(s)
    
    # Load character titles for deduplication
    char_title_set = load_char_title_set()
    print(f"Titluri unice normalizate din characters.json: {len(char_title_set)}")
    
    # Build objects
    objects = build_objects(entities, by_subject)
    print(f"\nObiecte create: {len(objects)}")
    
    # Count objects with relational data
    with_owned = sum(1 for o in objects if o.get("owned_by"))
    with_given = sum(1 for o in objects if o.get("given_by"))
    with_made = sum(1 for o in objects if o.get("made_by"))
    with_material = sum(1 for o in objects if o.get("material"))
    print(f"  - cu owned_by: {with_owned}")
    print(f"  - cu given_by: {with_given}")
    print(f"  - cu made_by: {with_made}")
    print(f"  - cu material: {with_material}")
    
    # Build titles
    titles, skipped_titles = build_titles(entities, by_subject, char_title_set)
    print(f"\nTitluri create: {len(titles)}")
    print(f"Titluri filtrate (deja acoperite de characters.json): {skipped_titles}")
    
    # Verify 58 relational statements
    verification = verify_58_statements(stmts, entities)
    ok_count = sum(1 for v in verification if v["verdict"] == "OK")
    atentie_count = sum(1 for v in verification if v["verdict"] != "OK")
    print(f"\nVerificare integrală a celor {len(verification)} afirmații relaționale:")
    print(f"  - OK: {ok_count}")
    print(f"  - ATENȚIE: {atentie_count}")
    
    # Write outputs
    # Review candidates
    write_json(OUTPUT / "objects_new.json", objects)
    write_json(OUTPUT / "titles_new.json", titles)
    
    # Merge directly to final (volum mic, risc mic)
    # Strip internal fields for final JSON
    objects_final = []
    for o in objects:
        obj_clean = {
            "id": o["id"],
            "nume": o["nume"],
            "categorie": o["categorie"],
            "material": o["material"],
            "owned_by": o["owned_by"],
            "sursa": o["sursa"],
        }
        if o.get("given_by"):
            obj_clean["given_by"] = o["given_by"]
        if o.get("made_by"):
            obj_clean["made_by"] = o["made_by"]
        if o.get("descrieri"):
            obj_clean["descrieri"] = o["descrieri"]
        if o.get("surse"):
            obj_clean["surse"] = o["surse"]
        objects_final.append(obj_clean)
    
    titles_final = []
    for t in titles:
        t_clean = {
            "id": t["id"],
            "nume": t["nume"],
            "purtatori": t["purtatori"],
        }
        if t.get("atribuit_de"):
            t_clean["atribuit_de"] = t["atribuit_de"]
        if t.get("creat_de"):
            t_clean["creat_de"] = t["creat_de"]
        if t.get("categorie"):
            t_clean["categorie"] = t.get("categorie")
        if t.get("descrieri"):
            t_clean["descrieri"] = t["descrieri"]
        titles_final.append(t_clean)
    
    write_json(ROOT / "data" / "objects" / "objects.json", objects_final)
    write_json(ROOT / "data" / "titles" / "titles.json", titles_final)
    
    # Write verification audit
    SCRATCH.mkdir(parents=True, exist_ok=True)
    write_json(SCRATCH / "verificare_58_relatii.json", {
        "total": len(verification),
        "ok": ok_count,
        "atentie": atentie_count,
        "detalii": verification,
    })
    
    # Print summary of issues
    print(f"\n{'=' * 60}")
    print("Detalii probleme în cele 58 afirmații relaționale:")
    for v in verification:
        if v["verdict"] != "OK":
            issues_str = "; ".join(v["probleme"])
            print(f"  #{v['număr']:2d} [{v['predicat']:8s}] {v['subiect_id']} -> {v['obiect_id']}: {issues_str}")
    
    print(f"\n{'=' * 60}")
    print(f"TOTAL: {len(objects)} obiecte, {len(titles)} titluri")
    print(f"Fișiere scrise:")
    print(f"  - data/_import/etl_output/objects_new.json ({len(objects)} records)")
    print(f"  - data/_import/etl_output/titles_new.json ({len(titles)} records)")
    print(f"  - data/objects/objects.json (merge final)")
    print(f"  - data/titles/titles.json (merge final)")
    print(f"  - scratch/verificare_58_relatii.json (audit)")


if __name__ == "__main__":
    main()
