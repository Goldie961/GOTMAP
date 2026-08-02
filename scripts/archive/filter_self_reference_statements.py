#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/filter_self_reference_statements.py

Filters out self-referential statements (where subject == object) from statements_persoane_part1-3.json.
Writes eliminated self-referential statements to data/_import/statements_self_reference_eliminate.json.
"""

import json
import glob
import os
import sys

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    import_dir = os.path.join(root_dir, "data", "_import")

    statement_files = sorted(glob.glob(os.path.join(import_dir, "statements_persoane_part*.json")))
    
    total_scanned = 0
    total_eliminated = 0
    eliminated_statements = []

    for file_path in statement_files:
        filename = os.path.basename(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            statements = json.load(f)
        
        total_scanned += len(statements)
        kept_statements = []
        
        for stmt in statements:
            subj = stmt.get("subject")
            obj = stmt.get("object")
            
            if subj and obj and subj == obj:
                total_eliminated += 1
                stmt_copy = dict(stmt)
                stmt_copy["_sursa_fisier"] = filename
                eliminated_statements.append(stmt_copy)
            else:
                kept_statements.append(stmt)

        # Overwrite file with clean statements
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(kept_statements, f, indent=2, ensure_ascii=False)
            
        print(f"File {filename}: {len(statements)} total, {len(kept_statements)} kept, {len(statements) - len(kept_statements)} self-reference eliminated.")

    # Write eliminated statements file
    output_path = os.path.join(import_dir, "statements_self_reference_eliminate.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(eliminated_statements, f, indent=2, ensure_ascii=False)

    print("\n=================== SELF REFERENCE FILTER SUMMARY ===================")
    print(f"Total statements scanned: {total_scanned}")
    print(f"Total self-reference statements eliminated: {total_eliminated}")
    print(f"Saved eliminated self-reference statements to: {output_path}")

    print("\nEliminated Statements Details:")
    for idx, s in enumerate(eliminated_statements, 1):
        subj = s.get("subject")
        pred = s.get("predicate")
        obj_val = s.get("object")
        book = s.get("source_book")
        page = s.get("source_page")
        src_file = s.get("_sursa_fisier")
        print(f"  {idx}. [{src_file}] {subj} --({pred})--> {obj_val} | Book: '{book}', Page: '{page}'")

if __name__ == "__main__":
    main()
