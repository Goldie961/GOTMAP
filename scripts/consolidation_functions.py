#!/usr/bin/env python3
"""Consolidation functions for Nivel 4 of person statements ETL.

Solves BUG 1 (family relations cross-mutation & symmetric deduplication)
and BUG 2 (chronological title sorting via MAIN_SERIES_YEARS, title noise filtering,
retaining chronological position in output).

Functions:
  - consolidate_title_at(statements: list[dict]) -> dict
  - consolidate_died(statements: list[dict]) -> dict
  - consolidate_family_relations(all_person_records: dict, all_grouped: dict) -> None
  - test() -> dict
"""

from __future__ import annotations

import difflib
import glob
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path


# ── Constante de ordonare cronologică ──────────────────────────────────────────

ROOT = Path("C:/Users/andre/OneDrive/Desktop/GOT MAP")
IMPORT = ROOT / "data" / "_import"

CONFIDENCE_ORDER = {"uncertain": 0, "probable": 1, "confirmed": 2}

# Anii reali aproximați AI (AC / După Cucerire) pentru cărțile din seria principală.
# Folosiți ca axă cronologică primară în ordonarea titlurilor.
MAIN_SERIES_YEARS = {
    "urzeala tronurilor": 298,
    "inlestar ea regilor": 299,
    "inclestarea regilor": 299,
    "iuresul sabiilor": 300,
    "festinul ciorilor": 301,
    "dansul dragonilor": 302,
}

# Constante de documentare pentru lucrările secundare / prequel:
# - FIRE_AND_BLOOD: Istoria Targaryenilor (1–136 AC). Anul exact depinde de capitol/afirmație.
FIRE_AND_BLOOD = {"focul si sangele", "foc si sange"}
# - KNIGHT_OF_SEVEN_KINGDOMS: Nuvelele cu Dunk & Egg (~209 AC).
KNIGHT_OF_SEVEN_KINGDOMS = "cavalerul celor sapte regate"

TITLE_SIMILARITY_THRESHOLD = 0.80


# ── Helpers de normalizare și cronologie ─────────────────────────────────────

