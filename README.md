# Margin · Readability Analyzer

**A little room for clearer writing.** Compare drafts, highlight long sentences, and understand what changed—without rewriting your words for you.

A Python engine powers both the browser workspace and command-line analyzer. No dependencies, accounts, build tools, or external APIs are required.

![Margin showing long-sentence highlights and a side-by-side draft comparison](docs/desktop.jpg)

## Run locally

Requires **Python 3.9+**.

```sh
git clone https://github.com/Ugo175/readability-analyzer.git
cd readability-analyzer
python3 server.py
```

Open **http://127.0.0.1:8767**. Stop with `Ctrl+C`. If that port is occupied, run `python3 server.py --port 8768` and open the printed URL. The server binds only to this computer’s loopback interface.

## A one-minute demo

1. Open the default **team update** example. The original has **64 words, three sentences, and one long sentence**. The revision has **52 words, six sentences, and no long sentences** at the default 25-word threshold.
2. Choose **Highlights** on the original. Its 34-word opening sentence is marked in amber. The revised version has no amber passages.
3. Inspect the four comparison cards: grade-level estimate, word count, average sentence length, and long-sentence count.
4. Choose a bar in **One sentence at a time**. Its sentence appears in the detail panel and is selected in the draft preview.
5. Change the threshold or edit a draft. A notice marks the analysis as stale; export and chart selection are disabled until you compare again.
6. Choose **Export report** to download the numbers, sentence spans, threshold, and both draft texts as JSON.

See the [demo and browser checklist](docs/DEMO.md) or [mobile screenshot](docs/mobile.jpg).

## Features

- Side-by-side original and revised drafts, with Write and Highlights views.
- Local UTF-8 `.txt` imports and two original sample comparisons.
- Configurable long-sentence threshold from 1 to 200 words, inclusive.
- Sentence-level highlights with Unicode-safe source offsets.
- Shared-scale sentence charts with keyboard-accessible selection.
- Explicit handling of empty drafts and undefined grade-level estimates.
- JSON exports that preserve the analyzed drafts and settings.
- Responsive layouts, labeled controls, visible keyboard focus, live announcements, and reduced-motion support.

Each draft can contain up to **100,000 Unicode characters**. The file picker accepts files up to 400,000 bytes; API requests are limited to 2 MiB. Very large documents show the first 80 sentences per chart, while highlights and exports include all sentences. Browser textareas may impose a stricter limit on characters represented by surrogate pairs.

Text stays on your computer. No drafts are stored in a database, browser storage, or server-side files. Refreshing resets the workspace. Downloaded reports **include both draft texts**, so keep them wherever you normally keep your writing.

## Command-line analyzer

```sh
python3 readability.py examples/original.txt
python3 readability.py examples/original.txt --compare examples/revised.txt --long-sentence 25 --output report.json
```

`change` means revised minus original. Export files must not already exist. Omitting `--compare` analyzes a single draft. The CLI and browser endpoint return identical analysis for identical inputs; the browser export adds the source drafts and settings.

## What the numbers mean

The Coleman–Liau formula is:

```text
0.0588 × (letters per 100 words)
− 0.296 × (sentences per 100 words)
− 15.8
```

A lower index suggests simpler text according to this formula; it does not establish better writing, factual accuracy, or comprehension. The browser displays `<1` below grade one and `16+` at or above sixteen. Index changes use the raw numeric values, which remain available in JSON. A dash means no index can be calculated because the text contains no recognized words.

Words are ASCII English letter sequences with optional internal straight or curly apostrophes. Letter counts exclude apostrophes. Runs of `.`, `!`, and `?` end sentences; an unpunctuated trailing fragment counts as a sentence. Whitespace does not create extra words. Long sentences meet or exceed your selected word threshold.

**Limits:** sentence detection is deliberately heuristic. Abbreviations, decimal numbers, headings, and non-English prose can produce misleading segmentation. Non-ASCII text is preserved in previews, but the scoring model is intended for English and does not count accented letters as ordinary ASCII letters. Long-sentence flags are invitations to review, not error messages.

## Architecture

```text
Browser workspace (web/) → POST /api/analyze → server.py → readability.py
                                                              ↑
                                                        CLI analyzer
```

The frontend renders the Python engine’s results rather than maintaining another scoring implementation. Sentence offsets use Unicode code points; the browser converts text accordingly so emoji do not shift highlight boundaries. Draft content is inserted using text nodes, never interpreted as HTML.

The standard-library HTTP server serves a fixed asset list, rejects foreign hosts and origins, limits request sizes, and supplies a content security policy. This is a local development server, not a public production deployment.

## Verification

```sh
python3 -m unittest discover -s tests -v
```

The **14 tests** cover reference calculations, whitespace and contractions, empty input, exact thresholds, repeated sentences, Unicode source spans, input limits, browser-API/CLI parity, malformed requests, static-file isolation, and origin checks. HTTP tests briefly bind a local loopback server.

Browser verification covers highlighting, sentence selection, text import, custom text, stale-result handling, invalid thresholds, blank revisions, report downloads, and a narrow mobile layout. See [docs/DEMO.md](docs/DEMO.md).

## Future work

Abbreviation-aware sentence segmentation, optional additional readability formulas, saved local sessions, and a hosted demo with a production server.

## Origins

Created by **Ugochukwu Igweagu**, inspired by the readability exercise in [my CS50 projects collection](https://github.com/Ugo175/projects). This standalone implementation adds draft comparison, a browser workspace, sentence spans, highlighting, charts, exports, and HTTP integration tests. See [ATTRIBUTION.md](ATTRIBUTION.md).
