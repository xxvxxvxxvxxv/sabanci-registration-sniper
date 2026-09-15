'use strict';
(() => {
 const storageKey = 'sniper-registration-profile-v1';
 let profile = {major:'', senior:'unknown'};
 try { const saved=JSON.parse(localStorage.getItem(storageKey)); if(saved && typeof saved === 'object') profile={major:saved.major,senior:saved.senior}; } catch {}
 if (!REGISTRATION_DAYS.majors.includes(profile.major)) profile.major='';
 if (!['yes','no','unknown'].includes(profile.senior)) profile.senior='unknown';
 const major=$('registration-major'), senior=$('registration-senior');
 for(const code of REGISTRATION_DAYS.majors) {const option=document.createElement('option');option.value=code;option.textContent=code;major.append(option);}
 major.value=profile.major;senior.value=profile.senior;
 function refresh() {
  profile={major:major.value,senior:senior.value};
  try {localStorage.setItem(storageKey,JSON.stringify(profile));} catch {}
  if(window.renderCatalog) window.renderCatalog();
 }
 major.onchange=refresh;senior.onchange=refresh;
 window.registrationInfo = row => RegistrationCore.evaluate(REGISTRATION_DAYS, row.catalog_base || row.course, plan.term, profile.major, profile.senior);
 window.registrationBadge = row => {
  const result=window.registrationInfo(row);
  return `<span class="registration-badge${result.restricted?' restricted':''}" title="${esc(result.detail)}">${esc(result.label)}</span>`;
 };
 window.renderRegistrationSelection = rows => {
  const unique=new Map(rows.map(row=>[row.catalog_base||row.course,row]));
  $('registration-selection').innerHTML=[...unique].map(([code,row])=>{
   const result=window.registrationInfo(row);
   return `<a class="registration-course" href="${REGISTRATION_DAYS.source}${result.page?'#page='+result.page:''}" target="_blank" rel="noopener noreferrer" title="${esc(result.detail)}" aria-label="${esc(result.detail)} Open official PDF"><b>${esc(code)}</b>${window.registrationBadge(row)}</a>`;
  }).join('');
  $('registration-note').textContent=String(plan.term)!==REGISTRATION_DAYS.term?'The available PDF is for Fall 2026–2027. Registration days for this semester are unverified.':
   'D1 / D2 / D3 = registration days, not dates. D1? requires 94+ earned SU credits. ! = additional class restrictions. Course chips open the official PDF.';
 };
})();
