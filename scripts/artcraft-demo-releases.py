"""Download official static web release assets only; never run upstream build code."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import urllib.request
import zipfile

APPS = ('photocraft', 'vectorcraft', 'pdfcraft', 'lightcraft', 'filmcraft',
        'effectcraft', 'designcraft', 'wordcraft', 'gridcraft', 'deckcraft',
        'cadcraft', 'figcraft', 'soundcraft')
SHA = re.compile(r'^[a-f0-9]{64}$')
VERSION = re.compile(r'^v(\d+)\.(\d+)\.(\d+)$')
MAX_ZIP = 128 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024


def fetch(url, maximum, api=False):
    headers = {'User-Agent': 'creative-workspace-demo-updater', 'Accept': 'application/vnd.github+json' if api else '*/*'}
    if api and os.environ.get('GH_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GH_TOKEN']
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError('Download exceeds budget')
    return data


def api(endpoint):
    return json.loads(fetch('https://api.github.com/' + endpoint, 4 * 1024 * 1024, True))


def validate(lock):
    if lock.get('schemaVersion') != 1 or [a.get('app') for a in lock.get('apps', [])] != list(APPS):
        raise ValueError('Unexpected release allowlist/schema')
    for a in lock['apps']:
        app, tag = a['app'], a['tag']
        if a['repo'] != 'storytold/' + app or not VERSION.fullmatch(tag):
            raise ValueError('Unexpected repository/tag')
        if not re.fullmatch(r'[a-f0-9]{40}', a['commit']) or not SHA.fullmatch(a['sha256']):
            raise ValueError('Missing immutable commit/digest')
        if not isinstance(a['releaseId'], int) or not isinstance(a['size'], int) or not 0 < a['size'] <= MAX_ZIP:
            raise ValueError('Invalid release asset identity/budget')
        if a['asset'] != f'{app}-web-{tag[1:]}.zip':
            raise ValueError('Only official web ZIP assets allowed')
    return lock


def check_transition(old, new):
    validate(old); validate(new)
    for before, after in zip(old['apps'], new['apps']):
        if tuple(map(int, VERSION.fullmatch(after['tag']).groups())) < tuple(map(int, VERSION.fullmatch(before['tag']).groups())):
            raise ValueError('Refusing automatic upstream downgrade')
        if before['tag'] == after['tag'] and before != after:
            raise ValueError('Published upstream release changed; review required')


def discover(current=None):
    policy = json.loads((Path(__file__).parents[1] / 'cloudflare/artcraft-demo-policy.json').read_text())
    if policy.get('schemaVersion') != 1 or any(app not in APPS for app in policy.get('blockedReleases', {})):
        raise ValueError('Unexpected compatibility policy')
    apps = []
    for app in APPS:
        repo = 'storytold/' + app
        release = api(f'repos/{repo}/releases/latest')
        hold = policy.get('blockedReleases', {}).get(app)
        if hold:
            if not VERSION.fullmatch(hold['tag']) or not VERSION.fullmatch(hold['fallback']) or tuple(map(int, VERSION.fullmatch(hold['fallback']).groups())) >= tuple(map(int, VERSION.fullmatch(hold['tag']).groups())):
                raise ValueError('Invalid compatibility hold')
            if release['tag_name'] == hold['tag']:
                release = api(f'repos/{repo}/releases/tags/{hold["fallback"]}')
            else:
                hold = None
        tag = release['tag_name']
        if release['draft'] or release['prerelease'] or not VERSION.fullmatch(tag):
            raise ValueError('Only stable published releases supported')
        name = f'{app}-web-{tag[1:]}.zip'
        assets = [a for a in release['assets'] if a['name'] == name]
        sums = [a for a in release['assets'] if a['name'] == 'SHA256SUMS.txt']
        if len(assets) != 1 or len(sums) != 1:
            raise ValueError(f'{app}: missing/ambiguous web asset/checksums')
        asset = assets[0]
        digest = asset.get('digest', '')
        if not digest.startswith('sha256:') or not SHA.fullmatch(digest[7:]):
            raise ValueError(f'{app}: GitHub asset SHA-256 required')
        commit = api(f'repos/{repo}/git/ref/tags/{tag}')['object']
        for _ in range(4):
            if commit['type'] == 'commit':
                break
            if commit['type'] != 'tag':
                raise ValueError('Unexpected Git ref type')
            commit = api(f'repos/{repo}/git/tags/{commit["sha"]}')['object']
        if commit['type'] != 'commit':
            raise ValueError('Tag does not resolve to a commit')
        item = dict(app=app, repo=repo, tag=tag, releaseId=release['id'],
                         commit=commit['sha'], asset=name, sha256=digest[7:],
                         size=asset['size'], publishedAt=release['published_at'])
        if hold:
            item['heldLatest'] = dict(tag=hold['tag'], reason=hold['reason'])
        apps.append(item)
    result = validate(dict(schemaVersion=1, apps=apps))
    if current and current.get('releaseLock'):
        check_transition(current['releaseLock'], result)
    return result


def extract(archive, destination, release):
    """No shell extraction: bound entries/bytes, reject traversal, links and executable routes."""
    prefix = f'{release["app"]}-web-{release["tag"][1:]}/'
    files, names, total = [], set(), 0
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        if len(entries) > 4096:
            raise ValueError('Too many ZIP entries')
        # Validate every member, including ones not published.
        for i in entries:
            n = i.filename
            if not n.startswith(prefix) or '\\' in n or '\x00' in n or any(p in ('.', '..', '') for p in n.rstrip('/').split('/')):
                raise ValueError('Unsafe ZIP path')
            if n in names or stat.S_ISLNK(i.external_attr >> 16) or i.flag_bits & 1:
                raise ValueError('Duplicate/link/encrypted ZIP entry')
            names.add(n)
            total += i.file_size
            if i.file_size > 96 * 1024 * 1024 or total > MAX_TOTAL:
                raise ValueError('Expanded ZIP exceeds budget')
        for i in entries:
            if i.is_dir():
                continue
            relative = i.filename[len(prefix):]
            parts = PurePosixPath(relative).parts
            # Upstream host configs never become Pages Functions/headers/redirects.
            if any(p.startswith(('.', '_')) for p in parts) or 'functions' in parts:
                if relative in ('.htaccess', '_headers', '_redirects'):
                    continue
                raise ValueError('Unexpected executable/hidden hosting file')
            if relative.endswith(('.gz', '.br')) and prefix + relative.rsplit('.', 1)[0] in names:
                continue  # One canonical uncompressed asset; our transport packs WASM.
            if not re.search(r'\.(html|js|mjs|wasm|txt|md|json|webmanifest|svg|png|jpg|jpeg|ico|otf|ttf|woff2?|css|bin|mp4|wav|ogg|webm|part-[a-z]+)$', relative, re.I) and not re.match(r'^(LICENSE|LICENCE|NOTICE|COPYING|COPYRIGHT|AUTHORS)', parts[-1], re.I):
                raise ValueError('Unexpected static asset type: ' + relative)
            data = z.read(i)
            out = destination / relative
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            files.append(dict(path=relative, size=len(data), sha256=hashlib.sha256(data).hexdigest()))
    required = {'index.html', 'LICENSE-MIT', 'LICENSE-APACHE'}
    if not required <= {f['path'] for f in files} or not any(f['path'].endswith('.wasm') for f in files):
        raise ValueError('Incomplete web package/licenses')
    adjustments = []
    if release['app'] == 'photocraft' and not (destination / 'fonts/manifest.txt').exists():
        (destination / 'fonts').mkdir(exist_ok=True)
        (destination / 'fonts/manifest.txt').write_bytes(b'')
        files.append(dict(path='fonts/manifest.txt', size=0, sha256=hashlib.sha256(b'').hexdigest()))
        adjustments.append('Empty optional served-font catalogue; built-in fonts and upstream UI unchanged')
    manifest = dict(schemaVersion=1, app=release['app'], repo=release['repo'],
                    commit=release['commit'], processing='browser', release=release,
                    licenses=['LICENSE-MIT', 'LICENSE-APACHE'], hostAdjustments=adjustments, files=files)
    (destination / 'creative-workspace-ui.json').write_text(json.dumps(manifest, indent=2) + '\n')


def stage(lock, cache, registry):
    validate(lock)
    registry.mkdir(parents=True, exist_ok=True)
    if any(registry.iterdir()):
        raise ValueError('Registry must be empty')
    for a in lock['apps']:
        cache_dir = cache / a['app']
        cache_dir.mkdir(parents=True, exist_ok=True)
        base = f'https://github.com/{a["repo"]}/releases/download/{a["tag"]}/'
        archive = cache_dir / a['asset']
        if not archive.exists():
            archive.write_bytes(fetch(base + a['asset'], MAX_ZIP))
        if archive.stat().st_size != a['size'] or hashlib.sha256(archive.read_bytes()).hexdigest() != a['sha256']:
            raise ValueError('Release ZIP digest/size mismatch')
        sums = fetch(base + 'SHA256SUMS.txt', 1024 * 1024).decode()
        if len(re.findall(r'^' + a['sha256'] + r' [ *]' + re.escape(a['asset']) + r'\r?$', sums, re.M)) != 1:
            raise ValueError('Published checksum mismatch')
        destination = registry / a['app'] / a['sha256']
        destination.mkdir(parents=True)
        extract(archive, destination, a)
        print(a['app'], a['tag'], 'verified', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    d = commands.add_parser('discover'); d.add_argument('lock', type=Path); d.add_argument('--current')
    s = commands.add_parser('stage'); s.add_argument('lock', type=Path); s.add_argument('cache', type=Path); s.add_argument('registry', type=Path)
    args = parser.parse_args()
    if args.command == 'discover':
        current = json.loads(fetch(args.current, 4 * 1024 * 1024)) if args.current else None
        result = discover(current)
        args.lock.parent.mkdir(parents=True, exist_ok=True)
        args.lock.write_text(json.dumps(result, indent=2) + '\n')
        changed = not current or current.get('releaseLock') != result
        print('changed=' + str(changed).lower())
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
                out.write('changed=' + str(changed).lower() + '\n')
    else:
        stage(json.loads(args.lock.read_text()), args.cache, args.registry)
