#!/usr/bin/env python3
"""Analyze English writing and compare readability across drafts."""
import argparse
import json
import re
from pathlib import Path


def words(text):
    return re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*", text)


def sentence_details(text, threshold=25):
    details = []
    for match in re.finditer(r'[^.!?]+(?:[.!?]+|$)', text):
        raw = match.group()
        part = raw.strip()
        tokens = words(part)
        if tokens:
            start = match.start() + len(raw) - len(raw.lstrip())
            details.append({'text': part, 'start': start, 'end': start + len(part),
                            'words': len(tokens), 'long': len(tokens) >= threshold})
    return details


def sentences(text):
    return [part['text'] for part in sentence_details(text)]


def analyze(text, long_sentence=25):
    if not isinstance(text, str):
        raise ValueError('Drafts must be text.')
    if isinstance(long_sentence, bool) or not isinstance(long_sentence, int) or not 1 <= long_sentence <= 200:
        raise ValueError('Long-sentence threshold must be a whole number from 1 to 200.')
    tokens = words(text)
    details = sentence_details(text, long_sentence)
    parts = [part['text'] for part in details]
    letters = sum(sum(character.isascii() and character.isalpha() for character in word)
                  for word in tokens)
    count = len(tokens)
    index = (0.0588 * letters * 100 / count - 0.296 * len(parts) * 100 / count - 15.8
             if count else None)
    return {'sentence_details': details, 'words': count, 'letters': letters, 'sentences': len(parts),
            'unique_words': len({word.lower() for word in tokens}),
            'average_sentence_words': round(count / len(parts), 2) if parts else 0,
            'coleman_liau_index': round(index, 2) if index is not None else None,
            'long_sentences': [{'text': part, 'words': len(words(part))}
                               for part in parts if len(words(part)) >= long_sentence]}


def compare(before, after):
    return {key: round(after[key] - before[key], 2)
            for key in ('words', 'sentences', 'average_sentence_words', 'coleman_liau_index')
            if before[key] is not None and after[key] is not None}


MAX_CHARACTERS = 100000


def report(original, revised=None, threshold=25):
    for draft in (original, revised):
        if draft is not None and (not isinstance(draft, str) or len(draft) > MAX_CHARACTERS):
            raise ValueError('Each draft must be text of at most 100,000 characters.')
    result = {'original': analyze(original, threshold)}
    if revised is not None:
        result['revised'] = analyze(revised, threshold)
        result['change'] = compare(result['original'], result['revised'])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--compare', type=Path, help='Analyze a revised draft and report its changes')
    parser.add_argument('--long-sentence', type=int, default=25)
    parser.add_argument('--output', type=Path, help='Export JSON without overwriting an existing file')
    args = parser.parse_args()
    if not 1 <= args.long_sentence <= 200:
        parser.error('--long-sentence must be from 1 to 200')
    try:
        result = report(args.file.read_text(encoding='utf-8'),
                        args.compare.read_text(encoding='utf-8') if args.compare else None,
                        args.long_sentence)
        rendered = json.dumps(result, indent=2)
        if args.output:
            with args.output.open('x', encoding='utf-8') as destination:
                destination.write(rendered + '\n')
        print(rendered)
    except (OSError, UnicodeError, ValueError) as error:
        parser.exit(2, f'Error: {error}\n')


if __name__ == '__main__':
    main()
