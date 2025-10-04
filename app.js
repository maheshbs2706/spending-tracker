(async function(){

// helpers
const qs = (s,el=document)=> el.querySelector(s);
const qsa = (s,el=document)=> [...el.querySelectorAll(s)];

// Tab switching
qsa('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    qsa('.tabs button').forEach(b=>b.classList.remove('active'));
    qsa('.tab').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    qs(`#tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Subtab switching inside Reports
qsa('#tab-report .subtabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    qsa('#tab-report .subtabs button').forEach(b=>b.classList.remove('active'));
    qsa('#tab-report .subtab').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    qs(`#subtab-${btn.dataset.subtab}`).classList.add('active');
  });
});

const fmtINR = (n)=> new Intl.NumberFormat('en-IN',{ style:'currency', currency:'INR', maximumFractionDigits:2 }).format(Number(n||0));

// PWA install prompt
let deferredPrompt; const btnInstall = qs('#btn-install');
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; btnInstall.hidden=false; });
btnInstall?.addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt=null; btnInstall.hidden=true; });
if('serviceWorker' in navigator){ try { await navigator.serviceWorker.register('/sw.js'); } catch(e){ console.warn('SW failed', e); } }

// Seed defaults
await DB.seed();

// Elements
const memberList=qs('#member-list');
const memberName=qs('#member-name');
const categoryList=qs('#category-list');
const categoryName=qs('#category-name');

const expDate=qs('#exp-date');
const expMember=qs('#exp-member');
const expAmount=qs('#exp-amount');
const expCategory=qs('#exp-category');
const expPayment=qs('#exp-payment');
const expNote=qs('#exp-note');

const txBody=qs('#tx-body');
const totalsOverall=qs('#totals-overall');

const fFromOverall=qs('#filter-from-overall');
const fToOverall=qs('#filter-to-overall');
const fMemberOverall=qs('#filter-member-overall');
const fCategoryOverall=qs('#filter-category-overall');
const fPaymentOverall=qs('#filter-payment-overall');
const btnApplyOverall=qs('#btn-apply-overall');
const btnResetOverall=qs('#btn-reset-overall');

const fFromDetailed=qs('#filter-from-detailed');
const fToDetailed=qs('#filter-to-detailed');
const fMemberDetailed=qs('#filter-member-detailed');
const fCategoryDetailed=qs('#filter-category-detailed');
const fPaymentDetailed=qs('#filter-payment-detailed');
const btnApplyDetailed=qs('#btn-apply-detailed');
const btnResetDetailed=qs('#btn-reset-detailed');

const todayStr = new Date().toISOString().slice(0,10);
expDate.value = todayStr;
fFromOverall.value = fToOverall.value = todayStr;
fFromDetailed.value = fToDetailed.value = todayStr;

// Load lists
async function refreshMembers(){
  const members = await DB.members();
  memberList.innerHTML = '';
  expMember.innerHTML = '<option value="" disabled selected>Select member</option>';
  fMemberOverall.innerHTML = '<option value="">All Members</option>';
  fMemberDetailed.innerHTML = '<option value="">All Members</option>';
  for(const m of members){
    const li=document.createElement('li');
    li.innerHTML = `<span>${m.name}</span><button class="icon-btn" data-id="${m.id}">✕</button>`;
    memberList.appendChild(li);

    const opt=document.createElement('option'); opt.value=m.id; opt.textContent=m.name;
    expMember.appendChild(opt);
    fMemberOverall.appendChild(opt.cloneNode(true));
    fMemberDetailed.appendChild(opt.cloneNode(true));
  }
}

async function refreshCategories(){
  const cats = await DB.categories();
  categoryList.innerHTML='';
  expCategory.innerHTML = '<option value="" disabled selected>Select category</option>';
  fCategoryOverall.innerHTML = '<option value="">All Categories</option>';
  fCategoryDetailed.innerHTML = '<option value="">All Categories</option>';
  for(const c of cats){
    const li=document.createElement('li');
    li.innerHTML = `<span>${c.name}</span><button class="icon-btn" data-id="${c.id}">✕</button>`;
    categoryList.appendChild(li);

    const opt=document.createElement('option'); opt.value=c.name; opt.textContent=c.name;
    expCategory.appendChild(opt);
    fCategoryOverall.appendChild(opt.cloneNode(true));
    fCategoryDetailed.appendChild(opt.cloneNode(true));
  }
}

