// ── IndexedDB (photos) ──
const ImageDB = (() => {
  const DB = 'hanju-note-img', ST = 'images';
  let db = null;
  function open() {
    return new Promise((res, rej) => {
      if (db) return res(db);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(ST);
      req.onsuccess = e => { db = e.target.result; res(db); };
      req.onerror = rej;
    });
  }
  async function tx(mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(ST, mode), s = t.objectStore(ST);
      const req = fn(s);
      if (req) { req.onsuccess = () => res(req.result); req.onerror = rej; }
      else { t.oncomplete = () => res(); t.onerror = rej; }
    });
  }
  return {
    get: key => tx('readonly', s => s.get(key)),
    set: (key, val) => tx('readwrite', s => { s.put(val, key); return null; }),
    del: key => tx('readwrite', s => { s.delete(key); return null; }),
    async getAll() {
      const d = await open();
      return new Promise((res, rej) => {
        const result = {};
        const t = d.transaction(ST, 'readonly');
        t.objectStore(ST).openCursor().onsuccess = e => {
          const cur = e.target.result;
          if (cur) { result[cur.key] = cur.value; cur.continue(); }
          else res(result);
        };
        t.onerror = rej;
      });
    }
  };
})();

// ── localStorage wrapper ──
const Storage = {
  _k: k => 'hanju-note:' + k,

  getNotes()          { try { return JSON.parse(localStorage.getItem(this._k('notes')) || '[]'); } catch { return []; } },
  saveNotes(v)        { localStorage.setItem(this._k('notes'), JSON.stringify(v)); },
  getNote(id)         { return this.getNotes().find(n => n.id === id) || null; },
  addNote(n)          { const a = this.getNotes(); a.unshift(n); this.saveNotes(a); },
  updateNote(n)       { const a = this.getNotes(), i = a.findIndex(x => x.id === n.id); if (i >= 0) a[i] = n; this.saveNotes(a); },
  deleteNote(id)      { this.saveNotes(this.getNotes().filter(n => n.id !== id)); },

  getWishlist()       { try { return JSON.parse(localStorage.getItem(this._k('wishlist')) || '[]'); } catch { return []; } },
  saveWishlist(v)     { localStorage.setItem(this._k('wishlist'), JSON.stringify(v)); },

  getSetting(k, def = null) { const v = localStorage.getItem(this._k('s:' + k)); return v !== null ? JSON.parse(v) : def; },
  setSetting(k, v)    { localStorage.setItem(this._k('s:' + k), JSON.stringify(v)); },
};
