import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_PATH = ROOT / "data" / "characters" / "characters.json"
CONTRADICTIONS_PATH = ROOT / "data" / "_import" / "etl_output" / "contradictii_familie_needs_review.json"
OUTPUT_PATH = ROOT / "data" / "_import" / "etl_output" / "duplicate_identities_needs_review.json"

def remove_diacritics(text):
    if not text:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', text)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).replace('ș', 's').replace('ț', 't').replace('Ş', 's').replace('Ţ', 't')

TITLES = [
    r'\bser\b', r'\blady\b', r'\blordul\b', r'\blord\b',
    r'\bregele\b', r'\bregina\b', r'\brege\b', r'\bking\b', r'\bqueen\b',
    r'\bprintul\b', r'\bprintesa\b', r'\bprint\b', r'\bprince\b', r'\bprincess\b',
    r'\bmaester\b', r'\bmarele maester\b', r'\bsepton\b', r'\bsepta\b',
    r'\bkhal\b', r'\bkhaleesi\b', r'\bsire\b', r'\bsir\b'
]

TITLE_REGEX = re.compile('|'.join(TITLES), re.IGNORECASE)

def clean_entity_string(s):
    """Clean title prefixes and normalize string for entity comparisons."""
    if not s:
        return ""
    s = str(s)
    if s.startswith("PERSON_"):
        s = s[7:]
    s = remove_diacritics(s).lower()
    s = re.sub(r'[\-_,()"\'.]', ' ', s)
    s = TITLE_REGEX.sub(' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def extract_first_name(clean_s):
    words = clean_s.split()
    if not words:
        return ""
    return words[0]

def get_rel_exact_set(char, key):
    vals = char.get(key) or []
    return set(v for v in vals if v)

def get_rel_clean_set(char, key):
    vals = char.get(key) or []
    res = set()
    for v in vals:
        cs = clean_entity_string(v)
        if cs:
            res.add(cs)
    return res

def run_detection():
    with open(CHARACTERS_PATH, encoding="utf-8") as f:
        chars = json.load(f)

    char_by_id = {c["id"]: c for c in chars}

    char_meta = []
    for c in chars:
        cid = c["id"]
        c_int = c.get("id_intern", "")
        name = c.get("name", "")
        
        clean_id = clean_entity_string(cid)
        clean_cint = clean_entity_string(c_int)
        clean_n = clean_entity_string(name)
        
        fn_id = extract_first_name(clean_id)
        fn_cint = extract_first_name(clean_cint)
        fn_n = extract_first_name(clean_n)
        
        first_names = set(filter(None, [fn_id, fn_cint, fn_n]))
        
        char_meta.append({
            "char": c,
            "id": cid,
            "id_intern": c_int,
            "name": name,
            "clean_id": clean_id,
            "first_names": first_names,
            "copii_exact": get_rel_exact_set(c, "copii"),
            "copii_clean": get_rel_clean_set(c, "copii"),
            "parinti_exact": get_rel_exact_set(c, "parinti"),
            "parinti_clean": get_rel_clean_set(c, "parinti"),
            "cas_exact": get_rel_exact_set(c, "casatorit_cu"),
            "cas_clean": get_rel_clean_set(c, "casatorit_cu")
        })

    # Index by first_name
    fn_index = defaultdict(list)
    for idx, meta in enumerate(char_meta):
        for fn in meta["first_names"]:
            fn_index[fn].append(idx)

    pairs = []
    seen_pairs = set()

    for fn, indices in fn_index.items():
        if len(indices) < 2:
            continue
        for i_idx in range(len(indices)):
            idx1 = indices[i_idx]
            m1 = char_meta[idx1]
            for j_idx in range(i_idx + 1, len(indices)):
                idx2 = indices[j_idx]
                if idx1 >= idx2:
                    continue
                pair_key = (idx1, idx2)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                
                m2 = char_meta[idx2]
                
                # Check relation overlaps
                copii_exact = m1["copii_exact"] & m2["copii_exact"]
                copii_clean = m1["copii_clean"] & m2["copii_clean"]
                
                parinti_exact = m1["parinti_exact"] & m2["parinti_exact"]
                parinti_clean = m1["parinti_clean"] & m2["parinti_clean"]
                
                cas_exact = m1["cas_exact"] & m2["cas_exact"]
                cas_clean = m1["cas_clean"] & m2["cas_clean"]
                
                has_copii = len(copii_exact) > 0 or len(copii_clean) > 0
                has_parinti = len(parinti_exact) > 0 or len(parinti_clean) > 0
                has_cas = len(cas_exact) > 0 or len(cas_clean) > 0
                
                signal_type = None
                confidence = 0.0
                
                # Overlap of children -> STRONG SIGNAL ON ITS OWN
                if has_copii:
                    if has_parinti and has_cas:
                        signal_type = "copii_parinti_casatorit_comuni"
                        confidence = 0.99
                    elif has_parinti or has_cas:
                        signal_type = "copii_plus_alta_relatie_comuna"
                        confidence = 0.95
                    else:
                        signal_type = "copii_comuni"
                        confidence = 0.92
                # OR simultaneous overlap of parinti + casatorit_cu
                elif has_parinti and has_cas:
                    signal_type = "parinti_si_casatorit_cu_comuni"
                    confidence = 0.88
                    
                if signal_type:
                    c_common = sorted(list(copii_exact | copii_clean))
                    p_common = sorted(list(parinti_exact | parinti_clean))
                    m_common = sorted(list(cas_exact | cas_clean))
                    
                    pairs.append({
                        "idx1": idx1,
                        "idx2": idx2,
                        "id1": m1["id"],
                        "id2": m2["id"],
                        "id_intern1": m1["id_intern"],
                        "id_intern2": m2["id_intern"],
                        "first_name": fn,
                        "signal_type": signal_type,
                        "confidence": confidence,
                        "evidence": {
                            "copii_comune": c_common,
                            "parinti_comuni": p_common,
                            "casatorit_cu_comuni": m_common
                        }
                    })

    # Cluster graph
    adj = defaultdict(set)
    pair_by_edge = {}
    for p in pairs:
        u, v = p["id1"], p["id2"]
        adj[u].add(v)
        adj[v].add(u)
        pair_by_edge[(min(u, v), max(u, v))] = p

    visited = set()
    clusters = []

    for cid in sorted(adj.keys()):
        if cid in visited:
            continue
        component = []
        queue = [cid]
        visited.add(cid)
        while queue:
            curr = queue.pop(0)
            component.append(curr)
            for nxt in adj[curr]:
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)
        clusters.append(sorted(component))

    # Format clusters for JSON output
    formatted_clusters = []
    for i, cl in enumerate(clusters, 1):
        id_intern_list = [char_by_id[cid].get("id_intern") for cid in cl]
        name_list = [char_by_id[cid].get("name") for cid in cl]
        
        cl_pairs = []
        all_copii = set()
        all_parinti = set()
        all_cas = set()
        max_conf = 0.0
        signal_types = set()
        
        for u_idx in range(len(cl)):
            for v_idx in range(u_idx + 1, len(cl)):
                u, v = cl[u_idx], cl[v_idx]
                key = (min(u, v), max(u, v))
                if key in pair_by_edge:
                    p = pair_by_edge[key]
                    cl_pairs.append(p)
                    signal_types.add(p["signal_type"])
                    max_conf = max(max_conf, p["confidence"])
                    all_copii.update(p["evidence"]["copii_comune"])
                    all_parinti.update(p["evidence"]["parinti_comuni"])
                    all_cas.update(p["evidence"]["casatorit_cu_comuni"])
                    
        rep_name = max(name_list, key=len) if name_list else cl[0]
        
        formatted_clusters.append({
            "cluster_id": f"cluster_{i:03d}",
            "nume_reprezentativ": rep_name,
            "id_uri": cl,
            "id_intern_uri": id_intern_list,
            "numar_variante": len(cl),
            "semnal": {
                "tip_semnal": sorted(list(signal_types)),
                "copii_comune": sorted(list(all_copii)),
                "parinti_comuni": sorted(list(all_parinti)),
                "casatorit_cu_comuni": sorted(list(all_cas))
            },
            "scor_incredere": max_conf
        })

    # Save output JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out_payload = {
        "metadate": {
            "total_personaje_analizate": len(chars),
            "total_perechi_duplicate_detectate": len(pairs),
            "total_clustere_duplicate_detectate": len(clusters)
        },
        "clustere_duplicate": formatted_clusters
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out_payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    return chars, pairs, clusters, formatted_clusters

