import http.client
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest

from readability import analyze, report
from server import Handler, MAX_REQUEST


class QuietHandler(Handler):
    def log_message(self, *_args):
        pass


class AnalysisTests(unittest.TestCase):
    def test_sentence_spans_preserve_unicode_and_whitespace(self):
        text = '  😀 Hello world!\n\n  A second sentence.  '
        result = analyze(text, 3)
        details = result['sentence_details']
        self.assertEqual([part['words'] for part in details], [2, 3])
        self.assertEqual([part['long'] for part in details], [False, True])
        for part in details:
            self.assertEqual(text[part['start']:part['end']], part['text'])
        self.assertEqual(details[0]['start'], 2)

    def test_exact_threshold_and_repeated_sentences(self):
        details = analyze('One two three. One two three.', 3)['sentence_details']
        self.assertTrue(all(part['long'] for part in details))
        self.assertNotEqual(details[0]['start'], details[1]['start'])

    def test_blank_revised_does_not_create_fake_grade(self):
        result = report('A readable draft.', '')
        self.assertIsNone(result['revised']['coleman_liau_index'])
        self.assertNotIn('coleman_liau_index', result['change'])
        self.assertEqual(result['revised']['sentence_details'], [])

    def test_validation_and_limits(self):
        for value in [True, 0, -1, 201, 1.5, '25', None]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                report('Hello.', '', value)
        for draft in [42, [], 'a' * 100001]:
            with self.assertRaises(ValueError):
                report(draft)
        self.assertEqual(report('a' * 100000)['original']['words'], 1)

    def test_non_english_input_is_not_falsely_scored(self):
        self.assertIsNone(report('你好。')['original']['coleman_liau_index'])


class WebTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, data=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        try:
            connection.request(method, path, data, headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_api_cli_parity(self):
        with tempfile.TemporaryDirectory() as folder:
            original, revised = Path(folder) / 'before.txt', Path(folder) / 'after.txt'
            original.write_text('We use the tool to inspect the code. It helps us.')
            revised.write_text('We inspect code. It helps.')
            payload = {'original': original.read_text(), 'revised': revised.read_text(), 'threshold': 5}
            status, _, body = self.request('POST', '/api/analyze', json.dumps(payload),
                                           {'Content-Type': 'application/json'})
            cli = subprocess.check_output([sys.executable, 'readability.py', str(original),
                                           '--compare', str(revised), '--long-sentence', '5'], text=True)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body), json.loads(cli))

    def test_static_assets_and_private_files(self):
        for path in ['/', '/app.js', '/styles.css', '/favicon.svg']:
            status, headers, body = self.request('GET', path)
            self.assertEqual(status, 200)
            self.assertTrue(body)
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        for path in ['/readability.py', '/.git/config', '/../README.md']:
            self.assertEqual(self.request('GET', path)[0], 404)

    def test_bad_payloads(self):
        for value in [[], None, {}, {'original': 1}, {'original': 'Hi', 'threshold': False},
                      {'original': 'Hi', 'revised': []}]:
            status, _, body = self.request('POST', '/api/analyze', json.dumps(value),
                                           {'Content-Type': 'application/json'})
            self.assertEqual(status, 400)
            self.assertIn('error', json.loads(body))

    def test_bad_json_type_and_oversized_request(self):
        self.assertEqual(self.request('POST', '/api/analyze', '{', {'Content-Type': 'application/json'})[0], 400)
        self.assertEqual(self.request('POST', '/api/analyze', '{}', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.request('POST', '/api/analyze', headers={
            'Content-Type': 'application/json', 'Content-Length': str(MAX_REQUEST + 1)})[0], 413)

    def test_foreign_origin_and_host(self):
        self.assertEqual(self.request('GET', '/', headers={'Host': 'elsewhere.test'})[0], 403)
        self.assertEqual(self.request('POST', '/api/analyze', '{}',
                                      {'Content-Type': 'application/json', 'Origin': 'https://elsewhere.test'})[0], 403)
