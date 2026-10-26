import unittest
from readability import analyze, compare

class ReadabilityTests(unittest.TestCase):
    def test_reference_calculation(self):
        result = analyze('One fish. Two fish.')
        self.assertEqual((result['words'], result['letters'], result['sentences']), (4, 14, 2))
        self.assertEqual(result['coleman_liau_index'], -10.02)

    def test_empty_and_punctuation_only(self):
        for text in ['', '   ', '... ! ?']:
            self.assertIsNone(analyze(text)['coleman_liau_index'])
            self.assertEqual(analyze(text)['words'], 0)

    def test_whitespace_contractions_and_fragments(self):
        result = analyze("Don't   stop\nnow")
        self.assertEqual(result['words'], 3)
        self.assertEqual(result['letters'], 11)
        self.assertEqual(result['sentences'], 1)

    def test_draft_comparison_and_threshold(self):
        original = analyze('We use the tool to inspect the code.', 5)
        revised = analyze('We inspect code.', 5)
        self.assertEqual(len(original['long_sentences']), 1)
        self.assertEqual(revised['long_sentences'], [])
        self.assertEqual(compare(original, revised)['words'], -5)
        self.assertNotIn('coleman_liau_index', compare(analyze(''), revised))
