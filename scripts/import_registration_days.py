"""Extract the official ruled PDF table; reject malformed rows instead of guessing.

Usage: python scripts/import_registration_days.py path/to/CourseRegistrationDays_20260914.pdf
Requires pdfplumber only when regenerating the bundled rules.
"""
import json
import re
import shutil
import sys
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
MAJORS = {'BIO','CS','CULT','DSA','ECON','EE','IE','IE (MS)','IS','MAN','MAT','ME','POLS','PSIR','PSY','SPS','Undeclared','VACD'}

def extract(source):
    courses = {}
    with pdfplumber.open(source) as pdf:
        assert '14.09.2026 09:51' in pdf.pages[0].extract_text(), 'Source edition differs; review term and date before importing.'
        for page_number, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            assert len(tables) == 1, f'Unexpected table layout on page {page_number}'
            for cells in tables[0][2:]:
                label = cells[0] or ''
                if label.startswith('*Please follow'): continue
                match = re.fullmatch(r'([A-Z]+ \d+[A-Z]?)(\*)?(?:\s*\(!\)\s*Click)?', label)
                assert match, f'Unrecognized course label: {label!r}'
                code = match[1]
                assert code not in courses, f'Duplicate course: {code}'
                days = []
                for cell in cells[1:]:
                    value = ' '.join((cell or '').split())
                    programs = [part.strip() for part in value.split('-')] if value else []
                    assert all(p in MAJORS | {'ALL'} for p in programs), (code, programs)
                    days.append(programs)
                assert len(days) == 3
                courses[code] = dict(days=days, critical=bool(match[2]), class_restricted='(!)' in label, page=page_number)
    return dict(term='202601', issued='2026-09-14 09:51', term_label='Fall 2026–2027',
                source='/data/CourseRegistrationDays_20260914.pdf', majors=sorted(MAJORS), courses=courses)

if __name__ == '__main__':
    source = Path(sys.argv[1])
    data = extract(source)
    public = ROOT / 'web/public'
    shutil.copyfile(source, public / data['source'].lstrip('/'))
    (public / 'registration-data.js').write_text('// Generated from the official PDF by scripts/import_registration_days.py.\nwindow.REGISTRATION_DAYS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'Imported {len(data["courses"])} courses and {len(data["majors"])} programs.')
