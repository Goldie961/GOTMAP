#!/usr/bin/env python3
"""
Script de aplicare a split-ului pentru cele 86 de entități comasate din ASOIAF (§9.4).
Conform regulilor din prompt:
- Backup automat înainte de orice modificare
- Tratare 76 split, 6 false_positive, 4 uncertain
- Generare entitati_de_spart_needs_review.json și raport_split_entitati.md
- Actualizare id_map.json și characters.json
"""

import copy
import json
import re
import shutil
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

# Force UTF-8 stdout/stderr on Windows console
if sys.stdout and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CHARACTERS_PATH = DATA_DIR / "characters" / "characters.json"
IMPORT_DIR = DATA_DIR / "_import"
ETL_OUTPUT_DIR = IMPORT_DIR / "etl_output"
BACKUPS_DIR = ETL_OUTPUT_DIR / "backups"
ID_MAP_PATH = ETL_OUTPUT_DIR / "id_map.json"
ENTITATI_PATH = IMPORT_DIR / "entitati_de_spart.json"
NEEDS_REVIEW_PATH = ETL_OUTPUT_DIR / "entitati_de_spart_needs_review.json"
RAPORT_PATH = ETL_OUTPUT_DIR / "raport_split_entitati.md"

CLASSIFICATION = {
  "PERSON_AEGON_TARGARYEN_AEGON_STAPANUL_DRAGONILOR": {
    "action": "false_positive",
    "canonical": "Aegon Targaryen (Cuceritorul)",
    "alias": "Aegon, Stăpânul Dragonilor",
    "note": "Aceeași persoană (Aegon I) — a doua jumătate e o poreclă/titlu, nu altă persoană."
  },
  "PERSON_AGGO_RAKHARO": {
    "action": "split",
    "names": ["Aggo", "Rakharo"]
  },
  "PERSON_ALAYNE_ROYCE_SI_SAMANTHA_STOKEWORTH": {
    "action": "split",
    "names": ["Alayne Royce", "Samantha Stokeworth"]
  },
  "PERSON_ALLISER_THORNE_JANOS_SLYNT": {
    "action": "split",
    "names": ["Alliser Thorne", "Janos Slynt"]
  },
  "PERSON_ALTI_VERI_AI_LUI_VALARR_SI_MATARYS": {
    "action": "uncertain",
    "note": "\"Alți veri ai lui Valarr și Matarys (nenumiți)\" descrie o RUDĂ NENUMITĂ a doi oameni deja numiți (Valarr, Matarys) — nu sunt 2 persoane numite \"Alți veri\" și \"Matarys\". Nu se poate crea o intrare de persoană validă din asta fără decizie manuală despre cum se tratează."
  },
  "PERSON_ARON_SANTAGAR_JALABHAR_XHO_GEMENII_REDWYNE_LORDUL_GYLES_SER_DONTOS_SER_BALON_SWANN": {
    "action": "split",
    "names": [
      "Aron Santagar",
      "Jalabhar Xho",
      "Oroare Redwyne",
      "Bălosul Redwyne",
      "Lordul Gyles",
      "Ser Dontos",
      "Ser Balon Swann"
    ],
    "note": "\"gemenii Redwyne (Oroare și Bălosul)\" = 2 persoane (Horror & Slobber Redwyne), desfăcut separat."
  },
  "PERSON_ARYA_STARK_GENDRY": {
    "action": "split",
    "names": ["Arya Stark", "Gendry"],
    "note": "Ambele există deja ca personaje separate — se re-atașează sursele la entitățile existente, nu se creează duplicate."
  },
  "PERSON_BAELA_SI_RHAENA_TARGARYEN": {
    "action": "split",
    "names": ["Baela Targaryen", "Rhaena Targaryen"]
  },
  "PERSON_BANNEN_DYWEN": {
    "action": "split",
    "names": ["Bannen", "Dywen"],
    "note": "Dywen există deja ca personaj separat."
  },
  "PERSON_BATRANUL_FLINT_NORREY": {
    "action": "split",
    "names": ["Bătrânul Flint", "Norrey"]
  },
  "PERSON_BOWEN_MARSH_OTHELL_YARWYCK": {
    "action": "split",
    "names": ["Bowen Marsh", "Othell Yarwyck"]
  },
  "PERSON_BRANDON_STARK_MENTIONAT_CA_STRANGULANDU_SE_INCERCAND_SA_SI_SALVEZE_TATAL": {
    "action": "false_positive",
    "canonical": "Brandon Stark (unchiul lui Ned)",
    "alias": "mort înainte de acțiunea seriei, strangulat încercând să-și salveze tatăl",
    "note": "Un singur personaj descris pe o propoziție lungă; algoritmul a rupt greșit la virgule."
  },
  "PERSON_BRAN_STARK_RICKON_STARK": {
    "action": "split",
    "names": ["Bran Stark", "Rickon Stark"],
    "note": "Ambele există deja ca personaje separate."
  },
  "PERSON_BRAN_STARK_SI_RICKON_STARK": {
    "action": "split",
    "names": ["Bran Stark", "Rickon Stark"],
    "note": "Duplicat al #13, aceeași pereche."
  },
  "PERSON_BRUSCO_SI_FIICELE_SALE": {
    "action": "split",
    "names": ["Brusco", "Brea", "Talea"]
  },
  "PERSON_BUTTERBUMPS_SI_BAIATUL_LUNII": {
    "action": "split",
    "names": ["Butterbumps", "Băiatul Lunii"]
  },
  "PERSON_CALUL_RORY": {
    "action": "split",
    "names": ["Calul", "Rory"]
  },
  "PERSON_CALUL_SI_ROBIN_HOP": {
    "action": "split",
    "names": ["Calul", "Robin-Hop"],
    "note": "\"Calul\" apare și la #17 — se reutilizează aceeași entitate."
  },
  "PERSON_CIOCAN_SI_UNGHIE": {
    "action": "split",
    "names": ["Ciocan", "Unghie"]
  },
  "PERSON_CLEON_SI_CLEON_AL_DOILEA": {
    "action": "split",
    "names": ["Cleon", "Cleon al Doilea"],
    "note": "Regele Cleon I și uzurpatorul auto-proclamat Cleon al II-lea al Astapor-ului — persoane diferite."
  },
  "PERSON_DAEMION_SI_DAERON_VELARYON": {
    "action": "split",
    "names": ["Daemion Velaryon", "Daeron Velaryon"]
  },
  "PERSON_DAKE_SI_ROLDER": {
    "action": "split",
    "names": ["Dake", "Rolder"]
  },
  "PERSON_DALIA_SI_MATRICE": {
    "action": "split",
    "names": ["Dalia", "Matrice"]
  },
  "PERSON_DAMON_DANSEAZA_PENTRU_MINE_JUPUITORUL_ALYN_URSUZUL_DICK_GALBEJITUL_LUTON_MARAITUL_BAIETII_BASTARDULUI_AI_LUI_RAMSAY_BOLTON_DICK_GALBEJITUL_GASIT_MORT_SI_MUTILAT_PAGINA_815_823": {
    "action": "split",
    "names": [
      "Damon Dansează-pentru-Mine",
      "Jupuitorul",
      "Alyn Ursuzul",
      "Dick Gălbejitul",
      "Luton",
      "Mârâitul"
    ],
    "note": "„Băieții Bastardului\" ai lui Ramsay Bolton — 6 persoane distincte. Nota despre găsirea mort/mutilat (pag. 815–823) se atașează la Dick Gălbejitul."
  },
  "PERSON_DORCAS_SI_JOCELYN": {
    "action": "split",
    "names": ["Dorcas", "Jocelyn"]
  },
  "PERSON_DYWEN_HAKE": {
    "action": "split",
    "names": ["Dywen", "Hake"],
    "note": "Dywen există deja ca personaj separat."
  },
  "PERSON_ELADON_PAR_AURIU_SULITA_CREDINCIOASA": {
    "action": "uncertain",
    "note": "\"Eladon Păr Auriu, Suliţa Credincioasă\" — posibil nume+poreclă ale ACELEIAȘI persoane (ca la Aegon/Styr), posibil 2 persoane. Nu am suficientă certitudine din text."
  },
  "PERSON_ERRYK_SI_ARRYK": {
    "action": "split",
    "names": ["Erryk", "Arryk"],
    "note": "Gemenii Gărzii Regale, porecliți \"Stângul și Dreptul\"."
  },
  "PERSON_GALHART_GLOVER_SI_ROBERT_GLOVER": {
    "action": "split",
    "names": ["Galhart Glover", "Robert Glover"],
    "note": "Robert Glover există deja ca personaj separat."
  },
  "PERSON_GRENN_EDD_CEL_TRIST": {
    "action": "split",
    "names": ["Grenn", "Edd cel Trist"]
  },
  "PERSON_GRIGG_TAPUL_ERROK": {
    "action": "split",
    "names": ["Grigg Ţapul", "Errok"]
  },
  "PERSON_GRUP_DE_PERSOANE_DAGMER_FALCA_DESPICATA": {
    "action": "false_positive",
    "canonical": "Dagmer Falcă Despicată",
    "alias": "Dagmer Cleftjaw",
    "note": "O singură persoană — \"Falcă Despicată\" e porecla lui Dagmer, nu altă persoană."
  },
  "PERSON_GRUP_DE_PERSOANE_GARISS_MURCH": {
    "action": "split",
    "names": ["Gariss", "Murch"]
  },
  "PERSON_GRUP_DE_PERSOANE_IRRI_JHIQUI": {
    "action": "split",
    "names": ["Irri", "Jhiqui"],
    "note": "Ambele există deja ca personaje separate; duplicat cu #42."
  },
  "PERSON_GRUP_DE_PERSOANE_LADY_TANDA_LOLLYS_SI_FALYSE": {
    "action": "split",
    "names": [
      "Lady Tanda",
      "Lollys Stokeworth",
      "Falyse Stokeworth"
    ]
  },
  "PERSON_GRUP_DE_PERSOANE_MIKKEN_BENFRED": {
    "action": "split",
    "names": ["Mikken", "Benfred Tallhart"]
  },
  "PERSON_HALDER_BROSCOIUL": {
    "action": "split",
    "names": ["Halder", "Broscoiul (Todder)"]
  },
  "PERSON_HARLE_VANATORUL_HARLE_FRUMUSELUL": {
    "action": "split",
    "names": ["Harle Vânătorul", "Harle Frumușelul"],
    "note": "Doi mercenari distincți, ambii porecliți \"Harle\" — nu aceeași persoană."
  },
  "PERSON_HEWARD_SI_WYL": {
    "action": "split",
    "names": ["Heward", "Wyl"],
    "note": "Duplicat cu #85 (ordine inversă)."
  },
  "PERSON_HOLLY_ROWAN": {
    "action": "split",
    "names": ["Holly", "Rowan"]
  },
  "PERSON_HORAS_REDWYNE_HOBBER_REDWYNE": {
    "action": "split",
    "names": ["Horas Redwyne", "Hobber Redwyne"]
  },
  "PERSON_IRRI_JHIQUI": {
    "action": "split",
    "names": ["Irri", "Jhiqui"],
    "note": "Duplicat cu #34."
  },
  "PERSON_JENNIS_DIN_CASA_TEMPLETON_ROSAMUND_DIN_CASA_BALL": {
    "action": "split",
    "names": [
      "Jennis din Casa Templeton",
      "Rosamund din Casa Ball"
    ]
  },
  "PERSON_JYCK_SI_MORREC": {
    "action": "split",
    "names": ["Jyck", "Morrec"]
  },
  "PERSON_KHRAZZ_SI_PIELE_DE_OTEL": {
    "action": "split",
    "names": ["Khrazz", "Piele-de-Oţel"]
  },
  "PERSON_LEATHERS_SI_JAX": {
    "action": "split",
    "names": ["Leathers", "Jax"]
  },
  "PERSON_LEW_MANA_STANGA_ALF_RUNNYMUDD": {
    "action": "split",
    "names": ["Lew Mână-Stângă", "Alf Runnymudd"]
  },
  "PERSON_LHARYS_SI_MOHOR": {
    "action": "split",
    "names": ["Lharys", "Mohor"]
  },
  "PERSON_LIDDLE_CEL_MARE_SI_LUKE_DIN_ORASUL_LUNG": {
    "action": "split",
    "names": ["Liddle cel Mare", "Luke din Orașul Lung"]
  },
  "PERSON_LORDUL_BRYNDEMERE_EVENSTARUL": {
    "action": "uncertain",
    "note": "\"lordul Bryndemere, Evenstarul\" — neclar dacă \"Evenstarul\" (titlul casei Estermont) se referă la Bryndemere însuși sau la o a doua persoană. Necesită verificare în text."
  },
  "PERSON_LORDUL_SI_LADY_SMALLWOOD": {
    "action": "split",
    "names": ["Lordul Smallwood", "Lady Smallwood"]
  },
  "PERSON_LORDUL_WILLUM_SI_FIII_SAI_JOSIA_SI_ELYAS": {
    "action": "split",
    "names": ["Lordul Willum", "Josia", "Elyas"],
    "note": "Tată + 2 fii."
  },
  "PERSON_LYN_CORBRAY_SI_LORDUL_LYONEL_CORBRAY": {
    "action": "split",
    "names": ["Lyn Corbray", "Lordul Lyonel Corbray"],
    "note": "Frați."
  },
  "PERSON_LYRA_EDYTH": {
    "action": "split",
    "names": ["Lyra", "Edyth"]
  },
  "PERSON_MAESTER_BALLABAR_MAESTER_FRENKEN": {
    "action": "split",
    "names": ["Maester Ballabar", "Maester Frenken"]
  },
  "PERSON_MAESTER_TURQUIN_MAESTER_ERRECK": {
    "action": "split",
    "names": ["Maester Turquin", "Maester Erreck"]
  },
  "PERSON_MARQ_PIPER_PATREK_MALLISTER": {
    "action": "split",
    "names": ["Marq Piper", "Patrek Mallister"]
  },
  "PERSON_MEDRICK_MANDERLY_SI_TORRHEN_MANDERLY": {
    "action": "split",
    "names": ["Medrick Manderly", "Torrhen Manderly"],
    "note": "Gemenii-nepoți ai lordului Manderly."
  },
  "PERSON_MORRA_SI_MELLEI": {
    "action": "split",
    "names": ["Morra", "Mellei"]
  },
  "PERSON_MREANA_TERCI": {
    "action": "split",
    "names": ["Mreană", "Terci"],
    "note": "Doi temniceri, porecle distincte."
  },
  "PERSON_MULLY_SI_KEGS": {
    "action": "split",
    "names": ["Mully", "Kegs"]
  },
  "PERSON_OSNEY_SI_OSFRYD_KETTLEBLACK": {
    "action": "split",
    "names": ["Osney Kettleblack", "Osfryd Kettleblack"]
  },
  "PERSON_PRENTYS_TULLY_SI_LADY_LUCINDA": {
    "action": "split",
    "names": ["Prentys Tully", "Lady Lucinda"]
  },
  "PERSON_PUMN_NEGRU_CETHERYS": {
    "action": "split",
    "names": ["Pumn Negru", "Cetherys"]
  },
  "PERSON_QEZZA_SI_GRAZHAR": {
    "action": "split",
    "names": ["Qezza", "Grazhar"]
  },
  "PERSON_QUENTYN_MARTELL_TRYSTANE_MARTELL": {
    "action": "split",
    "names": ["Quentyn Martell", "Trystane Martell"],
    "note": "Ambele există deja ca personaje separate."
  },
  "PERSON_ROBERT_GLOVER_SI_LADY_GLOVER": {
    "action": "split",
    "names": ["Robert Glover", "Lady Glover"],
    "note": "Robert Glover există deja; duplicat parțial cu #29."
  },
  "PERSON_RORGE_SI_MUSCATORUL": {
    "action": "split",
    "names": ["Rorge", "Mușcătorul"]
  },
  "PERSON_RORY_SI_PATE": {
    "action": "split",
    "names": ["Rory", "Pate"]
  },
  "PERSON_SER_JOFFREY_DOGGETT_SI_SER_LORENCE_ROXTON": {
    "action": "split",
    "names": ["Ser Joffrey Doggett", "Ser Lorence Roxton"]
  },
  "PERSON_SER_OLYVER_BRACKEN_SI_SER_RAYMUND_MALLERY": {
    "action": "split",
    "names": ["Ser Olyver Bracken", "Ser Raymund Mallery"]
  },
  "PERSON_SHAGGA_SI_TIMETT": {
    "action": "split",
    "names": ["Shagga", "Timett"]
  },
  "PERSON_STYR_MAGNARUL_DIN_THENN": {
    "action": "false_positive",
    "canonical": "Styr",
    "alias": "Magnarul din Thenn",
    "note": "O singură persoană (Styr, Magnarul Thennilor) — vezi și #74, #75, dubluri de nume/titlu ale aceleiași persoane. Personajul \"styr\" există deja separat."
  },
  "PERSON_STYR_MAGNARUL_THENNILOR": {
    "action": "false_positive",
    "canonical": "Styr",
    "alias": "Magnarul Thennilor",
    "note": "Duplicat al #73 — aceeași persoană, altă formulare a titlului."
  },
  "PERSON_STYR_MAGNAR_AL_THENNEI": {
    "action": "false_positive",
    "canonical": "Styr",
    "alias": "Magnar al Thennei",
    "note": "Duplicat al #73 — aceeași persoană, altă formulare a titlului."
  },
  "PERSON_TAGGANARO_SI_CASSO": {
    "action": "split",
    "names": ["Tagganaro", "Casso (Regele Focilor)"]
  },
  "PERSON_TATAL_LUI_PENNY_SI_OPPO": {
    "action": "uncertain",
    "note": "\"Tatăl lui Penny și Oppo\" — neclar dacă Oppo E tatăl lui Penny (nume de scenă) sau altă rudă (frate). Necesită verificare în text (ADWD)."
  },
  "PERSON_TORREK_JAGGOT": {
    "action": "split",
    "names": ["Torrek", "Jaggot"]
  },
  "PERSON_TORR_KARSTARK_EDD_KARSTARK": {
    "action": "split",
    "names": ["Torr Karstark", "Edd Karstark"]
  },
  "PERSON_TY_SI_DANNEL": {
    "action": "split",
    "names": ["Ty", "Dannel"]
  },
  "PERSON_WALDER_CEL_MIC_WALDER_CEL_MARE": {
    "action": "split",
    "names": ["Walder cel Mic", "Walder cel Mare"],
    "note": "Little Walder Frey și Big Walder Frey — persoane diferite, nu porecle ale aceleiași."
  },
  "PERSON_WALDER_SI_WALDER": {
    "action": "split",
    "names": ["Walder cel Mic", "Walder cel Mare"],
    "note": "Duplicat cu #81, aceeași pereche."
  },
  "PERSON_WALTON_AMABEL": {
    "action": "split",
    "names": ["Walton", "Amabel"]
  },
  "PERSON_WEESE_CHISWYCK": {
    "action": "split",
    "names": ["Weese", "Chiswyck"]
  },
  "PERSON_WYL_HEWARD": {
    "action": "split",
    "names": ["Heward", "Wyl"],
    "note": "Duplicat cu #39 (ordine inversă)."
  },
  "PERSON_YANDRY_SI_YSILLA": {
    "action": "split",
    "names": ["Yandry", "Ysilla"]
  }
}

