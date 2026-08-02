# Objects data schema

`objects.json` contains object records extracted from sourced data.

## Extended Record Schema

```json
{
  "id": "string",
  "nume": "string",
  "categorie": "string|null",
  "material": "string|null",
  "owned_by": [
    {
      "proprietar": "string",
      "proprietar_nume": "string",
      "an_aproximativ": "number|null",
      "sursa": {
        "source_book": "string|null",
        "source_fragment": "string|number|null",
        "source_page": "string|null"
      },
      "confidence": "canon|inferred|unknown"
    }
  ],
  "given_by": [
    {
      "donator": "string",
      "donator_nume": "string",
      "an_aproximativ": "number|null",
      "sursa": {
        "source_book": "string|null",
        "source_fragment": "string|number|null",
        "source_page": "string|null"
      },
      "confidence": "canon|inferred|unknown"
    }
  ],
  "made_by": [
    {
      "creator": "string",
      "creator_nume": "string",
      "sursa": {
        "source_book": "string|null",
        "source_fragment": "string|number|null",
        "source_page": "string|null"
      },
      "confidence": "canon|inferred|unknown"
    }
  ],
  "descrieri": ["string"],
  "surse": [
    {
      "source_book": "string|null",
      "source_fragment": "string|number|null",
      "source_page": "string|null"
    }
  ]
}
```

### Semantic Predicate Rules
- `owned_by`: Chronological ownership-history array.
- `given_by`: Donators/givers who bestowed the object.
- `made_by`: Craftsmen/makers who created the object.
