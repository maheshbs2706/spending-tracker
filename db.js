(function(){
  const DB_NAME = 'family-spending-db';
  const DB_VERSION = 1;
  const ST = { MEMBERS:'members', TX:'transactions', CATS:'categories', SETTINGS:'settings' };

  function openDb(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e)=>{
        const db = e.target.result;
        if(!db.objectStoreNames.contains(ST.MEMBERS)){
          const s = db.createObjectStore(ST.MEMBERS,{ keyPath:'id' });
          s.createIndex('by_name','name',{ unique:true });
        }
        if(!db.objectStoreNames.contains(ST.TX)){
          const s = db.createObjectStore(ST.TX,{ keyPath:'id' });
          s.createIndex('by_date','date');
          s.createIndex('by_member','memberId');
          s.createIndex('by_category','category');
          s.createIndex('by_payment','paymentMethod');
        }
        if(!db.objectStoreNames.contains(ST.CATS)){
          const s = db.createObjectStore(ST.CATS,{ keyPath:'id' });
          s.createIndex('by_name','name',{ unique:true });
        }
        if(!db.objectStoreNames.contains(ST.SETTINGS)){
          db.createObjectStore(ST.SETTINGS,{ keyPath:'key' });
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function tx(storeNames, mode='readonly'){
    const db = await openDb();
    return db.transaction(storeNames, mode);
  }

  function uuid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now(); }

  // Generic helpers
  const put = (store, value)=> new Promise((res,rej)=>{ const r = store.put(value); r.onsuccess=()=>res(value); r.onerror=()=>rej(r.error); });
  const add = (store, value)=> new Promise((res,rej)=>{ const r = store.add(value); r.onsuccess=()=>res(value); r.onerror=()=>rej(r.error); });
  const getAll = (store, indexName, range)=> new Promise((res,rej)=>{
    let r; const out=[];
    if(indexName){ r = store.index(indexName).openCursor(range); }
    else { r = store.openCursor(); }
    r.onsuccess = (e)=>{ const c = e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
    r.onerror = ()=> rej(r.error);
  });
  const get = (store, key)=> new Promise((res,rej)=>{ const r=store.get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const del = (store, key)=> new Promise((res,rej)=>{ const r=store.delete(key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });

  // API
  const api = {
    async seed(){
      const t = await tx([ST.CATS, ST.SETTINGS],'readwrite');
      const cats = t.objectStore(ST.CATS);
      const settings = t.objectStore(ST.SETTINGS);
      const seeded = await get(settings, 'seeded');
      if(!seeded){
        const defaults = ['Grocery','Online','Fuel','Rent','Medical','Education','EMI','Travel','Dining','Utilities'];
        for(const name of defaults){ await add(cats,{ id:uuid(), name, type:'expense' }); }
        await put(settings,{ key:'seeded', value:true });
      }
      return new Promise((res)=> t.oncomplete = res);
    },
    async members(){ const t = await tx([ST.MEMBERS]); return getAll(t.objectStore(ST.MEMBERS)); },
    async addMember(name){ const t = await tx([ST.MEMBERS],'readwrite'); const s=t.objectStore(ST.MEMBERS); const m={ id:uuid(), name:name.trim(), active:true, createdAt:new Date().toISOString() }; await add(s,m); return m; },
    async removeMember(id){ const t=await tx([ST.MEMBERS],'readwrite'); await del(t.objectStore(ST.MEMBERS), id); },
    async categories(){ const t=await tx([ST.CATS]); return getAll(t.objectStore(ST.CATS)); },
    async addCategory(name){ const t=await tx([ST.CATS],'readwrite'); const c={ id:uuid(), name:name.trim(), type:'expense' }; await add(t.objectStore(ST.CATS), c); return c; },
    async removeCategory(id){ const t=await tx([ST.CATS],'readwrite'); await del(t.objectStore(ST.CATS), id); },
    async addTx(data){ const t=await tx([ST.TX],'readwrite'); const now=new Date().toISOString(); const txo={ id:uuid(), createdAt:now, updatedAt:now, ...data }; await add(t.objectStore(ST.TX), txo); return txo; },
    async deleteTx(id){ const t=await tx([ST.TX],'readwrite'); await del(t.objectStore(ST.TX), id); },
    async listTx(filters={}){
      const t=await tx([ST.TX]); const s=t.objectStore(ST.TX); const all=await getAll(s);
      return all.filter(x=>{
        if(filters.from && x.date < filters.from) return false;
        if(filters.to && x.date > filters.to) return false;
        if(filters.memberId && x.memberId!==filters.memberId) return false;
        if(filters.category && x.category!==filters.category) return false;
        if(filters.paymentMethod && x.paymentMethod!==filters.paymentMethod) return false;
        return true;
      }).sort((a,b)=> a.date===b.date ? (a.createdAt.localeCompare(b.createdAt)) : (a.date.localeCompare(b.date)));
    },
    async exportAll(){
      const t=await tx([ST.MEMBERS,ST.TX,ST.CATS,ST.SETTINGS]);
      const members=await getAll(t.objectStore(ST.MEMBERS));
      const txs=await getAll(t.objectStore(ST.TX));
      const cats=await getAll(t.objectStore(ST.CATS));
      const meta={ app:"family-spending", schema:1, exportedAt:new Date().toISOString() };
      return { meta, members, transactions:txs, categories:cats };
    },
    async importAll(payload){
      if(!payload || !payload.meta || payload.meta.app!=="family-spending") throw new Error('Invalid backup file');
      const t=await tx([ST.MEMBERS,ST.TX,ST.CATS],'readwrite');
      const sm=t.objectStore(ST.MEMBERS); const st=t.objectStore(ST.TX); const sc=t.objectStore(ST.CATS);
      const existingMembers = await getAll(sm);
      const existingTx = await getAll(st);
      const existingCats = await getAll(sc);
      const memIds=new Set(existingMembers.map(x=>x.id));
      const txIds=new Set(existingTx.map(x=>x.id));
      const catNames=new Set(existingCats.map(x=>(x.name||'').toLowerCase()));
      let added=0, skipped=0;
      for(const m of (payload.members||[])){
        if(memIds.has(m.id)) { skipped++; continue; }
        await put(sm, m); memIds.add(m.id); added++;
      }
      for(const c of (payload.categories||[])){
        if(catNames.has((c.name||'').toLowerCase())){ skipped++; continue; }
        await put(sc, c); catNames.add(c.name.toLowerCase()); added++;
      }
      for(const x of (payload.transactions||[])){
        if(txIds.has(x.id)) { skipped++; continue; }
        await put(st, x); txIds.add(x.id); added++;
      }
      return { added, skipped };
    }
  };

  window.DB = api;
})();