(function(root) {
 'use strict';
 const normalize = value => String(value || '').replace(/\s+/g, '').toUpperCase();
 function evaluate(data, course, term, major, senior) {
  if (!data || String(term) !== data.term) return {label:'Check PDF', detail:'No matching registration-day table for this semester.', days:[]};
  if (!data.majors.includes(major)) return {label:'Choose major', detail:'Select a major or program to see registration days.', days:[]};
  const code = Object.keys(data.courses).find(c => normalize(c) === normalize(course));
  if (!code) return {label:'Check PDF', detail:'This course is not listed in the published table. Check official announcements.', days:[]};
  const rule = data.courses[code], days = [], conditional = [];
  rule.days.forEach((programs, i) => {
   if (!programs.includes(major) && !programs.includes('ALL')) return;
   if (i === 0 && !rule.critical) {
    if (senior === 'no') return;
    if (senior !== 'yes') { conditional.push(1); return; }
   }
   days.push(i + 1);
  });
  const labels = [...days.map(day => `D${day}`), ...conditional.map(day => `D${day}?`)].sort();
  const suffix = rule.class_restricted ? ' !' : '';
  const detail = `${code} · ${major}: ${days.length ? 'days ' + days.join(', ') : 'no confirmed day for this selection'}.` +
   (conditional.length ? ' Day 1 requires at least 94 earned SU credits.' : '') +
   (senior === 'no' && !rule.critical && (rule.days[0].includes(major) || rule.days[0].includes('ALL')) ? ' Day 1 excluded: fewer than 94 earned SU credits.' : '') +
   (rule.critical ? ' Critical course: no Day 1 senior restriction.' : '') +
   (rule.class_restricted ? ' Additional class restrictions apply on ALL days; check the course catalog.' : '') +
   ' Prerequisites, component requirements and registration holds still apply.';
  return {label:(labels.join(' · ') || 'Check rules') + suffix, detail, days, conditional, restricted:rule.class_restricted, code, page:rule.page};
 }
 const api = {evaluate};
 if (typeof module !== 'undefined' && module.exports) module.exports = api;
 else root.RegistrationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
