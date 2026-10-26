#!/usr/bin/env python3
"""Analyze English writing and compare readability across drafts."""
import argparse
import json
import re
from pathlib import Path


def words(text):
    return re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*", text)


def sentences(text):
    return [part.strip() for part in re.findall(r'[^.!?]+(?:[.!?]+|$)', text) if words(part)]


def analyze(text, long_sentence=25):
    tokens = words(text)
    parts = sentences(text)
    letters = sum(sum(character.isascii() and character.isalpha() for character in word)
                  for word in tokens)
    count = len(tokens)
    index = (0.0588 * letters * 100 / count - 0.296 * len(parts) * 100 / count - 15.8
             if count else None)
    return {'words': count, 'letters': letters, 'sentences': len(parts),
            'unique_words': len({word.lower() for word in tokens}),
            'average_sentence_words': round(count / len(parts), 2) if parts else 0,
            'coleman_liau_index': round(index, 2) if index is not None else None,
            'long_sentences': [{'text': part, 'words': len(words(part))}
                               for part in parts if len(words(part)) >= long_sentence]}


def compare(before, after):
    return {key: round(after[key] - before[key], 2)
            for key in ('words', 'sentences', 'average_sentence_words', 'coleman_liau_index')
            if before[key] is not None and after[key] is not None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--compare', type=Path, help='Analyze a revised draft and report its changes')
    parser.add_argument('--long-sentence', type=int, default=25)
    parser.add_argument('--output', type=Path, help='Export JSON without overwriting an existing file')
    args = parser.parse_args()
    if args.long_sentence < 1:
        parser.error('--long-sentence must be positive')
    try:
        result = {'original': analyze(args.file.read_text(encoding='utf-8'), args.long_sentence)}
        if args.compare:
            result['revised'] = analyze(args.compare.read_text(encoding='utf-8'), args.long_sentence)
            result['change'] = compare(result['original'], result['revised'])
        rendered = json.dumps(result, indent=2)
        if args.output:
            with args.output.open('x', encoding='utf-8') as destination:
                destination.write(rendered + '\n')
        print(rendered)
    except (OSError, UnicodeError) as error:
        parser.exit(2, f'Error: {error}\n')


if __name__ == '__main__':
    main()
