# Titles data schema

`titles.json` contains title and nickname records extracted from sourced data.

## Extended Record Schema

```json
{
  "id": "string",
  "nume": "string",
  "purtatori": [
    {
      "persoana_id": "string",
      "persoana_nume": "string",
      "an_start": "number|null",
      "an_sfarsit": "number|null",
      "sursa": "string|null",
      "confidence": "canon|inferred|unknown"
    }
  ],
  "atribuit_de": [
    {
      "donator_id": "string",
      "donator_nume": "string",
      "an_aproximativ": "number|null",
      "sursa": "string|null",
      "confidence": "canon|inferred|unknown"
    }
  ],
  "creat_de": [
    {
      "creator_id": "string",
      "creator_nume": "string",
      "an_aproximativ": "number|null",
      "sursa": "string|null",
      "confidence": "canon|inferred|unknown"
    }
  ],
  "categorie": "string|null",
  "descrieri": ["string"]
}
```

### Semantic Predicate Rules
- `purtatori` (from `owned_by`): Persons or entities who actually hold or held the title/nickname.
- `atribuit_de` (from `given_by`): Persons who granted or bestowed the title/nickname.
- `creat_de` (from `made_by`): Persons who created or coined the title/nickname.
