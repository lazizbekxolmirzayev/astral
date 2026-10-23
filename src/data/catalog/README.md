# Catalogue

`entries.ts` is a hand-curated starter set (`curated-unverified`, all values
`estimated`). It exists so search, display and "load into simulator" work end to
end. It is not a scientific dataset.

To grow it, add an import script that reads one named dataset (IAU WGSN star
names, NASA Exoplanet Archive `pscomppars`, the Meteoritical Bulletin) and emits
records with `reviewStatus: 'imported'`, `provenance: 'measured'` and the
dataset's own licence. Never mix invented values into imported records.