def _normalize_book(raw: str | None) -> str:
    """Normalizează titlul unei cărți pentru căutare în dicționare."""
    if not raw:
        return ""
    val = unicodedata.normalize("NFKD", raw)
    val = "".join(ch for ch in val if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", val.casefold()).strip()


def _get_chrono_position(source_book: str | None, source_fragment: int | str | None) -> tuple[int, int, dict]:
    """Calculează anul AC și ordinea de fragment pentru o afirmație.

    Dacă fragmentul este null/necunoscut, NU se folosește 0 (care l-ar plasa greșit
    la începutul cărții), ci 9999 (plasat la sfârșitul acelui an de carte).
    Anul principal provine din MAIN_SERIES_YEARS.
    """
    book_norm = _normalize_book(source_book)
    year = MAIN_SERIES_YEARS.get(book_norm)

    if year is None:
        if book_norm in FIRE_AND_BLOOD:
            year = 130  # An mediu orientativ pentru Foc și Sânge
        elif book_norm == KNIGHT_OF_SEVEN_KINGDOMS:
            year = 209
        else:
            year = 9999  # An necunoscut, trimis la final

    frag_num = 9999
    if source_fragment is not None:
        try:
            # Extrage prima parte numerică (ex: "13-1" -> 13, 2 -> 2)
            match = re.search(r"\d+", str(source_fragment))
            if match:
                frag_num = int(match.group(0))
        except (ValueError, TypeError):
            frag_num = 9999

    pozitie_dict = {
        "an_aproximativ": year if year != 9999 else None,
        "carte": source_book,
        "fragment": source_fragment if source_fragment is not None else "necunoscut",
    }

    return (year, frag_num, pozitie_dict)


# ── Regula exactă de filtrare a zgomotului din title_at ───────────────────────

def is_title_noise(val: str | None) -> bool:
    """Filtrează textele care sunt evident zgomot de extracție, nu titluri reale.

    REGULA DE FILTRARE (documentată conform cerinței 2b):
    Un text este considerat ZGOMOT (non-titlu) dacă îndeplinește oricare din condițiile:
      1. Este nul sau are sub 3 caractere relevante.
      2. Începe cu referință explicită de pagină: 'pag.', 'pagina', 'pag '.
      3. Conține exclusiv cifre, spații și semne de punctuație de interval
         (ex: '1298', '1257–1275', '1058–1069', '1315–1316').
      4. Conține marcare de fragment brut de extracție (ex: '— Fragment 14',
         '- Fragment 9', 'Fragment 12').
      5. Este o expresie descriptivă sau notă editorială de neconcordanță/acțiune:
         'nemenționate', 'cântând', 'lățos', 'amintită pieptănând...',
         'menționată doar ca...', 'care ar fi putut fi...'.
    """
    if not val or not isinstance(val, str):
        return True
    s = val.strip()
    if len(s) < 3:
        return True
    sl = s.lower()

    # 1. Referințe de pagină
    if re.match(r"^pag(ina|\.)?\b", sl):
        return True

    # 2. Exclusiv numere / intervale de pagini
    if re.match(r"^[0-9\s\u2013\u2014,.\-\/]+$", s):
        return True

    # 3. Etichete de fragment lipite de titlu
    if re.search(r"[\u2014\-]\s*fragment\s*\d+", sl) or re.search(r"\bfragment\s*\d+", sl):
        return True

    # 4. Text descriptiv/zgomot specific
    if sl in ("nemenționate", "nemenționate explicit", "cântând", "lăţos", "lățos"):
        return True
    if sl.startswith("menționată") or sl.startswith("menţionată") or sl.startswith("amintită") or sl.startswith("care ar fi putut") or sl.startswith("poreclă dată") or sl.startswith("porecla dată"):
        return True

    return False


TITLE_SYNONYMS = {
    "stapanul": "lord",
    "stapana": "lady",
    "stapan": "lord",
    "doamna": "lady",
    "cavaler": "ser",
    "suveranul": "rege",
    "suverana": "regina",
    "suveran": "rege",
    "king": "rege",
    "queen": "regina",
    "prince": "print",
    "princess": "printesa",
    "printul": "print",
    "printesa": "printesa",
    "regele": "rege",
    "regina": "regina",
    "contele": "conte",
    "lordul": "lord",
    "marele": "mare",
    "great": "mare",
    "first": "primul",
    "hand": "mana",
    "commander": "comandant",
    "captain": "capitan",
}

PREPOSITIONS = {"de", "al", "a", "ai", "ale", "din", "lui", "of", "the", "i"}


def _normalize_text(raw: str) -> str:
    """Normalizare intensivă pentru de-duplicare titluri similare."""
    if not raw:
        return ""
    val = unicodedata.normalize("NFKD", raw)
    val = "".join(ch for ch in val if not unicodedata.combining(ch))
    val = val.casefold()
    val = val.replace("ă", "a").replace("â", "a").replace("î", "i")
    val = val.replace("ș", "s").replace("ş", "s").replace("ț", "t").replace("ţ", "t")
    val = re.sub(r"[^a-z0-9\s]", " ", val)
    return re.sub(r"\s+", " ", val).strip()


def _title_normalization_key(raw: str) -> str:
    val = raw
    val = re.sub(r"^fost(ul)?\s+", "", val, flags=re.IGNORECASE)
    val = re.sub(r"\s*\(.*?\)\s*", " ", val)
    norm = _normalize_text(val)
    if not norm:
        return ""
    words = norm.split()
    new_words = []
    for w in words:
        w_syn = TITLE_SYNONYMS.get(w, w)
        if w_syn in PREPOSITIONS:
            continue
        new_words.append(w_syn)
    return " ".join(new_words).strip()


def _titles_similar(a: str, b: str) -> bool:
    key_a = _title_normalization_key(a)
    key_b = _title_normalization_key(b)
    if not key_a or not key_b:
        return False
    ratio = difflib.SequenceMatcher(None, key_a, key_b).ratio()
    return ratio >= TITLE_SIMILARITY_THRESHOLD


def _confidence_level(confidence: str | None) -> int:
    if not confidence:
        return 0
    return CONFIDENCE_ORDER.get(confidence, 0)


# ── 1. consolidate_title_at ──────────────────────────────────────────────────

def consolidate_title_at(statements: list[dict]) -> dict:
    """Consolidează afirmațiile de tip title_at cu ordonare cronologică reală.

    Folosește MAIN_SERIES_YEARS ca axă cronologică principală.
    Filtrează zgomotul (pagini, fragmente, texte non-titlu).
    Păstrează `pozitie_cronologica` pe fiecare intrare din array-ul `titles`.

    Returns:
        {
            "titlu_curent": str | None,
            "titles": [
                {
                    "titlu": str,
                    "surse": [...],
                    "pozitie_cronologica": {"an_aproximativ": int|None, "carte": str|None, "fragment": int|str|None}
                }
            ]
        }
    """
    title_stmts = [s for s in statements
                   if s.get("predicate") == "title_at"
                   or s.get("predicat_original") == "title_at"]

    if not title_stmts:
        return {"titlu_curent": None, "titles": []}

    # 1. Filtrare zgomot inițială și calcul poziție cronologică
    candidates = []
    for stmt in title_stmts:
        raw_text = stmt.get("valoare") or stmt.get("object") or stmt.get("text") or ""
        if is_title_noise(raw_text):
            continue

        year, frag_num, pozitie_dict = _get_chrono_position(
            stmt.get("source_book"), stmt.get("source_fragment")
        )

        candidates.append({
            "raw_text": raw_text.strip(),
            "stmt": stmt,
            "year": year,
            "frag_num": frag_num,
            "pozitie_cronologica": pozitie_dict,
        })

    if not candidates:
        return {"titlu_curent": None, "titles": []}

    # 2. Grupare titluri similare
    groups = []
    for cand in candidates:
        raw_text = cand["raw_text"]
        matched = False
        for group in groups:
            if _titles_similar(raw_text, group[0]["raw_text"]):
                group.append(cand)
                matched = True
                break
        if not matched:
            groups.append([cand])

    # 3. Construire intrări titlu finale
    title_entries = []
    for group in groups:
        texts = [item["raw_text"] for item in group]
        canonical = max(set(texts), key=lambda t: (texts.count(t), len(t)))

        # Sortează variantele din grup după cronologie pentru a lua prima poziție cronologică
        group.sort(key=lambda item: (item["year"], item["frag_num"]))
        earliest_item = group[0]

        sources = []
        for item in group:
            s = item["stmt"]
            src = {
                "source_book": s.get("source_book"),
                "source_fragment": s.get("source_fragment"),
                "source_page": s.get("source_page"),
                "confidence": s.get("confidence"),
            }
            if not any(src.items() == other.items() for other in sources):
                sources.append(src)

        title_entries.append({
            "titlu": canonical,
            "surse": sources,
            "pozitie_cronologica": earliest_item["pozitie_cronologica"],
            "_sort_key": (earliest_item["year"], earliest_item["frag_num"]),
        })

    # 4. Sortează titlurile cronologic după anul de carte și fragment
    title_entries.sort(key=lambda e: e["_sort_key"])

    # titlu_curent = ultimul titlu valid în ordine cronologică
    titlu_curent = title_entries[-1]["titlu"] if title_entries else None

    # Curățare cheie internă de sortare înainte de return
    titles_out = []
    for entry in title_entries:
        titles_out.append({
            "titlu": entry["titlu"],
            "surse": entry["surse"],
            "pozitie_cronologica": entry["pozitie_cronologica"],
        })

    return {
        "titlu_curent": titlu_curent,
        "titles": titles_out,
    }


# ── 2. consolidate_died ──────────────────────────────────────────────────────

def is_suspect_concatenated(text: str | None) -> bool:
    """Detects if a death description is a suspect concatenated string.

    REGULA DE DETECȚIE A CONCATENĂRILOR SUSPECTE:
    Un text este suspect de a fi format prin lipirea automată/eronată a mai multor
    afirmații de moarte dacă:
      1. Conține caracterul ';' care indică separarea segmentelor.
      2. Are cel puțin 2 segmente rezultate în urma split-ului, iar cel puțin
         două dintre aceste segmente conțin cuvinte cheie specifice morții:
         'mort', 'moart', 'decedat', 'ucis', 'murit'.
    """
    if not text or not isinstance(text, str):
        return False

    # Separăm textul în segmente folosind ";"
    segments = [seg.strip() for seg in text.lower().split(";") if seg.strip()]
    if len(segments) < 2:
        return False

    # Numărăm câte segmente conțin cel puțin un cuvânt cheie de moarte
    keywords = ["mort", "moart", "decedat", "ucis", "murit"]
    death_segments_count = 0
    for seg in segments:
        if any(kw in seg for kw in keywords):
            death_segments_count += 1

    return death_segments_count >= 2


def consolidate_died(statements: list[dict]) -> dict:
    """Consolidează afirmațiile de moarte.

    Aplică o regulă de detecție a textelor suspect concatenate ca tie-break secundar
    (după confidence level, dar înainte de lungimea textului), deprioritizându-le.
    """
    died_stmts = [s for s in statements
                  if s.get("predicate") == "died"
                  or s.get("predicat_original") == "died"]

    if not died_stmts:
        return {"descriere": None, "confidence": None, "variante": None}

    def _sort_key(s):
        level = _confidence_level(s.get("confidence"))
        desc = s.get("valoare") or s.get("object") or ""
        suspect = 1 if is_suspect_concatenated(desc) else 0
        # Sortarea este ascendentă:
        # - confidence nivel mare (-level e mai mic) -> preferat primul
        # - suspect este 0 sau 1 (0 e mai mic) -> preferat primul (curat înaintea celui suspect)
        # - lungime mai mare (-len e mai mic) -> preferat primul (mai detaliat)
        return (-level, suspect, -len(desc))

    died_stmts.sort(key=_sort_key)

    best = died_stmts[0]
    best_text = (best.get("valoare") or best.get("object") or "").strip() or None
    best_confidence = best.get("confidence")

    variante = []
    seen_texts = set()
    if best_text:
        seen_texts.add(best_text.lower())

    for s in died_stmts[1:]:
        text = (s.get("valoare") or s.get("object") or "").strip()
        if not text or text.lower() in seen_texts:
            continue
        seen_texts.add(text.lower())
        variante.append({
            "descriere": text,
            "source_book": s.get("source_book"),
            "source_fragment": s.get("source_fragment"),
            "source_page": s.get("source_page"),
            "confidence": s.get("confidence"),
        })

    highest_level = max(_confidence_level(s.get("confidence")) for s in died_stmts)
    confidence_map = {0: "uncertain", 1: "probable", 2: "confirmed"}

    return {
        "descriere": best_text,
        "confidence": confidence_map.get(highest_level, best_confidence or "uncertain"),
        "variante": variante if variante else None,
    }


# ── 3. consolidate_family_relations ─────────────────────────────────────────

def consolidate_family_relations(
    all_person_records: dict[str, dict],
    all_grouped: dict[str, dict[str, list]],
) -> None:
    """Consolidează relațiile de familie fără mutații încrucișate între entități.

    Pentru fiecare pereche (A, B) de entități:
      - Verifică STRICT dacă A parent_of -> B ȘI B child_of -> A (sau invers)
        și combină sursele DOAR pentru acea pereche exactă (A, B).
      - Nu permite auto-relaționare (A parent_of A / A child_of A / A sibling_of A).
      - Verifică sibling_of (relație simetrică): dacă A sibling_of -> B ȘI B sibling_of -> A
        apar ca afirmații separate, le unifică într-o singură intrare per pereche.
    """
    FAMILY_PREDS = {"parent_of", "child_of", "sibling_of", "married_to"}

    # Pasul 1: Inversarea corectă a predicatelor când sunt indexate după obiect
    # Aceasta garantează că în grouped[entity_id]:
    # - parent_of conține DOAR copiii entității
    # - child_of conține DOAR părinții entității
    # - sibling_of conține DOAR frații entității
    for entity_id, grouped in all_grouped.items():
        for pred in list(FAMILY_PREDS):
            stmts = grouped.get(pred, [])
            valid_stmts = []
            for stmt in stmts:
                target = stmt.get("valoare")
                # Prevenire auto-referențiere (ex: Robb Stark parent_of Robb Stark)
                if target == entity_id:
                    continue
                valid_stmts.append(stmt)
            grouped[pred] = valid_stmts

    # Pasul 2: Grupare și unificare surse STRICT per pereche exactă (A, B)
    def _extract_source(stmt: dict) -> dict:
        return {
            "source_book": stmt.get("source_book"),
            "source_fragment": stmt.get("source_fragment"),
            "source_page": stmt.get("source_page"),
            "confidence": stmt.get("confidence"),
        }

    def _merge_sources(sources_a: list[dict], sources_b: list[dict]) -> list[dict]:
        seen = set()
        merged = []
        for s in sources_a + sources_b:
            key = json.dumps(s, ensure_ascii=False, sort_keys=True)
            if key not in seen:
                seen.add(key)
                merged.append(s)
        return merged

    # Pentru fiecare entitate A, procesăm predicat cu predicat
    for entity_id, grouped in all_grouped.items():
        # A. parent_of: copiii entității A
        # Perechea (A, B): A parent_of B <-> B child_of A
        parent_stmts = grouped.get("parent_of", [])
        child_targets = set()
        for s in parent_stmts:
            t = s.get("valoare")
            if t and t != entity_id:
                child_targets.add(t)

        new_parent_stmts = []
        for target_id in sorted(child_targets):
            sources_from_a = [_extract_source(s) for s in parent_stmts if s.get("valoare") == target_id]
            # Căutăm afirmații reciproce B child_of A în datele lui B
            b_child_stmts = all_grouped.get(target_id, {}).get("child_of", [])
            sources_from_b = [_extract_source(s) for s in b_child_stmts if s.get("valoare") == entity_id]

            combined_sources = _merge_sources(sources_from_a, sources_from_b)
            # Salvăm o singură intrare reprezentativă cu sursele combinate pentru (A, target_id)
            base_stmt = parent_stmts[0] if parent_stmts else {}
            new_stmt = dict(base_stmt)
            new_stmt["valoare"] = target_id
            new_stmt["surse_combinate"] = combined_sources
            new_parent_stmts.append(new_stmt)

        grouped["parent_of"] = new_parent_stmts

        # B. child_of: părinții entității A
        # Perechea (A, B): A child_of B <-> B parent_of A
        child_stmts = grouped.get("child_of", [])
        parent_targets = set()
        for s in child_stmts:
            t = s.get("valoare")
            if t and t != entity_id:
                parent_targets.add(t)

        new_child_stmts = []
        for target_id in sorted(parent_targets):
            sources_from_a = [_extract_source(s) for s in child_stmts if s.get("valoare") == target_id]
            b_parent_stmts = all_grouped.get(target_id, {}).get("parent_of", [])
            sources_from_b = [_extract_source(s) for s in b_parent_stmts if s.get("valoare") == entity_id]

            combined_sources = _merge_sources(sources_from_a, sources_from_b)
            base_stmt = child_stmts[0] if child_stmts else {}
            new_stmt = dict(base_stmt)
            new_stmt["valoare"] = target_id
            new_stmt["surse_combinate"] = combined_sources
            new_child_stmts.append(new_stmt)

        grouped["child_of"] = new_child_stmts

        # C. sibling_of (relație simetrică): frații entității A
        # Perechea (A, B): A sibling_of B <-> B sibling_of A
        sibling_stmts = grouped.get("sibling_of", [])
        sibling_targets = set()
        for s in sibling_stmts:
            t = s.get("valoare")
            if t and t != entity_id:
                sibling_targets.add(t)

        new_sibling_stmts = []
        for target_id in sorted(sibling_targets):
            sources_from_a = [_extract_source(s) for s in sibling_stmts if s.get("valoare") == target_id]
            b_sibling_stmts = all_grouped.get(target_id, {}).get("sibling_of", [])
            sources_from_b = [_extract_source(s) for s in b_sibling_stmts if s.get("valoare") == entity_id]

            combined_sources = _merge_sources(sources_from_a, sources_from_b)
            base_stmt = sibling_stmts[0] if sibling_stmts else {}
            new_stmt = dict(base_stmt)
            new_stmt["valoare"] = target_id
            new_stmt["surse_combinate"] = combined_sources
            new_sibling_stmts.append(new_stmt)

        grouped["sibling_of"] = new_sibling_stmts

        # D. married_to (relație simetrică)
        married_stmts = grouped.get("married_to", [])
        married_targets = set()
        for s in married_stmts:
            t = s.get("valoare")
            if t and t != entity_id:
                married_targets.add(t)

        new_married_stmts = []
        for target_id in sorted(married_targets):
            sources_from_a = [_extract_source(s) for s in married_stmts if s.get("valoare") == target_id]
            b_married_stmts = all_grouped.get(target_id, {}).get("married_to", [])
            sources_from_b = [_extract_source(s) for s in b_married_stmts if s.get("valoare") == entity_id]

            combined_sources = _merge_sources(sources_from_a, sources_from_b)
            base_stmt = married_stmts[0] if married_stmts else {}
            new_stmt = dict(base_stmt)
            new_stmt["valoare"] = target_id
            new_stmt["surse_combinate"] = combined_sources
            new_married_stmts.append(new_stmt)

        grouped["married_to"] = new_married_stmts

    # Pasul 3: Detectarea și excluderea contradicțiilor parent_of / child_of
    # O contradicție directă apare dacă o entitate A are o entitate B în ambele liste
    # (adică A parent_of B și A child_of B).
    for entity_id, grouped in all_grouped.items():
        parent_stmts = grouped.get("parent_of", [])
        child_stmts = grouped.get("child_of", [])

        parent_targets = {s["valoare"]: s for s in parent_stmts if s.get("valoare")}
        child_targets = {s["valoare"]: s for s in child_stmts if s.get("valoare")}

        contradictions = set(parent_targets.keys()) & set(child_targets.keys())

        if contradictions:
            if "contradictii_relatii_familie" not in grouped:
                grouped["contradictii_relatii_familie"] = []

            for target_id in sorted(contradictions):
                p_stmt = parent_targets[target_id]
                c_stmt = child_targets[target_id]

                # Salvăm înregistrarea contradicției
                grouped["contradictii_relatii_familie"].append({
                    "valoare": target_id,
                    "parent_of_sources": p_stmt.get("surse_combinate", []),
                    "child_of_sources": c_stmt.get("surse_combinate", []),
                })

            # Excludem din listele normale
            grouped["parent_of"] = [s for s in parent_stmts if s["valoare"] not in contradictions]
            grouped["child_of"] = [s for s in child_stmts if s["valoare"] not in contradictions]


# ── Test Harness & Verification ──────────────────────────────────────────────

def _load_data():
    entities = []
    for f in sorted(Path(IMPORT).glob("entities*.json")):
        entities.extend(json.loads(f.read_text(encoding="utf-8")))
    entity_map = {e["id"]: e for e in entities}

    statements = []
    for f in sorted(Path(IMPORT).glob("statements_persoane_part*.json")):
        statements.extend(json.loads(f.read_text(encoding="utf-8")))

    return entity_map, statements


def _compact_statement(statement, direction, effective_predicate=None):
    return {
        "directie": direction,
        "predicat_original": statement["predicate"],
        "predicate": effective_predicate or statement["predicate"],
        "valoare": statement.get("object") if direction == "subject" else statement.get("subject"),
        "confidence": statement.get("confidence"),
        "source_book": statement.get("source_book"),
        "source_fragment": statement.get("source_fragment"),
        "source_page": statement.get("source_page"),
    }


def test() -> dict:
    """Rulează testarea pe toți cei 10 oameni din cerință și execută verificările de regresie."""
    import sys
    sys.stdout.reconfigure(encoding="utf-8")

    entity_map, statements = _load_data()

    known_ids = [
        "PERSON_JON_ARRYN",
        "PERSON_CATELYN_STARK",
        "PERSON_ROBERT_BARATHEON",
        "PERSON_DAENERYS_TARGARYEN",
        "PERSON_TYRION_LANNISTER",
        "PERSON_CERSEI_LANNISTER",
        "PERSON_JAIME_LANNISTER",
        "PERSON_JON_SNOW",
        "PERSON_ROBB_STARK",
        "PERSON_SANSA_STARK",
    ]

    by_subject = defaultdict(list)
    by_object = defaultdict(list)
    for stmt in statements:
        by_subject[stmt["subject"]].append(stmt)
        if "object" in stmt:
            by_object[stmt["object"]].append(stmt)

    # Inversare corectă a predicatelor la indexarea după obiect
    INVERSE_RELATION = {
        "ally_of": "ally_of", "enemy_of": "enemy_of", "branch_of": "branch_of",
        "vassal_of": "liege_of", "liege_of": "vassal_of",
        "parent_of": "child_of",
        "child_of": "parent_of",
        "sibling_of": "sibling_of",
        "married_to": "married_to",
    }

    all_records = {}
    all_grouped = {}

    for entity_id in known_ids:
        entity = entity_map.get(entity_id, {})
        name = entity.get("nume_canonic", entity_id)

        grouped = defaultdict(list)
        for stmt in by_subject.get(entity_id, []):
            grouped[stmt["predicate"]].append(_compact_statement(stmt, "subject"))
        for stmt in by_object.get(entity_id, []):
            pred = INVERSE_RELATION.get(stmt["predicate"], stmt["predicate"])
            grouped[pred].append(_compact_statement(stmt, "object", pred))

        all_grouped[entity_id] = grouped

        flat_statements = []
        for pred_stmts in grouped.values():
            flat_statements.extend(pred_stmts)

        title_result = consolidate_title_at(flat_statements)
        died_result = consolidate_died(flat_statements)

        all_records[entity_id] = {
            "name": name,
            "titlu_curent": title_result["titlu_curent"],
            "titles": title_result["titles"],
            "moarte": died_result,
        }

    # Aplicăm consolidarea bidirecțională de familie fără mutații încrucișate
    consolidate_family_relations(all_records, all_grouped)

    print("=" * 100)
    print("REZULTAT COMPLET TEST() PENTRU TOȚI CEI 10 OAMENI")
    print("=" * 100)

    for entity_id in known_ids:
        rec = all_records[entity_id]
        grouped = all_grouped[entity_id]

        print(f"\n{'─' * 80}")
        print(f"  {rec['name']} ({entity_id})")
        print(f"{'─' * 80}")

        # 1. title_at
        print(f"  ■ titlu_curent = {rec['titlu_curent']!r}")
        print(f"    titles ({len(rec['titles'])} intrări ordonate cronologic cu poziție):")
        for i, t in enumerate(rec["titles"], 1):
            pos = t["pozitie_cronologica"]
            print(f"      {i}. \"{t['titlu']}\"")
            print(f"         [an={pos['an_aproximativ']}, carte={pos['carte']!r}, frag={pos['fragment']}]")

        # 2. died
        morte = rec.get("moarte", {})
        print(f"  ■ moarte.descriere = {morte.get('descriere')!r}")
        print(f"    confidence = {morte.get('confidence')}")
        if morte.get("variante"):
            print(f"    variante ({len(morte['variante'])}):")
            for v in morte["variante"]:
                print(f"      • \"{v['descriere']}\" [{v.get('source_book','?')} f{v.get('source_fragment','?')}]")
        else:
            print("    variante = None")

        # 3. relatii de familie
        print("  ■ relații de familie:")
        for pred in ("parent_of", "child_of", "sibling_of", "married_to", "contradictii_relatii_familie"):
            stmts = grouped.get(pred, [])
            if not stmts and pred == "contradictii_relatii_familie":
                continue
            targets = [s["valoare"] for s in stmts]
            target_names = [f"{entity_map.get(t, {}).get('nume_canonic', t)} ({t})" for t in targets]
            print(f"    - {pred}: {target_names if target_names else '[]'}")

    # ── Test de Regresie Pasul 4 ──────────────────────────────────────────────
    print("\n" + "=" * 100)
    print("VERIFICARE EXPLICITĂ TEST DE REGRESIE (PASUL 4)")
    print("=" * 100)

    # Regresie 1: Robb Stark NU mai apare în propriul lui parent_of
    robb_grouped = all_grouped.get("PERSON_ROBB_STARK", {})
    robb_parent_targets = [s["valoare"] for s in robb_grouped.get("parent_of", [])]
    check1_pass = "PERSON_ROBB_STARK" not in robb_parent_targets
    print(f"\n1. Robb Stark NU mai apare în propriul lui parent_of: [{'PASS' if check1_pass else 'FAIL'}]")
    print(f"   Targets în parent_of pentru Robb Stark: {robb_parent_targets}")

    # Regresie 2: Jon Snow NU mai are Eddard Stark/Robb Stark în parent_of
    jon_grouped = all_grouped.get("PERSON_JON_SNOW", {})
    jon_parent_targets = [s["valoare"] for s in jon_grouped.get("parent_of", [])]
    jon_child_targets = [s["valoare"] for s in jon_grouped.get("child_of", [])]
    bad_in_jon_parent = [t for t in jon_parent_targets if t in ("PERSON_EDDARD_STARK", "PERSON_ROBB_STARK")]
    check2_pass = len(bad_in_jon_parent) == 0 and "PERSON_EDDARD_STARK" in jon_child_targets
    print(f"\n2. Jon Snow NU mai are Eddard Stark/Robb Stark în parent_of: [{'PASS' if check2_pass else 'FAIL'}]")
    print(f"   Jon Snow parent_of: {jon_parent_targets}")
    print(f"   Jon Snow child_of: {jon_child_targets} (Eddard Stark este părintele lui Jon)")

    # Regresie 3: titlu_curent pentru Robert, Daenerys, Robb, Sansa nu e număr de pagină / zgomot
    target_persons = [
        ("PERSON_ROBERT_BARATHEON", "Robert Baratheon"),
        ("PERSON_DAENERYS_TARGARYEN", "Daenerys Targaryen"),
        ("PERSON_ROBB_STARK", "Robb Stark"),
        ("PERSON_SANSA_STARK", "Sansa Stark"),
    ]

    print("\n3. titlu_curent pentru Robert, Daenerys, Robb, Sansa nu e număr de pagină sau fragment de zgomot:")
    check3_pass = True
    for pid, pname in target_persons:
        rec = all_records.get(pid, {})
        tc = rec.get("titlu_curent")
        is_ok = tc is None or not is_title_noise(tc)
        if not is_ok:
            check3_pass = False
        print(f"   - {pname}: titlu_curent = {tc!r} -> [{'PASS' if is_ok else 'FAIL'}]")

    print(f"\nSTATUS REGRESIE PUNCTUL 3: [{'PASS' if check3_pass else 'FAIL'}]")

    all_tests_pass = check1_pass and check2_pass and check3_pass
    print(f"\nALL REGRESSION CHECKS: [{'PASS' if all_tests_pass else 'FAIL'}]")
    print("=" * 100)

    return all_records


if __name__ == "__main__":
    test()
