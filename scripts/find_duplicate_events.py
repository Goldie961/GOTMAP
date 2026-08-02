#!/usr/bin/env python3
"""
scripts/find_duplicate_events.py

Detects potential duplicate event candidates between original and imported events,
and within imported events.
Does NOT modify events.json.
Outputs data/_import/etl_output/duplicate_events_candidati.json.
"""

from __future__ import annotations

import json
import hashlib
import re
import sys
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[1]
EVENTS_PATH = ROOT / "data" / "events" / "events.json"
OUTPUT_PATH = ROOT / "data" / "_import" / "etl_output" / "duplicate_events_candidati.json"

STOP_WORDS = {
    # Romanian
    'la', 'de', 'pe', 'in', 'cu', 'din', 'si', 'o', 'un', 'au', 'a', 'ale', 'ai', 'al', 'unei', 'unor',
    'despre', 'pentru', 'prin', 'fost', 's-a', 'ce', 'care', 'lui', 'ei', 'lor', 'dupa', 'pana', 'mai',
    'fost', 'fostu', 'este', 'sunt', 'am', 'are', 'aceasta', 'acest', 'acestia', 'acestea',
    # English
    'the', 'of', 'at', 'and', 'in', 'to', 'for', 'with', 'on', 'a', 'an', 'by', 'from', 'is', 'was',
    'were', 'been', 'be', 'this', 'that', 'these', 'those'
}

TRANSLATION_MAP = {
    'landing': ['debarcare', 'debarcat'],
    'blackwater': ['apa neagra', 'apei negre'],
    'gulltown': ['gulltown'],
    'harrenhal': ['harrenhal'],
    'storm': ['furtuna', 'furtunii'],
    'field': ['campul', 'camp'],
    'fire': ['foc', 'focului'],
    'moat': ['moat'],
    'cailin': ['cailin'],
    'eyrie': ['eyrie', 'cuibul'],
    'sunspear': ['sunspear'],
    'oldtown': ['oldtown', 'orasul vechi'],
    'king': ['rege', 'regelui'],
    'kings': ['rege', 'regelui'],
    'great': ['mare', 'marele'],
    'council': ['consiliu'],
    'wolf': ['lup', 'lupului'],
    'hour': ['ora'],
    'dorne': ['dorne'],
    'sickness': ['molima', 'boala', 'ciuma'],
    'spring': ['primavara'],
    'tourney': ['turnir', 'turnirul'],
    'sack': ['jefuirea', 'jefuit'],
    'siege': ['asediu', 'asediul'],
    'red': ['rosie', 'rosu'],
    'wedding': ['nunta'],
    'burning': ['incendierea', 'arderea', 'ars']
}