// Overall report
async function refreshOverallReport(){
  const filters = {
    from: fFromOverall.value || null,
    to: fToOverall.value || null,
    memberId: fMemberOverall.value || null,
    category: fCategoryOverall.value || null,
    paymentMethod: fPaymentOverall.value || null,
  };
  const [members, txs] = await Promise.all([DB.members(), DB.listTx(filters)]);
  const nameById = Object.fromEntries(members.map(m=>[m.id,m.name]));

  const totalsByMember = new Map();
  const totalsByCategory = new Map();
  let grand = 0;
  for(const t of txs){
    grand += Number(t.amount);
    totalsByMember.set(t.memberId, (totalsByMember.get(t.memberId)||0) + Number(t.amount));
    totalsByCategory.set(t.category, (totalsByCategory.get(t.category)||0) + Number(t.amount));
  }
  totalsOverall.innerHTML = '';
  const addCard=(parent,title,value)=>{
    const el=document.createElement('div');
    el.className='card';
    el.innerHTML=`<div class="kicker">${title}</div><div class="strong">${fmtINR(value)}</div>`;
    parent.appendChild(el);
  };
  addCard(totalsOverall,'Total', grand);
  for(const [mid,sum] of totalsByMember){ addCard(totalsOverall, nameById[mid]||'Unknown', sum); }
  for(const [cat,sum] of totalsByCategory){ addCard(totalsOverall, `#${cat}`, sum); }
}

// Detailed report
async function refreshDetailedReport(){
  const filters = {
    from: fFromDetailed.value || null,
    to: fToDetailed.value || null,
    memberId: fMemberDetailed.value || null,
    category: fCategoryDetailed.value || null,
    paymentMethod: fPaymentDetailed.value || null,
  };
  const [members, txs] = await Promise.all([DB.members(), DB.listTx(filters)]);
  const nameById = Object.fromEntries(members.map(m=>[m.id,m.name]));

  txBody.innerHTML='';
  for(const t of txs){
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${nameById[t.memberId]||'—'}</td>
      <td><span class="badge">${t.category}</span></td>
      <td>${t.paymentMethod}</td>
      <td class="right">${fmtINR(t.amount)}</td>
      <td>${t.note||''}</td>
      <td class="right"><button class="icon-btn" data-del="${t.id}">🗑️</button></td>`;
    txBody.appendChild(tr);
  }
}

await refreshMembers();
await refreshCategories();
await refreshOverallReport();
await refreshDetailedReport();

// Event bindings
qs('#form-member').addEventListener('submit', async (e)=>{
  e.preventDefault(); const name = memberName.value.trim(); if(!name) return;
  try{ await DB.addMember(name); memberName.value=''; await refreshMembers(); await refreshOverallReport(); await refreshDetailedReport(); }
  catch(err){ alert('Member exists or error: '+err.message); }
});

categoryList.addEventListener('click', async (e)=>{
  const id = e.target?.dataset?.id; if(!id) return;
  if(confirm('Delete this category?')){ await DB.removeCategory(id); await refreshCategories(); await refreshOverallReport(); await refreshDetailedReport(); }
});

qs('#form-category').addEventListener('submit', async (e)=>{
  e.preventDefault(); const name = categoryName.value.trim(); if(!name) return;
  try{ await DB.addCategory(name); categoryName.value=''; await refreshCategories(); await refreshOverallReport(); await refreshDetailedReport(); }
  catch(err){ alert('Category exists or error: '+err.message); }
});

qs('#form-expense').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data={ date: expDate.value, memberId: expMember.value, amount: Number(expAmount.value), category: expCategory.value, paymentMethod: expPayment.value, note: expNote.value.trim() };
  if(!data.date || !data.memberId || !data.amount || !data.category || !data.paymentMethod){ alert('Please fill all required fields'); return; }
  await DB.addTx(data);
  expAmount.value=''; expNote.value='';
  await refreshOverallReport(); await refreshDetailedReport();
});

// Filters
btnApplyOverall.addEventListener('click', refreshOverallReport);
btnResetOverall.addEventListener('click', ()=>{ fFromOverall.value=''; fToOverall.value=''; fMemberOverall.value=''; fCategoryOverall.value=''; fPaymentOverall.value=''; refreshOverallReport(); });

btnApplyDetailed.addEventListener('click', refreshDetailedReport);
btnResetDetailed.addEventListener('click', ()=>{ fFromDetailed.value=''; fToDetailed.value=''; fMemberDetailed.value=''; fCategoryDetailed.value=''; fPaymentDetailed.value=''; refreshDetailedReport(); });

// Delete tx
txBody.addEventListener('click', async (e)=>{
  const id = e.target?.dataset?.del; if(!id) return;
  if(confirm('Delete this expense?')){ await DB.deleteTx(id); await refreshOverallReport(); await refreshDetailedReport(); }
});

// Export / Import remain same
qs('#btn-export').addEventListener('click', async ()=>{
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const a=document.createElement('a'); const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  a.href = URL.createObjectURL(blob); a.download = `family-spending-backup-${stamp}.json`; a.click(); URL.revokeObjectURL(a.href);
});

qs('#input-import').addEventListener('change', async (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const text = await file.text();
  try{
    const json = JSON.parse(text);
    const { added, skipped } = await DB.importAll(json);
    alert(`Import done. Added: ${added}, Skipped: ${skipped}`);
    await refreshMembers(); await refreshCategories(); await refreshOverallReport(); await refreshDetailedReport();
  }catch(err){ alert('Import failed: '+err.message); }
  e.target.value='';
});

})();
