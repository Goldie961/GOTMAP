"""Apply only AWOIAF-supported Part 3 house facts (no inferred dates)."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOUSES = ROOT / "data/houses/houses.json"
SOURCE = "https://awoiaf.westeros.org/index.php/"

SIGILS_AND_WORDS = {
    "cerwyn": ("A black battle-axe on silver.", "Honed and Ready"),
    "locke": ("Bronze crossed keys on a white pale on purple.", None),
    "clegane": ("Three black dogs running on yellow.", None),
    "marbrand": ("A burning tree, orange on smoke.", "Burning Bright"),
    "sarsfield": ("A green arrow on a white bend on green.", "True to the Mark"),
    "serrett": ("A peacock in his pride on cream.", "I Have No Rival"),
    "swyft": ("A blue bantam rooster on yellow.", "Awake! Awake!"),
    "farman": ("Three silver ships on blue, a border of crimson and gold.", "The Wind Our Steed"),
    "westerling": ("Six white seashells on sand.", "Honor, not Honors"),
    "fowler": ("A hooded blue hawk on silver.", "Let Me Soar"),
    "uller": ("Rayonne yellow over crimson.", None),
    "santagar": ("Per bend sinister blue and white, a spotted leopard with a golden axe.", None),
    "toland": ("A green dragon biting its tail on gold.", None),
    "vaith": ("Three black leopards standing on a yellow pile on orange.", None),
    "jordayne": ("A golden quill on checkered dark and light green.", "Let It Be Written"),
    "manwoody": ("A white skull crowned with gold on black.", None),
    "gargalen": ("A red cockatrice with a black snake in its beak on gold.", None),
    "mertyns": ("A white great horned owl on grey.", None),
    "cafferen": ("Two white fawns counter-salient on green.", None),
    "caron": ("A field of black nightingales on yellow.", "No Song So Sweet"),
    "errol": ("A yellow haystack on orange.", None),
    "estermont": ("A dark green sea turtle on pale green.", None),
    "trant": ("A hanged man, black on blue.", "So End Our Foes"),
    "massey": ("A triple spiral—red, green, and blue—on white.", None),
    "staunton": ("Two black wings upon a white fess on checkered black and grey.", None),
    "stokeworth": ("A white lamb holding a golden goblet on green.", "Proud to Be Faithful"),
    "hayford": ("Green fretty over gold, a green pale wavy.", None),
    "harlaw": ("A silver scythe on black.", None),
    "botley": ("A shoal of silver fish on pale green.", None),
    "drumm": ("A bone hand, white on red.", None),
    "volmark": ("A black leviathan on a grey sea.", None),
    "oakheart": ("Three green oak leaves on gold.", "Our Roots Go Deep"),
    "meadows": ("A border of flowers of many colours and varieties on green.", None),
    "merryweather": ("A golden horn of plenty spilling fruits and vegetables on a white field bordered in gold.", "Behold Our Bounty"),
    "osgrey": ("A lion, checkered green and gold, on white.", None),
    "peake": ("Three black castles on orange.", None),
    "bulwer": ("A bull's skull, bone on blood.", "Death Before Disgrace"),
    "costayne": ("Quartered: a silver chalice on black, a black rose on yellow.", None),
}

TIMELINES = {
    "cerwyn": [
        {"year": None, "lord": "Lord Cerwyn", "title": "Lord of Cerwyn", "event": "Supported the blacks during the Dance of the Dragons and attended the Hour of the Wolf.", "canon": "canon", "source": SOURCE + "House_Cerwyn"},
        {"year": 299, "lord": "Medger Cerwyn", "title": "Lord of Cerwyn", "event": "Died of wounds suffered at the battle on the Green Fork.", "canon": "canon", "source": SOURCE + "House_Cerwyn"},
        {"year": 299, "lord": "Cley Cerwyn", "title": "Lord of Cerwyn", "event": "Was killed by Bolton men during the battle at Winterfell.", "canon": "canon", "source": SOURCE + "House_Cerwyn"},
    ],
    "hornwood": [
        {"year": 299, "lord": "Halys Hornwood", "title": "Lord of Hornwood", "event": "Was killed at the battle on the Green Fork; his heir Daryn later died at the Whispering Wood.", "canon": "canon", "source": SOURCE + "House_Hornwood"},
        {"year": 299, "lord": "Donella Hornwood", "title": "Lady of Hornwood", "event": "Led the house during the Hornwood succession crisis after the deaths of her husband and son.", "canon": "canon", "source": SOURCE + "House_Hornwood"},
    ],
    "locke": [
        {"year": None, "lord": "House Locke", "title": "Kings of Oldcastle (formerly)", "event": "Ruled as First Men kings after the Long Night before being reduced to vassalage by the Kings of Winter.", "canon": "canon", "source": SOURCE + "House_Locke"},
    ],
}


def main():
    houses = json.loads(HOUSES.read_text(encoding="utf-8"))
    changed = 0
    for house in houses:
        metadata = house.setdefault("metadata", {})
        entry = SIGILS_AND_WORDS.get(house["id"])
        if entry:
            sigil, words = entry
            metadata["sigil"] = sigil
            if words is not None:
                metadata["words"] = words
            changed += 1
        if house["id"] in TIMELINES:
            metadata["timeline"] = TIMELINES[house["id"]]
            changed += 1
    HOUSES.write_text(json.dumps(houses, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Enriched {changed} AWOIAF-supported house fields.")


if __name__ == "__main__":
    main()
