import copy
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('releases', Path(__file__).parents[1] / 'scripts/artcraft-demo-releases.py')
releases = importlib.util.module_from_spec(spec)
spec.loader.exec_module(releases)


class ReleaseImport(unittest.TestCase):
    def setUp(self):
        self.release = dict(app='photocraft', repo='storytold/photocraft', tag='v1.2.3',
                            commit='a' * 40, sha256='b' * 64, releaseId=1, size=10,
                            asset='photocraft-web-1.2.3.zip')

    def archive(self, extra=None):
        result = io.BytesIO()
        with zipfile.ZipFile(result, 'w') as z:
            for name, data in [('index.html', '<canvas/>'), ('app.wasm', b'\0asm'),
                               ('LICENSE-MIT', 'MIT'), ('LICENSE-APACHE', 'Apache'),
                               ('licenses/library/NOTICE', 'third party'),
                               ('_headers', 'untrusted host settings'), ('.htaccess', 'ignored')]:
                z.writestr('photocraft-web-1.2.3/' + name, data)
            if extra:
                z.writestr(*extra)
        result.seek(0)
        return result

    def test_only_static_files_and_licenses_are_registered(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            releases.extract(self.archive(), out, self.release)
            meta = json.loads((out / 'creative-workspace-ui.json').read_text())
            self.assertEqual(meta['release'], self.release)
            self.assertTrue((out / 'licenses/library/NOTICE').exists())
            self.assertFalse((out / '_headers').exists())
            self.assertFalse((out / '.htaccess').exists())

    def test_traversal_functions_duplicates_and_symlinks_fail(self):
        link = zipfile.ZipInfo('photocraft-web-1.2.3/link.js')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        for name in ['../secret', 'photocraft-web-1.2.3/../secret',
                     'photocraft-web-1.2.3/functions/api.js',
                     'photocraft-web-1.2.3/_worker.js',
                     'photocraft-web-1.2.3/a\\bad.js',
                     'photocraft-web-1.2.3/index.html', link]:
            with self.subTest(name=str(name)), tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(ValueError):
                    releases.extract(self.archive((name, 'bad')), Path(tmp), self.release)

    def test_bomb_header_fails_before_extraction(self):
        old = releases.MAX_TOTAL
        try:
            releases.MAX_TOTAL = 2
            with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(ValueError, 'budget'):
                releases.extract(self.archive(), Path(tmp), self.release)
        finally:
            releases.MAX_TOTAL = old

    def test_allowlist_and_web_asset_identity_cannot_expand(self):
        lock = dict(schemaVersion=1, apps=[])
        for app in releases.APPS:
            item = copy.deepcopy(self.release)
            item.update(app=app, repo='storytold/' + app, asset=app + '-web-1.2.3.zip')
            lock['apps'].append(item)
        releases.validate(lock)
        for key, value in [('repo', 'other/photocraft'), ('tag', '../main'),
                           ('asset', 'native-linux.tar.gz'), ('sha256', 'bad')]:
            bad = copy.deepcopy(lock); bad['apps'][0][key] = value
            with self.assertRaises(ValueError):
                releases.validate(bad)
        with self.assertRaises(ValueError):
            releases.validate(dict(schemaVersion=1, apps=lock['apps'][:-1]))
        releases.check_transition(lock, copy.deepcopy(lock))
        changed = copy.deepcopy(lock); changed['apps'][0]['sha256'] = 'c' * 64
        with self.assertRaisesRegex(ValueError, 'changed'):
            releases.check_transition(lock, changed)
        downgrade = copy.deepcopy(lock); downgrade['apps'][0].update(tag='v1.2.2', asset='photocraft-web-1.2.2.zip')
        with self.assertRaisesRegex(ValueError, 'downgrade'):
            releases.check_transition(lock, downgrade)

    def test_compatibility_hold_is_exact_and_next_release_is_attempted(self):
        policy = json.loads((Path(__file__).parents[1] / 'cloudflare/artcraft-demo-policy.json').read_text())
        hold = policy['blockedReleases']['deckcraft']
        for latest in [hold['tag'], 'v99.0.0']:
            calls = []
            def fake(endpoint):
                calls.append(endpoint)
                app = endpoint.split('/')[2]
                if '/git/ref/' in endpoint:
                    return {'object': {'type': 'commit', 'sha': 'a' * 40}}
                tag = (latest if app == 'deckcraft' else 'v1.2.3') if endpoint.endswith('/latest') else endpoint.rsplit('/', 1)[1]
                return dict(tag_name=tag, draft=False, prerelease=False, id=1, published_at='2026-10-22T00:00:00Z',
                            assets=[dict(name=f'{app}-web-{tag[1:]}.zip', size=10, digest='sha256:' + 'b' * 64), dict(name='SHA256SUMS.txt')])
            with patch.object(releases, 'api', fake):
                lock = releases.discover()
            deck = next(a for a in lock['apps'] if a['app'] == 'deckcraft')
            self.assertEqual(deck['tag'], hold['fallback'] if latest == hold['tag'] else latest)
            self.assertEqual('heldLatest' in deck, latest == hold['tag'])


if __name__ == '__main__':
    unittest.main()
