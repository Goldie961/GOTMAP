# Needs review

- House woolfield: seat Woolfield was not imported.
- House charlton: seat Charlton was not imported.
- House sunderland: seat Sisterton was not imported.

## Validation remaining

- `verify_all.py` now reports 0 coordinate/region mismatches. The 37 invalid legacy editor values were deliberately removed rather than guessed; these locations are visible as uncalibrated in the editor.
- 59 houses still have `timeline: []`, `words: null`, and `founded: null` simultaneously. Their AWOIAF pages need individual review before facts can be safely added. Do not replace those nulls with invented dates or mottos.
