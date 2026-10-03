"""Vendor four Fontsource families locally without changing existing dependencies."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    'barlow-condensed': ('Barlow Condensed', [400, 600, 700, 900], ['normal', 'italic']),
    'fraunces': ('Fraunces', [400, 700, 900], ['normal', 'italic']),
    'syne': ('Syne', [400, 600, 700, 800], ['normal']),
    'shadows-into-light': ('Shadows Into Light', [400], ['normal']),
}
report = []
for ident, (family, weights, styles) in SPECS.items():
    with urllib.request.urlopen(f'https://registry.npmjs.org/@fontsource/{ident}/latest', timeout=40) as response:
        metadata = json.load(response)
    with urllib.request.urlopen(metadata['dist']['tarball'], timeout=60) as response:
        payload = response.read()
    expected = metadata['dist']['integrity']
    actual = 'sha512-' + base64.b64encode(hashlib.sha512(payload).digest()).decode()
    if actual != expected:
        raise RuntimeError('Integrity mismatch: ' + ident)
    folder = ROOT / 'src' / 'typography' / 'assets' / ident
    folder.mkdir(parents=True, exist_ok=True)
    css = []
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        names = archive.getnames()
        license_name = next(n for n in names if n.endswith('/LICENSE'))
        (folder / 'LICENSE').write_bytes(archive.extractfile(license_name).read())
        for weight in weights:
            for style in styles:
                filename = f'{ident}-latin-{weight}-{style}.woff2'
                data = archive.extractfile('package/files/' + filename).read()
                (folder / filename).write_bytes(data)
                css.append(f"@font-face {{ font-family: '{family}'; font-style: {style}; font-weight: {weight}; font-display: swap; src: url('./{filename}') format('woff2'); }}")
    (folder / 'index.css').write_text('\n'.join(css) + '\n', encoding='utf-8')
    report.append({'id': ident, 'version': metadata['version'], 'source': metadata['dist']['tarball'], 'integrity': expected, 'weights': weights, 'styles': styles})
    print(f'FONT_DOWNLOADED {ident} {metadata["version"]}', flush=True)
(ROOT / 'src' / 'typography' / 'assets' / 'sources.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
