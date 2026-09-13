# Verify the SQL coordination against a real SQLite database without network requests.
import sqlite3
from pathlib import Path
c=sqlite3.connect(':memory:')
c.executescript(Path('migrations/0001_public_cache.sql').read_text())
c.execute("INSERT INTO source_gate(key) VALUES ('seats')")
q='UPDATE source_gate SET next=? WHERE key=? AND next<=? AND blocked=0 RETURNING key'
assert c.execute(q,(30000,'seats',0)).fetchone()==('seats',)
assert c.execute(q,(30000,'seats',0)).fetchone() is None
c.execute("UPDATE source_gate SET blocked=1 WHERE key='seats'")
assert c.execute(q,(90000,'seats',60000)).fetchone() is None
for key,t in [('202601:10123',20),('202601:10119',10)]:
 c.execute('INSERT INTO public_cache(key,requested) VALUES (?,?)',(key,t))
assert c.execute("SELECT key FROM public_cache WHERE requested>0 AND key NOT LIKE 'catalog:%' ORDER BY requested ASC LIMIT 1").fetchone()==('202601:10119',)
print('PASS: shared upstream gate, persistent stop and oldest-request-first queue.')
