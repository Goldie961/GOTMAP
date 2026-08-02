#!/usr/bin/env python3
"""Check current state of Jon Arryn, Catelyn Stark, Eddard Stark titles in characters.json."""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

with open(r"c:\Users\andre\OneDrive\Desktop\GOT MAP\data\characters\characters.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total characters: {len(data)}")
print(f"Type of data: {type(data)}")

# Check if it's a dict or list
if isinstance(data, list):
    print("Data is a LIST of characters")
    # Show first character's keys
    if data:
        print(f"First character keys: {list(data[0].keys())[:15]}")
    targets = {
        "Jon Arryn": None,
        "Catelyn Stark": None,
        "Eddard Stark": None,
    }
    for c in data:
        name = c.get("name", c.get("nume_canonic", ""))
        for t in targets:
            if t in name:
                targets[t] = c
    for name, c in targets.items():
        if c:
            print(f"\n{'='*60}")
            print(f"CHARACTER: {name}")
            print(f"  id: {c.get('id')}")
            print(f"  name: {c.get('name', c.get('nume_canonic'))}")
            print(f"  titlu_curent: {c.get('titlu_curent')}")
            titles = c.get("titles", [])
            print(f"  titles count: {len(titles)}")
            for i, t in enumerate(titles):
                if isinstance(t, dict):
                    print(f"    [{i}] {t.get('titlu', t)}")
                else:
                    print(f"    [{i}] {t}")
        else:
            print(f"\n{name}: NOT FOUND")
elif isinstance(data, dict):
    print("Data is a DICT")
    print(f"Top-level keys (first 10): {list(data.keys())[:10]}")
    # Check for specific IDs
    for key in ["PERSON_JON_ARRYN", "Jon Arryn"]:
        if key in data:
            c = data[key]
            print(f"\nFound key={key}")
            print(f"  titlu_curent: {c.get('titlu_curent')}")
            titles = c.get("titles", [])
            print(f"  titles count: {len(titles)}")
            for i, t in enumerate(titles):
                if isinstance(t, dict):
                    print(f"    [{i}] {t.get('titlu', t)}")
                else:
                    print(f"    [{i}] {t}")
