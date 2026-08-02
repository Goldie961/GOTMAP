#!/usr/bin/env python3
import json, re, sys, unicodedata, difflib
from pathlib import Path
from collections import defaultdict

sys.path.append(str(Path(__file__).resolve().parent))
import consolidation_functions
import aggregate_import

ROOT = Path("C:/Users/andre/OneDrive/Desktop/GOT MAP")

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

def _title_normalization_key_old(raw: str) -> str:
    val = raw
    val = re.sub(r"^fost(ul)?\s+", "", val, flags=re.IGNORECASE)
    val = re.sub(r"\s*\(.*?\)\s*", " ", val)
    return consolidation_functions._normalize_text(val)

def _title_normalization_key_new(raw: str) -> str:
    val = raw
    val = re.sub(r"^fost(ul)?\s+", "", val, flags=re.IGNORECASE)
    val = re.sub(r"\s*\(.*?\)\s*", " ", val)
    norm = consolidation_functions._normalize_text(val)
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

def _titles_similar_old(a: str, b: str) -> bool:
    key_a = _title_normalization_key_old(a)
    key_b = _title_normalization_key_old(b)
    if not key_a or not key_b:
        return False
    return difflib.SequenceMatcher(None, key_a, key_b).ratio() >= 0.80

def _titles_similar_new(a: str, b: str) -> bool:
    key_a = _title_normalization_key_new(a)
    key_b = _title_normalization_key_new(b)
    if not key_a or not key_b:
        return False
    return difflib.SequenceMatcher(None, key_a, key_b).ratio() >= 0.80

entities = aggregate_import.load_entities()
statements = aggregate_import.load_statements()

by_subject = defaultdict(list)
by_object = defaultdict(list)
for stmt in statements:
    by_subject[stmt["subject"]].append(stmt)
    by_object[stmt["object"]].append(stmt)

INVERSE_RELATION = {
    "ally_of": "ally_of", "enemy_of": "enemy_of", "branch_of": "branch_of",
    "vassal_of": "liege_of", "liege_of": "vassal_of",
    "parent_of": "child_of", "child_of": "parent_of",
    "sibling_of": "sibling_of", "married_to": "married_to",
}

diff_count = 0
examples = []

for entity_id, entity in sorted(entities.items()):
    if entity.get("tip") != "persoana":
        continue
    name = entity.get("nume_canonic", entity_id)

    grouped = defaultdict(list)
    for stmt in by_subject.get(entity_id, []):
        grouped[stmt["predicate"]].append(consolidation_functions._compact_statement(stmt, "subject"))
    for stmt in by_object.get(entity_id, []):
        pred = INVERSE_RELATION.get(stmt["predicate"], stmt["predicate"])
        grouped[pred].append(consolidation_functions._compact_statement(stmt, "object", pred))

    flat_statements = []
    for pred_stmts in grouped.values():
        flat_statements.extend(pred_stmts)

    consolidation_functions._titles_similar = _titles_similar_old
    res_old = consolidation_functions.consolidate_title_at(flat_statements)

    consolidation_functions._titles_similar = _titles_similar_new
    res_new = consolidation_functions.consolidate_title_at(flat_statements)

    titles_old = [t["titlu"] for t in res_old["titles"]]
    titles_new = [t["titlu"] for t in res_new["titles"]]

    if len(titles_new) < len(titles_old):
        diff_count += 1
        # Find which titles were merged
        merged_out = set(titles_old) - set(titles_new)
        examples.append({
            "id": entity_id,
            "name": name,
            "old_titles": titles_old,
            "new_titles": titles_new,
            "merged_out": list(merged_out)
        })

print(f"Total characters with unified titles: {diff_count}")
print("\nTop 20 Examples of unification:")
for i, ex in enumerate(examples[:20], 1):
    print(f"\n{i}. {ex['name']} ({ex['id']})")
    print(f"   Old ({len(ex['old_titles'])}): {ex['old_titles']}")
    print(f"   New ({len(ex['new_titles'])}): {ex['new_titles']}")
    print(f"   Merged out: {ex['merged_out']}")

