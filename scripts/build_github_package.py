"""Package the uploadable source tree, excluding runtime data and build output."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from build_release import FILES, EXTENSION

ROOT = Path(__file__).resolve().parent.parent
files = set(FILES + [f'extension/{name}' for name in EXTENSION] + ['extension/test-autofill.cjs', 'scripts/build_github_package.py'])
for directory in ('docs', 'web'):
    for path in (ROOT / directory).rglob('*'):
        relative = path.relative_to(ROOT)
        if any(part in {'node_modules', 'dist', '.wrangler', '__pycache__', '.git'} for part in relative.parts):
            continue
        if path.is_file() and not path.name.startswith(('.env', '.dev.vars')):
            files.add(relative.as_posix())
assert not any(Path(name).name in {'plan.json', '.phone.json', '.monitor.json'} for name in files)
out = ROOT.parent / 'sabanci-registration-sniper-github-cloudflare.zip'
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for name in sorted(files):
        archive.write(ROOT / name, 'sabanci-registration-sniper/' + name)
with ZipFile(out) as archive:
    assert archive.testzip() is None
print(f'{out}\n{len(files)} files; {out.stat().st_size:,} bytes')