def verify_contradictions(chars, clusters, formatted_clusters):
    with open(CONTRADICTIONS_PATH, encoding="utf-8") as f:
        contradiction_items = json.load(f).get("contradictii_familie", [])

    char_by_id = {c["id"]: c for c in chars}
    char_by_cint = {c["id_intern"]: c for c in chars if c.get("id_intern")}

    # Map any id or id_intern to its cluster of ids and id_interns
    id_to_all_variants = {}

    for item in formatted_clusters:
        ids = item["id_uri"]
        cints = item["id_intern_uri"]
        all_vars = set(ids + [c for c in cints if c])
        for v in all_vars:
            id_to_all_variants[v] = all_vars

    for c in chars:
        cid = c["id"]
        cint = c.get("id_intern")
        if cid not in id_to_all_variants:
            all_vars = {cid}
            if cint:
                all_vars.add(cint)
            id_to_all_variants[cid] = all_vars
            if cint:
                id_to_all_variants[cint] = all_vars

    results = []
    for idx, item in enumerate(contradiction_items, 1):
        sub = item["subiect"]
        obj = item["obiect"]
        sub_name = item["subiect_nume"]
        obj_name = item["obiect_nume"]
        
        sub_vars = id_to_all_variants.get(sub, {sub, sub.replace("PERSON_", "").lower()})
        obj_vars = id_to_all_variants.get(obj, {obj, obj.replace("PERSON_", "").lower()})
        
        sub_vars_expanded = set(sub_vars)
        for v in list(sub_vars):
            sub_vars_expanded.add(v.lower())
            sub_vars_expanded.add("PERSON_" + v.upper())
            
        obj_vars_expanded = set(obj_vars)
        for v in list(obj_vars):
            obj_vars_expanded.add(v.lower())
            obj_vars_expanded.add("PERSON_" + v.upper())

        found_links = []
        
        # Check subject variants -> object variants
        for sv in sub_vars:
            s_char = char_by_cint.get(sv) or char_by_id.get(sv)
            if not s_char:
                continue
            s_copii = s_char.get("copii") or []
            s_parinti = s_char.get("parinti") or []
            
            for ov in obj_vars_expanded:
                if ov in s_copii:
                    found_links.append(f"Subject variant '{s_char['id']}' has '{ov}' in copii")
                if ov in s_parinti:
                    found_links.append(f"Subject variant '{s_char['id']}' has '{ov}' in parinti")
                    
        # Check object variants -> subject variants
        for ov in obj_vars:
            o_char = char_by_cint.get(ov) or char_by_id.get(ov)
            if not o_char:
                continue
            o_copii = o_char.get("copii") or []
            o_parinti = o_char.get("parinti") or []
            
            for sv in sub_vars_expanded:
                if sv in o_copii:
                    found_links.append(f"Object variant '{o_char['id']}' has '{sv}' in copii")
                if sv in o_parinti:
                    found_links.append(f"Object variant '{o_char['id']}' has '{sv}' in parinti")

        reopened = len(found_links) > 0

        results.append({
            "index": idx,
            "subiect": sub,
            "subiect_nume": sub_name,
            "obiect": obj,
            "obiect_nume": obj_name,
            "redeschisa_mascat": reopened,
            "motiv_redeschidere": sorted(set(found_links))
        })
    return results

if __name__ == "__main__":
    chars, pairs, clusters, formatted_clusters = run_detection()
    contradictions_res = verify_contradictions(chars, clusters, formatted_clusters)

    print("==================================================")
    print("VERIFICARE CONTRADICTII REPARATĂ (CROSS-CLUSTER)")
    print("==================================================")
    for r in contradictions_res:
        status_str = "DA" if r["redeschisa_mascat"] else "NU"
        print(f"\nContradicția #{r['index']} ({r['subiect_nume']} -> {r['obiect_nume']}): Redeschisă mascat? {status_str}")
        if r["redeschisa_mascat"]:
            for m in r["motiv_redeschidere"]:
                print(f"   - {m}")
