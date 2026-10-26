# Readability Analyzer

Inspect English writing with Coleman–Liau readability, vocabulary counts, sentence lengths, and long-sentence detection. Compare two drafts and export a reproducible JSON report.

## Run

```sh
python3 readability.py examples/original.txt
python3 readability.py examples/original.txt --compare examples/revised.txt --long-sentence 12 --output report.json
```

`change` is revised minus original. A negative readability-index change means a lower estimated grade level; it does not automatically mean better writing. Empty input reports a null index. Export files must not already exist.

## Method and limits

The Coleman–Liau formula is `0.0588 × letters/words × 100 − 0.296 × sentences/words × 100 − 15.8`. The tool reports the numeric index rather than claiming a precise reader age. Words are ASCII English letter sequences with optional internal apostrophes; letters exclude apostrophes. Runs of `.`, `!`, or `?` end sentences, and a trailing unpunctuated fragment counts as a sentence. Multiple spaces do not create phantom words. Sentence detection is heuristic: abbreviations, decimal points, code, and non-English writing can distort results. Long sentences meet or exceed the configurable word threshold.

## Next steps

Build side-by-side draft highlighting and add abbreviation-aware sentence segmentation.

## Verification

```sh
python3 -m unittest discover -s tests -v
```

Requires Python 3.9+; no third-party packages or API keys.

## Origins

Inspired by Ugochukwu Igweagu’s CS50 coursework in [the projects collection](https://github.com/Ugo175/projects). This is a new standalone implementation with additional functionality, not a copy of CS50 starter files. See [ATTRIBUTION.md](ATTRIBUTION.md).