def norm(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\(.*?\)", "", text)
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip().lower()

def make_slug(name: str, existing_ids: set[str]) -> str:
    text = re.sub(r"\(.*?\)", "", name)
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in nfkd if not unicodedata.combining(c))
    trans = str.maketrans({
        "ă": "a", "ș": "s", "ț": "t", "î": "i", "â": "a",
        "Ă": "a", "Ș": "s", "Ț": "t", "Î": "i", "Â": "a",
        "Ţ": "t", "Ş": "s"
    })
    ascii_text = ascii_text.translate(trans)
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", ascii_text).strip("_").lower()
    if not slug:
        slug = "character"
    candidate = slug
    counter = 2
    while candidate in existing_ids:
        candidate = f"{slug}_{counter}"
        counter += 1
    existing_ids.add(candidate)
    return candidate

def main():
    print("=== PAS 1: BACKUP ===")
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_chars_path = BACKUPS_DIR / f"characters_{ts}.json"
    backup_idmap_path = BACKUPS_DIR / f"id_map_{ts}.json"

    shutil.copy2(CHARACTERS_PATH, backup_chars_path)
    shutil.copy2(ID_MAP_PATH, backup_idmap_path)
    print(f"Backup characters: {backup_chars_path.name}")
    print(f"Backup id_map:     {backup_idmap_path.name}")

    print("\n=== PAS 2: INCARCARE DATE ===")
    with CHARACTERS_PATH.open(encoding="utf-8") as f:
        chars = json.load(f)
    with ID_MAP_PATH.open(encoding="utf-8") as f:
        id_map = json.load(f)
    with ENTITATI_PATH.open(encoding="utf-8") as f:
        ent_list = json.load(f)

    initial_count = len(chars)
    print(f"Numar initial personaje in characters.json: {initial_count}")

    # Indexare entități
    chars_by_id = {c["id"]: c for c in chars}
    existing_ids = set(chars_by_id.keys())

    # Identificare entități de șters (cele cu split)
    app_ids_to_delete = set()
    for item in ent_list:
        id_orig = item["id_original"]
        c_info = CLASSIFICATION[id_orig]
        if c_info["action"] == "split":
            app_id = id_map[id_orig]["app_id"]
            app_ids_to_delete.add(app_id)

    # Personaje active care nu sunt șterse
    active_chars = [c for c in chars if c["id"] not in app_ids_to_delete]

    # Harta numelui normalizat la personaj activ
    name_to_char = {}
    for c in active_chars:
        n_name = norm(c["name"])
        if n_name and n_name not in name_to_char:
            name_to_char[n_name] = c

    # Raportare internă
    needs_review = []
    raport_linii = []
    raport_linii.append("# Raport Execuție Split Entități Comasate (§9.4)\n")
    raport_linii.append(f"**Data execuției:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    raport_linii.append(f"- **Total personaje inițiale:** {initial_count}")
    raport_linii.append(f"- **Entități comasate șterse (split):** {len(app_ids_to_delete)}")

    total_split_processed = 0
    total_fp_processed = 0
    total_uncertain_processed = 0
    created_chars = []
    enriched_char_ids = set()

    print("\n=== PAS 3: PROCESARE CELE 86 DE ENTITATI ===")

    for idx, item in enumerate(ent_list, 1):
        id_orig = item["id_original"]
        c_info = CLASSIFICATION[id_orig]
        action = c_info["action"]
        app_id = id_map[id_orig]["app_id"]

        if action == "uncertain":
            total_uncertain_processed += 1
            note = c_info.get("note", "")
            needs_review.append({
                "index": idx,
                "id_original": id_orig,
                "app_id": app_id,
                "nume_canonic": item.get("nume_canonic", chars_by_id[app_id]["name"]),
                "motiv": note
            })
            # Actualizare id_map
            id_map[id_orig]["status"] = "uncertain"
            id_map[id_orig]["review_reason"] = note

            raport_linii.append(f"### #{idx}. {id_orig} (`uncertain`)\n- **App ID:** `{app_id}`\n- **Motiv:** {note}\n- **Acțiune:** Păstrat nemodificat, adăugat în review.\n")

        elif action == "false_positive":
            total_fp_processed += 1
            canonical = c_info["canonical"]
            alias = c_info["alias"]
            note = c_info.get("note", "")

            char = chars_by_id[app_id]
            char["name"] = canonical
            if "aliasuri" not in char or char["aliasuri"] is None:
                char["aliasuri"] = []
            if alias not in char["aliasuri"]:
                char["aliasuri"].append(alias)

            id_map[id_orig]["status"] = "false_positive"
            id_map[id_orig]["canonical_name"] = canonical
            id_map[id_orig]["added_alias"] = alias

            raport_linii.append(f"### #{idx}. {id_orig} (`false_positive`)\n- **App ID:** `{app_id}`\n- **Nume canonic setat:** `{canonical}`\n- **Alias adăugat:** `{alias}`\n- **Note:** {note}\n")

        elif action == "split":
            total_split_processed += 1
            names = c_info["names"]
            merged_char = chars_by_id[app_id]
            merged_sources = merged_char.get("surse") or []

            created_ids_for_this_split = []
            enriched_ids_for_this_split = []

            for name in names:
                n_target = norm(name)

                # Notă specială Dick Gălbejitul
                desc_to_add = None
                if id_orig.startswith("PERSON_DAMON_DANSEAZA") and norm(name) == norm("Dick Gălbejitul"):
                    desc_to_add = "găsit mort și mutilat (pagina 815–823)"

                if n_target in name_to_char:
                    # Personaj existent! Adăugare surse și note
                    target_char = name_to_char[n_target]
                    t_id = target_char["id"]
                    enriched_char_ids.add(t_id)
                    enriched_ids_for_this_split.append(t_id)

                    curr_sources = target_char.get("surse") or []
                    for s in merged_sources:
                        if s not in curr_sources:
                            curr_sources.append(s)
                    target_char["surse"] = curr_sources

                    prov_note = f"Surse din entitatea comasată {id_orig} ({app_id})"
                    if "_note_provenienta_split" not in target_char:
                        target_char["_note_provenienta_split"] = []
                    if prov_note not in target_char["_note_provenienta_split"]:
                        target_char["_note_provenienta_split"].append(prov_note)

                    if desc_to_add:
                        if not target_char.get("description"):
                            target_char["description"] = desc_to_add
                        elif desc_to_add not in target_char["description"]:
                            target_char["description"] += f"; {desc_to_add}"

                else:
                    # Personaj nou!
                    new_id = make_slug(name, existing_ids)
                    new_c = {
                        "id": new_id,
                        "name": name,
                        "titles": [],
                        "house": None,
                        "born": None,
                        "died": None,
                        "canon": "canon",
                        "description": desc_to_add if desc_to_add else "",
                        "timeline": [],
                        "locatie_asociata": None,
                        "titlu_curent": None,
                        "membru_al": None,
                        "parinti": [],
                        "copii": [],
                        "frati": [],
                        "casatorit_cu": [],
                        "moarte": None,
                        "possible_parent_of": [],
                        "age_at": [],
                        "member_of": [],
                        "_afirmatii_pe_predicat": {},
                        "surse": list(merged_sources),
                        "_completitudine": None,
                        "id_intern": None,
                        "aliasuri": [],
                        "_split_din": id_orig
                    }
                    created_chars.append(new_c)
                    active_chars.append(new_c)
                    name_to_char[n_target] = new_c
                    created_ids_for_this_split.append(new_id)

            id_map[id_orig]["status"] = "split_into_multiple"
            id_map[id_orig]["split_names"] = names
            id_map[id_orig]["created_ids"] = created_ids_for_this_split
            id_map[id_orig]["enriched_ids"] = enriched_ids_for_this_split

            raport_linii.append(
                f"### #{idx}. {id_orig} (`split`)\n"
                f"- **App ID comasat șters:** `{app_id}`\n"
                f"- **Nume sparte:** {names}\n"
                f"- **ID-uri create noi:** `{created_ids_for_this_split}`\n"
                f"- **ID-uri existente re-utilizate/îmbogățite:** `{enriched_ids_for_this_split}`\n"
            )

    final_count = len(active_chars)

    raport_header_summary = (
        f"- **Personaje noi create:** {len(created_chars)}\n"
        f"- **Personaje existente îmbogățite cu surse noi:** {len(enriched_char_ids)}\n"
        f"- **False positive ajustate:** {total_fp_processed}\n"
        f"- **Uncertain trimise la review:** {total_uncertain_processed}\n"
        f"- **Total personaje final în characters.json:** {final_count} (Calcul: {initial_count} - {len(app_ids_to_delete)} + {len(created_chars)} = {final_count})\n\n"
        "---\n\n"
    )
    raport_linii.insert(5, raport_header_summary)

    print("\n=== PAS 4: SALVARE FISIERE ===")

    # Salvare characters.json
    with CHARACTERS_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(active_chars, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Salvat characters.json: {len(active_chars)} personaje")

    # Salvare id_map.json
    with ID_MAP_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(id_map, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Salvat id_map.json cu statusuri actualizate")

    # Salvare entitati_de_spart_needs_review.json
    with NEEDS_REVIEW_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(needs_review, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Salvat entitati_de_spart_needs_review.json: {len(needs_review)} intrari")

    # Salvare raport_split_entitati.md
    with RAPORT_PATH.open("w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(raport_linii))
    print("Salvat raport_split_entitati.md")

    print("\n=== PAS 5: VERIFICARI AUTOMATE AUDIT ===")

    # 1. Valid JSON & Reload
    with CHARACTERS_PATH.open(encoding="utf-8") as f:
        reloaded_chars = json.load(f)
    assert len(reloaded_chars) == final_count, "Numar diferit la re-incarcare!"

    # 2. Check no duplicate IDs
    ids_seen = set()
    duplicates = []
    for c in reloaded_chars:
        cid = c["id"]
        if cid in ids_seen:
            duplicates.append(cid)
        ids_seen.add(cid)
    assert not duplicates, f"ID-uri duplicate gasite! {duplicates}"
    print("[OK] Nu exista ID-uri duplicate in characters.json")

    # 3. Check math
    assert initial_count - len(app_ids_to_delete) + len(created_chars) == final_count, "Matematica totala nu coincide!"
    print(f"[OK] Matematica personajelor este exacta ({initial_count} - {len(app_ids_to_delete)} + {len(created_chars)} = {final_count})")

    # 4. Check false positives
    for id_orig, info in CLASSIFICATION.items():
        if info["action"] == "false_positive":
            app_id = id_map[id_orig]["app_id"]
            char = chars_by_id[app_id]
            assert char["name"] == info["canonical"], f"Name neactualizat pentru {app_id}"
            assert info["alias"] in char["aliasuri"], f"Alias neadaugat pentru {app_id}"
    print("[OK] Cele 6 false_positive au fost actualizate corect")

    # 5. Check uncertain
    assert len(needs_review) == 4, f"Asteptate 4 uncertain, gasite {len(needs_review)}"
    print("[OK] Cele 4 entitati uncertain sunt in entitati_de_spart_needs_review.json")

    # 6. Check sample cases
    # Aggo vs Rakharo
    aggo_char = next((c for c in reloaded_chars if c["name"] == "Aggo"), None)
    rakharo_char = next((c for c in reloaded_chars if c["name"] == "Rakharo"), None)
    assert aggo_char is not None and rakharo_char is not None, "Aggo sau Rakharo lipsesc!"
    assert aggo_char["id"] != rakharo_char["id"], "Aggo si Rakharo au acelasi ID!"

    # Bran Stark (nu s-a creat duplicat)
    bran_chars = [c for c in reloaded_chars if norm(c["name"]) == norm("Bran Stark")]
    assert len(bran_chars) == 1, f"Duplicate gasite pentru Bran Stark: {len(bran_chars)}"

    # Dick Gălbejitul
    dick_char = next((c for c in reloaded_chars if norm(c["name"]) == norm("Dick Gălbejitul")), None)
    assert dick_char is not None and "găsit mort și mutilat" in dick_char.get("description", ""), "Descrierea speciala a lui Dick Galbejitul lipseste!"
    print("[OK] Verificarile punctuale de esantion au trecut cu succes!")

    print("\nPROCESUL S-A FINALIZAT CU SUCCES COMPLET!")

if __name__ == "__main__":
    main()