def get_file_hash(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def strip_accents(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', str(text))
    return "".join([c for c in nfkd if not unicodedata.combining(c)])

def tokenize(text: str) -> list[str]:
    text_clean = strip_accents(text).lower()
    words = re.findall(r'[a-z0-9]+', text_clean)
    return [w for w in words if len(w) > 1 and w not in STOP_WORDS]

def normalize_participant_id(p_id: str) -> str:
    if not p_id:
        return ""
    clean = strip_accents(str(p_id)).lower()
    clean = re.sub(r'^person_', '', clean)
    clean = re.sub(r'_[i|v|x]+$', '', clean)
    clean = clean.replace('_', ' ').strip()
    return clean

class EventFeatures:
    def __init__(self, raw_event: dict):
        self.raw = raw_event
        self.id = raw_event.get("id", "")
        self.id_intern = raw_event.get("id_intern", "")
        self.is_original = not self.id_intern.startswith("EVENT_")
        self.source = "original" if self.is_original else "importat"
        
        # Year
        year_val = raw_event.get("year")
        if year_val is None:
            year_val = raw_event.get("an_aproximativ")
        self.year = year_val
        
        # Location
        self.location = raw_event.get("location")
        
        # Name
        self.name = raw_event.get("name", "")
        
        # Tokens
        name_toks = tokenize(self.name)
        id_toks = tokenize(self.id)
        id_intern_toks = tokenize(self.id_intern)
        desc_toks = tokenize(raw_event.get("description", ""))
        self.tokens = set(name_toks + id_toks + id_intern_toks + desc_toks)
        
        # Expanded translated tokens for cross-language comparison
        self.translated_tokens = set(self.tokens)
        for t in self.tokens:
            if t in TRANSLATION_MAP:
                syns = TRANSLATION_MAP[t]
                if isinstance(syns, list):
                    for s in syns:
                        self.translated_tokens.update(tokenize(s))
                else:
                    self.translated_tokens.update(tokenize(syns))
                    
        # Participants
        self.participants_norm = {} # norm_name -> raw_id
        for field in ['participants', 'participanti']:
            items = raw_event.get(field) or []
            for item in items:
                p_id = item if isinstance(item, str) else item.get('id')
                if p_id:
                    norm = normalize_participant_id(p_id)
                    if norm:
                        self.participants_norm[norm] = p_id
        self.participant_keys = set(self.participants_norm.keys())

def evaluate_candidate_pair(ev_a: EventFeatures, ev_b: EventFeatures) -> tuple[bool, dict | None]:
    # 1. Year proximity
    if ev_a.year is not None and ev_b.year is not None:
        year_diff = abs(ev_a.year - ev_b.year)
        an_apropiat = (year_diff <= 5)
    else:
        year_diff = None
        an_apropiat = False
        
    locatie_comuna = (ev_a.location is not None and ev_b.location is not None and ev_a.location == ev_b.location)
    common_toks = ev_a.translated_tokens.intersection(ev_b.translated_tokens)
    
    # Participant matching
    common_parts = []
    for norm_a, raw_a in ev_a.participants_norm.items():
        for norm_b, raw_b in ev_b.participants_norm.items():
            if norm_a == norm_b or (len(norm_a) > 3 and norm_a in norm_b) or (len(norm_b) > 3 and norm_b in norm_a):
                label = raw_a if raw_a == raw_b else f"{raw_a} / {raw_b}"
                if label not in common_parts:
                    common_parts.append(label)
                break
    participanti_comuni = len(common_parts) > 0
    
    # 2. Name similarity score
    name_a_clean = strip_accents(ev_a.name).lower()
    name_b_clean = strip_accents(ev_b.name).lower()
    
    if not ev_a.tokens or not ev_b.tokens:
        tok_sim = 0.0
    else:
        tok_sim = len(common_toks) / max(1, min(len(ev_a.tokens), len(ev_b.tokens)))
        
    seq_ratio = SequenceMatcher(None, name_a_clean, name_b_clean).ratio() if tok_sim > 0.05 or abs(len(name_a_clean) - len(name_b_clean)) < 10 else 0.0
    nume_score = round(min(1.0, max(seq_ratio, tok_sim)), 2)
    
    # 3. Combined score calculation
    score = nume_score * 0.50
    if an_apropiat:
        score += 0.20
    if locatie_comuna:
        score += 0.15
    if participanti_comuni:
        score += 0.15
        
    scor = round(min(1.0, score), 2)
    
    # 4. Reporting threshold check
    is_candidate = (scor >= 0.45) or (nume_score >= 0.50) or (an_apropiat and locatie_comuna and participanti_comuni)
    
    if not is_candidate:
        return False, None
        
    candidate_obj = {
        "event_a_id": ev_a.id,
        "event_a_year": ev_a.year,
        "event_a_source": ev_a.source,
        "event_b_id": ev_b.id,
        "event_b_year": ev_b.year,
        "event_b_source": ev_b.source,
        "scor": scor,
        "semnale": {
            "nume": nume_score,
            "an_apropiat": an_apropiat,
            "locatie_comuna": locatie_comuna,
            "participanti_comuni": common_parts
        }
    }
    return True, candidate_obj

def generate_candidate_pairs(events: list[EventFeatures]) -> set[tuple[int, int]]:
    pairs = set()
    
    # Index by translated token
    token_index: dict[str, list[int]] = {}
    for idx, ev in enumerate(events):
        for tok in ev.translated_tokens:
            token_index.setdefault(tok, []).append(idx)
            
    for tok, indices in token_index.items():
        if len(indices) < 200: # ignore overly common words if any
            for i in range(len(indices)):
                for j in range(i + 1, len(indices)):
                    idx_a, idx_b = min(indices[i], indices[j]), max(indices[i], indices[j])
                    pairs.add((idx_a, idx_b))
                    
    # Index by location
    loc_index: dict[str, list[int]] = {}
    for idx, ev in enumerate(events):
        if ev.location:
            loc_index.setdefault(ev.location, []).append(idx)
            
    for loc, indices in loc_index.items():
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                idx_a, idx_b = min(indices[i], indices[j]), max(indices[i], indices[j])
                pairs.add((idx_a, idx_b))
                
    # Index by participant
    part_index: dict[str, list[int]] = {}
    for idx, ev in enumerate(events):
        for p in ev.participant_keys:
            part_index.setdefault(p, []).append(idx)
            
    for p, indices in part_index.items():
        if len(indices) < 200:
            for i in range(len(indices)):
                for j in range(i + 1, len(indices)):
                    idx_a, idx_b = min(indices[i], indices[j]), max(indices[i], indices[j])
                    pairs.add((idx_a, idx_b))
                    
    return pairs

def main():
    hash_before = get_file_hash(EVENTS_PATH)
    size_before = EVENTS_PATH.stat().st_size
    
    with EVENTS_PATH.open(encoding="utf-8") as f:
        raw_events = json.load(f)
        
    all_features = [EventFeatures(e) for e in raw_events]
    
    orig_events = [ef for ef in all_features if ef.is_original]
    imp_events = [ef for ef in all_features if not ef.is_original]
    
    print(f"Loaded {len(all_features)} events: {len(orig_events)} original, {len(imp_events)} imported.")
    
    # Priority 1: Original vs Imported (all 20 x 1662)
    p1_candidates = []
    for orig in orig_events:
        for imp in imp_events:
            is_cand, obj = evaluate_candidate_pair(orig, imp)
            if is_cand and obj:
                p1_candidates.append(obj)
                
    # Priority 2: Imported vs Imported using candidate pair index
    p2_candidates = []
    imp_candidate_pairs = generate_candidate_pairs(imp_events)
    print(f"Priority 2 candidate pairs to check: {len(imp_candidate_pairs)} (pruned from 1,380,291)")
    
    for idx_a, idx_b in imp_candidate_pairs:
        is_cand, obj = evaluate_candidate_pair(imp_events[idx_a], imp_events[idx_b])
        if is_cand and obj:
            p2_candidates.append(obj)
            
    all_candidates = p1_candidates + p2_candidates
    all_candidates.sort(key=lambda x: x["scor"], reverse=True)
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(all_candidates, f, ensure_ascii=False, indent=2)
        f.write("\n")
        
    hash_after = get_file_hash(EVENTS_PATH)
    size_after = EVENTS_PATH.stat().st_size
    
    assert hash_before == hash_after, "CRITICAL: events.json hash changed!"
    assert size_before == size_after, "CRITICAL: events.json size changed!"
    
    report_summary = {
        "priority_1_count": len(p1_candidates),
        "priority_2_count": len(p2_candidates),
        "total_candidates": len(all_candidates),
        "events_json_unmodified": True,
        "hash_before": hash_before,
        "hash_after": hash_after
    }
    
    print("\n=== DETECTION REPORT SUMMARY ===")
    print(json.dumps(report_summary, indent=2, ensure_ascii=False))
    
    print(f"\nReport generated at: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
