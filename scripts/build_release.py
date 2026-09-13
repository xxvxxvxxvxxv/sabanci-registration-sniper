"""Build shareable archives from an explicit source allowlist, never user state."""
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import json

ROOT=Path(__file__).resolve().parent.parent
VERSION='0.6.2'
FILES=['app.py','catalog.py','choices.py','seats.py','phone.py','index.html','style.css','ui.js','catalog-ui.js',
       'seats-ui.js','phone-ui.js','mock.html','mock.js','start-mac.command','start-windows.bat','README.md',
       'PRIVACY.md','PUBLISHING.md','RELEASE_NOTES.md','.gitignore','.github/workflows/checks.yml',
       'test_app.py','test_catalog.py','test_upgrade.py','test_seats.py','test_choices.py','test_import.py',
       'assets/FONT-LICENSE.txt','assets/heading.otf','assets/reticle.svg','data/catalog.json',
       'data/spring-registration-days.pdf','data/spring-rules.json','dev-tests/dom.cjs','dev-tests/panel.cjs',
       'dev-tests/package.json','scripts/build_release.py','docs/LOCAL-APP.md','docs/DEPLOYMENT.md','web/README.md']
EXTENSION=['manifest.json','background.js','popup.html','popup.css','popup.js','autofill-core.js','mock-adapter.js']

def build():
    out=ROOT/'dist';out.mkdir(exist_ok=True)
    extension=BytesIO()
    with ZipFile(extension,'w',ZIP_DEFLATED) as z:
        for name in EXTENSION:z.write(ROOT/'extension'/name,name)
    target=out/f'sabanci-registration-sniper-v{VERSION}.zip'
    with ZipFile(target,'w',ZIP_DEFLATED) as z:
        prefix=f'registration-sniper-v{VERSION}/'
        for name in FILES+[f'extension/{n}' for n in EXTENSION]+['extension/test-autofill.cjs']:
            if name == 'README.md':
                z.writestr(prefix+name,(ROOT/'docs/LOCAL-APP.md').read_text().replace('src="../assets/', 'src="assets/'))
            else:
                z.write(ROOT/name,prefix+name)
        z.writestr(prefix+'extension-package.zip',extension.getvalue())
    with ZipFile(target) as z:
        assert z.testzip() is None
        assert not any(n.endswith(('plan.json','.phone.json','.monitor.json')) for n in z.namelist())
    print(target)
    return target

if __name__=='__main__':build()
