import json, sys

needecise = [
    {
        "duplicate_candidate_id": "insula_ursului",
        "original_target_id": "bear_island",
        "duplicate_name": "Insula Ursului",
        "original_name": "Mormont Keep (Bear Island)",
        "uncertainty_reason": "Insula Ursului este traducerea în română pentru Bear Island. Intrarea originală bear_island are status: enrichment dar nu are coordonate și nici evenimente. Intrarea nouă are 7 evenimente, 3 descrieri fizice și coordonate pe hartă. Posibil duplicat complet de unificat sau sub-locație insulară."
    },
    {
        "duplicate_candidate_id": "gatul",
        "original_target_id": "the_neck",
        "duplicate_name": "Gâtul",
        "original_name": "The Neck",
        "uncertainty_reason": "Gâtul este traducerea românească a regiunii The Neck. Intrarea originală the_neck are 0 evenimente și 0 descrieri, fără coordonate. Intrarea nouă gatul are 2 evenimente, 7 descrieri fizice și coordonate pe hartă."
    },
    {
        "duplicate_candidate_id": "dintele_aurit",
        "original_target_id": "golden_tooth",
        "duplicate_name": "Dintele Aurit (Golden Tooth)",
        "original_name": "Golden Tooth",
        "uncertainty_reason": "Intrarea originală golden_tooth are deja 7 evenimente și id_intern LOCATION_DINTELE_DE_AUR. Intrarea nouă dintele_aurit are 2 evenimente și coordonate. Poate fi o trecătoare/sub-locație specifică sau un duplicat."
    },
    {
        "duplicate_candidate_id": "castelul_ashford",
        "original_target_id": "ashford_castle",
        "duplicate_name": "Castelul Ashford",
        "original_name": "Ashford Castle",
        "uncertainty_reason": "Ashford Castle există în setul original cu coordonate dar fără evenimente. Intrarea castelul_ashford are 1 eveniment și 1 descriere fizică."
    },
    {
        "duplicate_candidate_id": "ashford",
        "original_target_id": "ashford_castle",
        "duplicate_name": "Ashford",
        "original_name": "Ashford Castle",
        "uncertainty_reason": "Referință la orașul/târgul Ashford de lângă castel. Conține 2 evenimente narative."
    },
    {
        "duplicate_candidate_id": "pajistea_ashford",
        "original_target_id": "ashford_castle",
        "duplicate_name": "Pajiștea Ashford",
        "original_name": "Ashford Castle",
        "uncertainty_reason": "Câmpul de turnir/bătălie de lângă Ashford Castle. Conține 3 evenimente și 1 descriere fizică."
    },
    {
        "duplicate_candidate_id": "castelul_eyrie",
        "original_target_id": "the_eyrie",
        "duplicate_name": "Castelul Eyrie",
        "original_name": "The Eyrie",
        "uncertainty_reason": "The Eyrie are deja 19 evenimente și 20 descrieri. castelul_eyrie are 1 eveniment specific."
    },
    {
        "duplicate_candidate_id": "cetatea_rosie_fortareata_rosie",
        "original_target_id": "kings_landing",
        "duplicate_name": "Cetatea Roşie / Fortăreaţa Roşie",
        "original_name": "King's Landing (Aegonfort)",
        "uncertainty_reason": "Denumire dublă pentru Fortăreața Roșie din King's Landing. Conține 1 eveniment și 3 descrieri fizice."
    },
    {
        "duplicate_candidate_id": "fortareata_rosie_debarcaderul_regelui",
        "original_target_id": "kings_landing",
        "duplicate_name": "Fortăreața Roșie / Debarcaderul Regelui",
        "original_name": "King's Landing (Aegonfort)",
        "uncertainty_reason": "Referință combinată explicită în textul cărților. Conține 1 eveniment."
    },
    {
        "duplicate_candidate_id": "fortareata_rosie_implicit_locul_scenei_cu_kevan_lannister_varys",
        "original_target_id": "kings_landing",
        "duplicate_name": "Fortăreața Roșie (Red Keep) — implicit, locul scenei cu Kevan Lannister/Varys",
        "original_name": "King's Landing (Aegonfort)",
        "uncertainty_reason": "Cameră/locatare contextuală extrasă pentru o scenă narativă specifică."
    },
    {
        "duplicate_candidate_id": "fortareata_rosie_fortareata_lui_maegor",
        "original_target_id": "kings_landing",
        "duplicate_name": "Fortăreața Roșie / Fortăreața lui Maegor",
        "original_name": "King's Landing (Aegonfort)",
        "uncertainty_reason": "Maegor's Holdfast este o structură fortificată distinctă din interiorul Fortăreței Roșii. Conține 1 eveniment."
    },
    {
        "duplicate_candidate_id": "fortareata_rosie_turnul_mainii",
        "original_target_id": "kings_landing",
        "duplicate_name": "Fortăreața Roșie / Turnul Mâinii",
        "original_name": "King's Landing (Aegonfort)",
        "uncertainty_reason": "Turnul Mâinii este o turn specific din Fortăreața Roșie. Conține 1 eveniment."
    }
]

with open('data/_import/etl_output/duplicate_locations_needecise.json', 'w', encoding='utf-8') as f:
    json.dump(needecise, f, indent=2, ensure_ascii=False)

print(f'Wrote {len(needecise)} needecise entries to duplicate_locations_needecise.json')
