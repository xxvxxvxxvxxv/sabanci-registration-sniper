const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const scope={window:{}};vm.runInNewContext(fs.readFileSync('public/registration-data.js','utf8'),scope);
const data=JSON.parse(JSON.stringify(scope.window.REGISTRATION_DAYS));
vm.runInThisContext(fs.readFileSync('public/registration-core.js','utf8'));
const {evaluate}=globalThis.RegistrationCore;
const check=(course,major,senior,term='202601')=>evaluate(data,course,term,major,senior);
assert.equal(Object.keys(data.courses).length,251);
assert.equal(data.majors.length,18);
assert.deepEqual(check('CS 204','EE','no').days,[1,2,3]);
assert.deepEqual(check('CS 303','EE','yes').days,[2,3]);
assert.deepEqual(check('CS303','CS','yes').days,[1,2,3]);
for(const c of ['EE 311','EE 313','EE 409','HUM 207']){
 assert.deepEqual(check(c,'EE','no').days,[2,3]);
 assert.deepEqual(check(c,'EE','yes').days,[1,2,3]);
 assert.deepEqual(check(c,'EE','unknown').conditional,[1]);
 assert.equal(check(c,'EE','unknown').label,'D1? · D2 · D3');
}
assert.deepEqual(check('CS 204','MAT','no').days,[2,3]);
assert.deepEqual(check('CS 303','Undeclared','no').days,[3]);
assert.equal(check('EE 48010','EE','yes').restricted,true);
assert(check('EE 48010','EE','yes').detail.includes('ALL days'));
assert.equal(check('HUM 207D','EE','yes').label,'Check PDF'); // No invented suffix matching.
assert.equal(check('UNKNOWN 999','EE','yes').label,'Check PDF');
assert.equal(check('EE 409','EE','yes','202602').label,'Check PDF');
assert.equal(check('EE 409','','yes').label,'Choose major');
assert.equal(check('EE 409','invalid','yes').label,'Choose major');
assert.deepEqual(check('IE 311','IE (MS)','no').days,[1,2,3]);
for(const rule of Object.values(data.courses))for(const programs of rule.days)assert(programs.every(m=>m==='ALL'||data.majors.includes(m)));
assert(fs.readFileSync('public'+data.source).subarray(0,5).toString()==='%PDF-');
console.log('Registration rules: 251 rows; major matching, 94-credit conditions, critical exemptions, restrictions and unknown-term fallbacks passed.');
