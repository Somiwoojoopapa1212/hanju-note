// ── PWA 설치 ──
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  document.getElementById('install-btn').style.display = 'flex';
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  document.getElementById('install-btn').style.display = 'none';
});
function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall.userChoice.then(r => {
    if (r.outcome === 'accepted') document.getElementById('install-btn').style.display = 'none';
    deferredInstall = null;
  });
}

// ── 상수 ──
const FLAVORS = [
  { key:'sweet',  label:'달콤',   emoji:'🍯' },
  { key:'acidic', label:'산미',   emoji:'🍋' },
  { key:'umami',  label:'감칠맛', emoji:'🌊' },
  { key:'grain',  label:'곡물·쌀', emoji:'🌾' },
  { key:'fruity', label:'과일향', emoji:'🍊' },
  { key:'floral', label:'꽃향',   emoji:'🌸' },
];

const DRINK_TYPES = [
  // 한국 전통주
  { value:'makgeolli',       label:'막걸리',        cat:'korean' },
  { value:'dongdongju',      label:'동동주',        cat:'korean' },
  { value:'cheongju',        label:'청주 (한국)',    cat:'korean' },
  { value:'yakju',           label:'약주',          cat:'korean' },
  { value:'soju_diluted',    label:'희석식 소주',   cat:'korean' },
  { value:'soju_distilled',  label:'증류식 소주',   cat:'korean' },
  { value:'bori_soju',       label:'보리소주',      cat:'korean' },
  { value:'fruit_wine',      label:'과실주 (한국)', cat:'korean' },
  // 일본주
  { value:'junmai',          label:'준마이 (純米)',      cat:'japanese' },
  { value:'ginjo',           label:'긴조 (吟醸)',        cat:'japanese' },
  { value:'daiginjo',        label:'다이긴조 (大吟醸)',  cat:'japanese' },
  { value:'honjozo',         label:'혼조조 (本醸造)',    cat:'japanese' },
  { value:'namazake',        label:'나마자케 (生酒)',    cat:'japanese' },
  { value:'nigori',          label:'니고리자케 (にごり)',cat:'japanese' },
  { value:'shochu_jp',       label:'소주 焼酎 (일본)',   cat:'japanese' },
  { value:'umeshu',          label:'우메슈 (梅酒)',      cat:'japanese' },
  // 기타
  { value:'custom',          label:'기타 (직접 입력)',   cat:'other' },
];

const TYPE_MAP = Object.fromEntries(DRINK_TYPES.map(t => [t.value, t]));

const REGIONS = [
  { value:'seoul_gyeonggi', label:'서울·경기', cat:'korean' },
  { value:'jeolla',         label:'전라도',    cat:'korean' },
  { value:'chungcheong',    label:'충청도',    cat:'korean' },
  { value:'gyeongsang',     label:'경상도',    cat:'korean' },
  { value:'gangwon',        label:'강원도',    cat:'korean' },
  { value:'jeju',           label:'제주',      cat:'korean' },
  { value:'niigata',        label:'니가타 (新潟)', cat:'japanese' },
  { value:'kyoto',          label:'교토 (京都)', cat:'japanese' },
  { value:'hyogo',          label:'효고 (兵庫)', cat:'japanese' },
  { value:'akita',          label:'아키타 (秋田)', cat:'japanese' },
  { value:'yamagata',       label:'야마가타 (山形)', cat:'japanese' },
  { value:'ishikawa',       label:'이시카와 (石川)', cat:'japanese' },
  { value:'other_region',   label:'기타', cat:'other' },
];

const COLORS = [
  '무색 투명','연한 황색','황금빛','유백색 (약탁)','탁백색 (막걸리/니고리)',
  '연한 녹황색','연분홍','기타',
];
const CLARITY = ['맑음 (투명)','약간 탁함','탁함','불투명'];
const SERVING_TEMPS = [
  { value:'cold',    label:'차갑게 冷 (5~10°C)' },
  { value:'room',    label:'상온 常温' },
  { value:'warm',    label:'살짝 데워서 ぬる燗 (~40°C)' },
  { value:'hot',     label:'따뜻하게 熱燗 (50°C+)' },
];

// ── 상태 ──
let currentPage = 'tasting';
let editingNoteId = null;
let editingWlId = null;
let statsPeriod = 'all';
let statsFrom = '', statsTo = '';
let filterCat = 'all';
let _communityLoaded = false;

let _pendingImgUrl = null, _deleteImgOnSave = false;
let _cropCallback = null;
let _cropX = 0, _cropY = 0, _cropScale = 1, _cropDragging = false, _cropLx = 0, _cropLy = 0;

// ── 유틸 ──
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function showToast(msg, dur = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function typeBadgeClass(typeVal) {
  const t = TYPE_MAP[typeVal];
  if (!t) return 'other';
  return t.cat;
}
function typeLabel(note) {
  if (note.type === 'custom') return note.typeCustom || '기타';
  return TYPE_MAP[note.type]?.label || note.type;
}

// ── 레이더 차트 ──
function drawRadarChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const pad = opts.padding || 34;
  const r = Math.min(cx, cy) - pad;
  const n = FLAVORS.length, max = 5;
  const vals = FLAVORS.map(f => data?.[f.key] || 0);
  const ang = i => (Math.PI*2*i)/n - Math.PI/2;
  const pt  = (i, radius) => ({ x: cx + radius*Math.cos(ang(i)), y: cy + radius*Math.sin(ang(i)) });

  ctx.clearRect(0, 0, W, H);
  if (opts.bgColor) { ctx.fillStyle = opts.bgColor; ctx.fillRect(0, 0, W, H); }

  for (let ring = 1; ring <= max; ring++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pt(i, r*ring/max);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = ring === max ? 'rgba(74,139,196,0.35)' : 'rgba(74,139,196,0.15)';
    ctx.lineWidth = ring === max ? 1.5 : 0.8;
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const p = pt(i, r);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'rgba(74,139,196,0.18)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  if (vals.some(v => v > 0)) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pt(i, r*vals[i]/max);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle   = opts.fillColor || 'rgba(74,139,196,0.18)';
    ctx.fill();
    ctx.strokeStyle = opts.lineColor || 'rgba(74,139,196,0.85)';
    ctx.lineWidth   = opts.lineWidth || 2;
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      if (vals[i] > 0) {
        const p = pt(i, r*vals[i]/max);
        ctx.beginPath(); ctx.arc(p.x, p.y, opts.dotRadius || 3, 0, Math.PI*2);
        ctx.fillStyle = opts.dotColor || '#4a8bc4'; ctx.fill();
      }
    }
  }
  if (opts.showLabels !== false) {
    const lpad = opts.labelPad || 20;
    ctx.font = `${opts.fontSize || 11}px -apple-system,sans-serif`;
    ctx.fillStyle = opts.labelColor || '#6a8aaa';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const p = pt(i, r + lpad);
      ctx.fillText(FLAVORS[i].label, p.x, p.y);
    }
  }
}

function getFlavorData() {
  const d = {};
  FLAVORS.forEach(f => { const el = document.getElementById('fl-' + f.key); d[f.key] = el ? +el.value : 0; });
  return d;
}
function setFlavorData(data) {
  FLAVORS.forEach(f => {
    const el = document.getElementById('fl-' + f.key);
    const ve = document.getElementById('fv-' + f.key);
    const v = data?.[f.key] || 0;
    if (el) el.value = v;
    if (ve) ve.textContent = v;
  });
  updateFlavorPreview();
}
function updateFlavorPreview() {
  FLAVORS.forEach(f => {
    const el = document.getElementById('fl-' + f.key);
    const ve = document.getElementById('fv-' + f.key);
    if (el && ve) ve.textContent = el.value;
  });
  const c = document.getElementById('flavor-preview-canvas');
  if (c) drawRadarChart(c, getFlavorData(), { padding: 38, fontSize: 11, labelPad: 20 });
}

// ── 점수 슬라이더 ──
function activateSlider(el, labelId) {
  el.dataset.set = 'true';
  el.classList.remove('score-unset');
  document.getElementById(labelId).textContent = el.value;
}
function resetSlider(sliderId, labelId) {
  const el = document.getElementById(sliderId);
  el.dataset.set = 'false'; el.value = 75;
  el.classList.add('score-unset');
  document.getElementById(labelId).textContent = '—';
}
function getScore(sliderId) {
  const el = document.getElementById(sliderId);
  return el?.dataset?.set === 'true' ? +el.value : null;
}
function setScore(sliderId, labelId, val) {
  const el = document.getElementById(sliderId);
  if (val !== null && val !== undefined) {
    el.value = val; el.dataset.set = 'true'; el.classList.remove('score-unset');
    document.getElementById(labelId).textContent = val;
  } else {
    resetSlider(sliderId, labelId);
  }
}

// ── 다크 모드 ──
function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDarkMode(saved !== null ? saved === 'true' : prefersDark);
}
function applyDarkMode(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  const label = document.getElementById('darkmode-label');
  const moreLabel = document.getElementById('darkmode-more-label');
  if (label) label.textContent = isDark ? '라이트 모드' : '다크 모드';
  if (moreLabel) moreLabel.textContent = isDark ? '라이트 모드' : '다크 모드';
}
function toggleDarkMode() {
  const isDark = !document.documentElement.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  applyDarkMode(isDark);
}

// ── FAB ──
function updateFab(page) {
  const fab = document.getElementById('fab-add');
  if (!fab) return;
  fab.classList.toggle('fab-hidden', page === 'stats');
}
function fabAction() {
  if (currentPage === 'tasting') openAddNote();
  else if (currentPage === 'wishlist') openAddWishlist();
}

// ── 페이지 전환 ──
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.bottom-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  document.getElementById('page-' + page)?.classList.add('active');
  if (page === 'tasting') renderNoteList();
  if (page === 'stats') {
    _communityLoaded = false;
    showStatsView('mine');
    renderStats();
  }
  if (page === 'wishlist') renderWishlist();
  updateFab(page);
}

function showStatsView(view) {
  document.querySelectorAll('.stats-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('stats-view-mine').style.display      = view === 'mine'      ? '' : 'none';
  document.getElementById('stats-view-community').style.display = view === 'community' ? '' : 'none';
  if (view === 'community' && !_communityLoaded) {
    _communityLoaded = true;
    _loadCommunityInline();
  }
}

async function _loadCommunityInline() {
  const content = document.getElementById('community-inline-content');
  content.innerHTML = '<p class="loading-hint">⏳ 데이터를 불러오는 중...</p>';
  try {
    await _authReady;
    const snapshot = await db.collection('hanju_tastings').limit(1000).get();
    const tastings = snapshot.docs.map(doc => doc.data());
    renderCommunityStats(tastings, content);
  } catch (err) {
    content.innerHTML = '<p class="loading-hint">데이터를 불러올 수 없습니다.<br>인터넷 연결을 확인해주세요.</p>';
  }
}

function renderCommunityStats(tastings, content) {
  if (!content) content = document.getElementById('community-inline-content');
  if (tastings.length === 0) {
    content.innerHTML = '<p class="loading-hint">아직 공유된 시음 기록이 없습니다.<br>데이터 공유에 동의하면 통계에 기여됩니다 🍶</p>';
    return;
  }

  const total = tastings.length;
  const scores = tastings.filter(t => t.score != null && t.score !== '').map(t => parseFloat(t.score));
  const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
  const uniqueDrinks = new Set(tastings.map(t => t.drinkName).filter(Boolean)).size;

  const typeCount = {}, regionCount = {}, drinkCount = {};
  tastings.forEach(t => {
    const tp = t.type || '미입력';
    typeCount[tp] = (typeCount[tp] || 0) + 1;
    const r = t.region || '미입력';
    regionCount[r] = (regionCount[r] || 0) + 1;
    if (t.drinkName) drinkCount[t.drinkName] = (drinkCount[t.drinkName] || 0) + 1;
  });

  const topDrinks = Object.entries(drinkCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);

  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  const avgNose   = avg(tastings.filter(t=>t.noseScore   !=null&&t.noseScore   !=='').map(t=>parseFloat(t.noseScore)));
  const avgPalate = avg(tastings.filter(t=>t.palateScore !=null&&t.palateScore !=='').map(t=>parseFloat(t.palateScore)));
  const avgFinish = avg(tastings.filter(t=>t.finishScore !=null&&t.finishScore !=='').map(t=>parseFloat(t.finishScore)));

  const makeNameList = (countMap, order) => {
    const entries = order
      ? order.filter(k=>countMap[k]).map(k=>[k,countMap[k]])
      : Object.entries(countMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
    if (!entries.length) return '<p style="color:var(--text-muted);font-size:13px">데이터 없음</p>';
    return '<div class="community-name-list">' +
      entries.map(([label,count],i)=>`
        <div class="community-name-row">
          <span class="community-name-rank">${i+1}</span>
          <span class="community-name-text">${label}</span>
          <span class="community-name-count">${count}회</span>
        </div>`).join('') + '</div>';
  };

  const makeScoreChart = items => {
    if (!items.length) return '';
    return '<div class="community-score-chart">' +
      items.map(([label,score])=>`
        <div class="community-score-row">
          <span class="community-score-label">${label}</span>
          <div class="community-score-track"><div class="community-score-fill" style="width:${score}%"></div></div>
          <span class="community-score-val">${score}점</span>
        </div>`).join('') + '</div>';
  };

  const scoreItems = [
    avgNose   !== null ? ['향',    avgNose]   : null,
    avgPalate !== null ? ['맛',    avgPalate] : null,
    avgFinish !== null ? ['여운',  avgFinish] : null,
    avgScore  !== null ? ['종합',  avgScore]  : null,
  ].filter(Boolean);

  content.innerHTML = `
    <div class="community-header">
      <div class="community-stat-card"><div class="community-stat-num">${total}</div><div class="community-stat-label">총 시음 기록</div></div>
      <div class="community-stat-card"><div class="community-stat-num">${uniqueDrinks}</div><div class="community-stat-label">술 종류</div></div>
      <div class="community-stat-card"><div class="community-stat-num">${avgScore !== null ? avgScore+'점' : '—'}</div><div class="community-stat-label">평균 점수</div></div>
    </div>
    ${topDrinks.length ? `<div class="community-section-title">🏆 인기 술 TOP ${topDrinks.length}</div>${makeNameList(drinkCount, topDrinks)}` : ''}
    <div class="community-section-title">📍 지역별 분포</div>${makeNameList(regionCount, null)}
    <div class="community-section-title">🏷️ 종류별 분포</div>${makeNameList(typeCount, null)}
    ${scoreItems.length ? `<div class="community-section-title">⭐ 평균 점수 분석</div>${makeScoreChart(scoreItems)}` : ''}
    <p style="font-size:11px;color:var(--text-muted);margin-top:24px;text-align:center;line-height:1.6;">
      💡 데이터 공유에 동의한 사용자들의 익명 시음 기록입니다
    </p>
  `;
}

// ── 동의 배너 ──
function setConsent(agreed) {
  Storage.setSetting('cloudConsent', agreed);
  document.getElementById('consent-banner').style.display = 'none';
  if (agreed) showToast('감사합니다! 통계에 기여됩니다 🍶');
}
function checkConsentBanner() {
  const val = Storage.getSetting('cloudConsent');
  if (val === null) document.getElementById('consent-banner').style.display = '';
}

// ── 타입 변경 핸들러 ──
function handleTypeChange() {
  const val = document.getElementById('note-type').value;
  document.getElementById('type-custom-group').style.display = val === 'custom' ? '' : 'none';
}

// ════ 시음 노트 ════
function renderNoteList() {
  let notes = Storage.getNotes();

  if (filterCat !== 'all') {
    notes = notes.filter(n => {
      const t = TYPE_MAP[n.type];
      if (!t) return filterCat === 'other';
      return t.cat === filterCat;
    });
  }

  document.getElementById('tasting-subtitle').textContent =
    `총 ${notes.length}개의 시음 기록`;

  const grid = document.getElementById('note-list');
  const empty = document.getElementById('tasting-empty');

  if (notes.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = notes.map(n => noteCardHTML(n)).join('');
  notes.forEach(n => {
    const thumbEl = document.getElementById(`thumb-${n.id}`);
    if (thumbEl) {
      ImageDB.get('note_' + n.id).then(img => {
        if (img) { thumbEl.innerHTML = `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`; }
      });
    }
  });
}

function noteCardHTML(n) {
  const tl = typeLabel(n);
  const tcat = n.type === 'custom' ? 'other' : (TYPE_MAP[n.type]?.cat || 'other');
  const hasFlavors = n.flavors && Object.values(n.flavors).some(v => v > 0);
  const hasDetail = n.nose || n.palate || n.finish || n.noseScore !== null || hasFlavors;
  return `
  <div class="note-card" id="note-card-${n.id}">
    <div class="note-card-header" onclick="toggleNoteCard('${n.id}')">
      <div class="note-thumb" id="thumb-${n.id}">
        <span class="note-thumb-ph">🍶</span>
      </div>
      <div class="note-header-info">
        <div class="note-name">${n.name}</div>
        <div class="note-meta">
          <span class="type-badge ${tcat}">${tl}</span>
          ${n.brewery ? `<span class="note-brewery">${n.brewery}</span>` : ''}
          <span class="note-date">${n.date || ''}</span>
        </div>
      </div>
      <div class="note-header-right">
        ${n.score !== null && n.score !== undefined ? `<div class="score-circle">${n.score}</div>` : ''}
        ${hasDetail ? `<span class="note-chevron">▾</span>` : ''}
      </div>
    </div>
    ${hasDetail ? `
    <div class="note-expand" id="note-expand-${n.id}">
      <div class="note-expand-top">
        <div class="note-detail-grid">
          ${n.region ? `<div class="note-detail-item"><div class="detail-label">지역</div><div class="detail-value">${regionLabel(n.region)}</div></div>` : ''}
          ${n.abv ? `<div class="note-detail-item"><div class="detail-label">도수</div><div class="detail-value">${n.abv}%</div></div>` : ''}
          ${n.servingTemp ? `<div class="note-detail-item"><div class="detail-label">음용온도</div><div class="detail-value">${SERVING_TEMPS.find(t=>t.value===n.servingTemp)?.label||n.servingTemp}</div></div>` : ''}
          ${n.color ? `<div class="note-detail-item"><div class="detail-label">색깔</div><div class="detail-value">${n.color}</div></div>` : ''}
          ${n.clarity ? `<div class="note-detail-item"><div class="detail-label">투명도</div><div class="detail-value">${n.clarity}</div></div>` : ''}
          ${n.polishingRatio ? `<div class="note-detail-item"><div class="detail-label">정미율</div><div class="detail-value">${n.polishingRatio}%</div></div>` : ''}
          ${n.amount ? `<div class="note-detail-item"><div class="detail-label">시음량</div><div class="detail-value">${n.amount}ml</div></div>` : ''}
          ${n.price ? `<div class="note-detail-item"><div class="detail-label">가격</div><div class="detail-value">₩${Number(n.price).toLocaleString()}</div></div>` : ''}
        </div>
      </div>
      ${n.noseScore||n.palateScore||n.finishScore ? `<div class="note-score-row">
        ${n.noseScore!==null&&n.noseScore!==undefined?`<span class="score-badge nose">향 ${n.noseScore}</span>`:''}
        ${n.palateScore!==null&&n.palateScore!==undefined?`<span class="score-badge palate">맛 ${n.palateScore}</span>`:''}
        ${n.finishScore!==null&&n.finishScore!==undefined?`<span class="score-badge finish">여운 ${n.finishScore}</span>`:''}
      </div>` : ''}
      ${n.nose?`<div class="note-text-section"><div class="note-text-label">향 Nose</div><div class="note-text-body">${n.nose}</div></div>`:''}
      ${n.palate?`<div class="note-text-section"><div class="note-text-label">맛 Palate</div><div class="note-text-body">${n.palate}</div></div>`:''}
      ${n.finish?`<div class="note-text-section"><div class="note-text-label">여운 Finish</div><div class="note-text-body">${n.finish}</div></div>`:''}
      ${n.notes?`<div class="note-text-section"><div class="note-text-label">메모</div><div class="note-text-body">${n.notes}</div></div>`:''}
      ${hasFlavors?`<div class="note-radar-wrap"><canvas id="nc-radar-${n.id}" width="180" height="180"></canvas></div>`:''}
      <div class="note-actions">
        <button class="btn btn-sm btn-outline" onclick="openEditNote('${n.id}')">수정</button>
        <button class="btn btn-sm btn-outline" onclick="generateShareCard('${n.id}')">공유 카드</button>
        <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:rgba(224,84,84,0.4)" onclick="deleteNote('${n.id}')">삭제</button>
      </div>
    </div>` : ''}
  </div>`;
}

function regionLabel(val) {
  return REGIONS.find(r => r.value === val)?.label || val;
}

function toggleNoteCard(id) {
  const card = document.getElementById(`note-card-${id}`);
  const detail = document.getElementById(`note-expand-${id}`);
  if (!card || !detail) return;
  const opening = !card.classList.contains('expanded');
  card.classList.toggle('expanded', opening);
  detail.style.display = opening ? 'flex' : 'none';
  if (opening) {
    const n = Storage.getNote(id);
    if (n?.flavors && Object.values(n.flavors).some(v => v > 0)) {
      const c = document.getElementById(`nc-radar-${id}`);
      if (c && !c.dataset.rendered) {
        drawRadarChart(c, n.flavors, { padding: 28, fontSize: 11, labelPad: 18, lineWidth: 1.5, dotRadius: 3 });
        c.dataset.rendered = 'true';
      }
    }
  }
}

// ── 노트 추가/수정 모달 ──
function openAddNote() {
  editingNoteId = null;
  document.getElementById('modal-note-title').textContent = '시음 기록 추가';
  clearNoteForm();
  clearNoteImg();
  setVal('note-date', new Date().toISOString().split('T')[0]);
  openModal('modal-note');
}

function openEditNote(id) {
  const n = Storage.getNote(id);
  if (!n) return;
  editingNoteId = id;
  document.getElementById('modal-note-title').textContent = '시음 기록 수정';
  clearNoteForm();

  setVal('note-name', n.name);
  setVal('note-type', n.type);
  handleTypeChange();
  if (n.type === 'custom') setVal('note-type-custom', n.typeCustom || '');
  setVal('note-brewery', n.brewery);
  setVal('note-region', n.region);
  setVal('note-abv', n.abv);
  setVal('note-polishing', n.polishingRatio);
  setVal('note-base', n.baseIngredient);
  setVal('note-date', n.date);
  setVal('note-amount', n.amount);
  setVal('note-serving-temp', n.servingTemp);
  setVal('note-color', n.color);
  setVal('note-clarity', n.clarity);
  setVal('note-nose', n.nose);
  setVal('note-palate', n.palate);
  setVal('note-finish', n.finish);
  setVal('note-pairing', n.pairing);
  setVal('note-notes', n.notes);
  setVal('note-price', n.price);
  setScore('note-nose-score', 'val-nose-score', n.noseScore);
  setScore('note-palate-score', 'val-palate-score', n.palateScore);
  setScore('note-finish-score', 'val-finish-score', n.finishScore);
  setScore('note-score', 'val-total-score', n.score);
  setFlavorData(n.flavors);

  ImageDB.get('note_' + id).then(img => {
    if (img) { showNoteImgPreview(img); }
  });
  openModal('modal-note');
}

function clearNoteForm() {
  ['note-name','note-brewery','note-abv','note-polishing','note-base',
   'note-amount','note-pairing','note-notes','note-price',
   'note-nose','note-palate','note-finish','note-type-custom'].forEach(id => setVal(id, ''));
  setVal('note-type', 'makgeolli');
  setVal('note-region', '');
  setVal('note-serving-temp', '');
  setVal('note-color', '');
  setVal('note-clarity', '');
  ['note-nose-score','note-palate-score','note-finish-score','note-score'].forEach((sid, i) => {
    const labels = ['val-nose-score','val-palate-score','val-finish-score','val-total-score'];
    resetSlider(sid, labels[i]);
  });
  setFlavorData({});
  document.getElementById('type-custom-group').style.display = 'none';
  _pendingImgUrl = null; _deleteImgOnSave = false;
}

function clearNoteImg() {
  const preview = document.getElementById('note-img-preview');
  const ph = document.getElementById('note-img-ph');
  const rm = document.getElementById('note-img-remove-btn');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (ph) ph.style.display = '';
  if (rm) rm.style.display = 'none';
}
function showNoteImgPreview(url) {
  const preview = document.getElementById('note-img-preview');
  const ph = document.getElementById('note-img-ph');
  const rm = document.getElementById('note-img-remove-btn');
  if (preview) { preview.src = url; preview.style.display = 'block'; }
  if (ph) ph.style.display = 'none';
  if (rm) rm.style.display = '';
}
function removeNoteImg() {
  _pendingImgUrl = null; _deleteImgOnSave = true;
  clearNoteImg();
}

function handleNoteImageSelect(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => openCropModal(e.target.result, croppedUrl => {
    _pendingImgUrl = croppedUrl; showNoteImgPreview(croppedUrl);
  });
  reader.readAsDataURL(file);
  input.value = '';
}

async function saveNote() {
  const name = getVal('note-name');
  if (!name) { showToast('술 이름을 입력해주세요.'); return; }
  const type = getVal('note-type');
  if (type === 'custom' && !getVal('note-type-custom')) {
    showToast('종류를 직접 입력해주세요.'); return;
  }

  const note = {
    id: editingNoteId || uid(),
    createdAt: editingNoteId ? (Storage.getNote(editingNoteId)?.createdAt || Date.now()) : Date.now(),
    name, type,
    typeCustom: type === 'custom' ? getVal('note-type-custom') : '',
    brewery: getVal('note-brewery'),
    region: getVal('note-region'),
    abv: getVal('note-abv') ? +getVal('note-abv') : null,
    polishingRatio: getVal('note-polishing') ? +getVal('note-polishing') : null,
    baseIngredient: getVal('note-base'),
    date: getVal('note-date'),
    amount: getVal('note-amount') ? +getVal('note-amount') : null,
    servingTemp: getVal('note-serving-temp'),
    color: getVal('note-color'),
    clarity: getVal('note-clarity'),
    nose: getVal('note-nose'),
    noseScore: getScore('note-nose-score'),
    palate: getVal('note-palate'),
    palateScore: getScore('note-palate-score'),
    finish: getVal('note-finish'),
    finishScore: getScore('note-finish-score'),
    score: getScore('note-score'),
    flavors: getFlavorData(),
    pairing: getVal('note-pairing'),
    notes: getVal('note-notes'),
    price: getVal('note-price') ? +getVal('note-price') : null,
  };

  if (_pendingImgUrl) await ImageDB.set('note_' + note.id, _pendingImgUrl);
  else if (_deleteImgOnSave) await ImageDB.del('note_' + note.id);

  if (editingNoteId) Storage.updateNote(note);
  else { Storage.addNote(note); syncNoteToCloud(note); }

  closeModal('modal-note');
  showToast(editingNoteId ? '시음 기록이 수정됐습니다.' : '시음 기록이 저장됐습니다.');
  renderNoteList();
}

function deleteNote(id) {
  if (!confirm('이 시음 기록을 삭제할까요?')) return;
  Storage.deleteNote(id);
  ImageDB.del('note_' + id);
  showToast('삭제됐습니다.');
  renderNoteList();
}

// ── 공유 카드 ──
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

async function generateShareCard(noteId) {
  showToast('카드 생성 중...');
  const n = Storage.getNote(noteId); if (!n) return;
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = '#f0f7fd';
  ctx.fillRect(0, 0, S, S);

  // 상단 헤더 바
  const grad = ctx.createLinearGradient(0,0,S,0);
  grad.addColorStop(0, '#0c1d38'); grad.addColorStop(1, '#1a3a68');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, 180);

  // 술 이름
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 62px -apple-system,sans-serif';
  ctx.textAlign = 'left'; ctx.fillText(n.name.slice(0,22), 70, 90);

  // 부제
  const sub = [typeLabel(n), n.brewery, regionLabel(n.region)].filter(Boolean).join(' · ');
  ctx.fillStyle = 'rgba(168,212,248,0.75)'; ctx.font = '32px -apple-system,sans-serif';
  ctx.fillText(sub.slice(0,40), 70, 138);

  // 종합 점수
  if (n.score !== null && n.score !== undefined) {
    ctx.fillStyle = '#4a8bc4'; ctx.beginPath(); ctx.arc(S-90, 90, 58, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px -apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(n.score, S-90, 105);
    ctx.font = '22px -apple-system,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('점', S-90, 135);
  }

  let y = 220;
  ctx.textAlign = 'left';

  // 사진
  const photo = await ImageDB.get('note_' + noteId);
  if (photo) {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = photo;
    });
    ctx.save();
    _roundRect(ctx, 60, y, 320, 320, 16); ctx.clip();
    ctx.drawImage(img, 60, y, 320, 320);
    ctx.restore();

    // 텍스트 오른쪽
    let ty = y + 10;
    const rightX = 420;
    if (n.nose) {
      ctx.fillStyle = '#2c6ba3'; ctx.font = 'bold 24px -apple-system,sans-serif';
      ctx.fillText('향 Nose', rightX, ty); ty += 32;
      ctx.fillStyle = '#1a2a3a'; ctx.font = '22px -apple-system,sans-serif';
      const noseLines = wrapText(ctx, n.nose, S-rightX-60, 3);
      noseLines.forEach(l => { ctx.fillText(l, rightX, ty); ty += 30; }); ty += 10;
    }
    if (n.palate) {
      ctx.fillStyle = '#2c6ba3'; ctx.font = 'bold 24px -apple-system,sans-serif';
      ctx.fillText('맛 Palate', rightX, ty); ty += 32;
      ctx.fillStyle = '#1a2a3a'; ctx.font = '22px -apple-system,sans-serif';
      const lines = wrapText(ctx, n.palate, S-rightX-60, 3);
      lines.forEach(l => { ctx.fillText(l, rightX, ty); ty += 30; }); ty += 10;
    }
    y += 340;
  } else {
    // 텍스트 전체 너비
    ['nose','palate','finish'].forEach(key => {
      if (!n[key]) return;
      const lbl = key === 'nose' ? '향 Nose' : key === 'palate' ? '맛 Palate' : '여운 Finish';
      ctx.fillStyle = '#2c6ba3'; ctx.font = 'bold 26px -apple-system,sans-serif';
      ctx.fillText(lbl, 60, y); y += 36;
      ctx.fillStyle = '#1a2a3a'; ctx.font = '24px -apple-system,sans-serif';
      const lines = wrapText(ctx, n[key], S-120, 2);
      lines.forEach(l => { ctx.fillText(l, 60, y); y += 32; }); y += 16;
    });
  }

  // 향미 레이더
  if (n.flavors && Object.values(n.flavors).some(v => v > 0)) {
    const WH = 320;
    const wc = document.createElement('canvas'); wc.width = wc.height = WH;
    drawRadarChart(wc, n.flavors, {
      padding: 56, fontSize: 22, labelPad: 28, lineWidth: 3, dotRadius: 6,
      fillColor: 'rgba(74,139,196,0.2)', lineColor: 'rgba(74,139,196,0.9)',
      labelColor: 'rgba(74,139,196,0.85)',
    });
    ctx.drawImage(wc, (S-WH)/2, y); y += WH + 16;
  }

  // 하단
  ctx.fillStyle = '#0c1d38';
  ctx.fillRect(0, S-80, S, 80);
  ctx.fillStyle = 'rgba(168,212,248,0.6)'; ctx.font = '24px -apple-system,sans-serif';
  ctx.textAlign = 'left'; ctx.fillText(`${n.date || ''}  ·  주향 노트`, 60, S-30);

  const a = document.createElement('a');
  a.download = `hanju-note-${n.name}-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  showToast('카드가 저장됐습니다!');
}

function wrapText(ctx, text, maxW, maxLines = 2) {
  const words = text.split(/\s+/);
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

// ════ 통계 ════
function getFilteredNotes() {
  let notes = Storage.getNotes();
  if (statsPeriod === 'month') {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    notes = notes.filter(n => { const d = new Date(n.date); return d.getFullYear()===y && d.getMonth()===m; });
  } else if (statsPeriod === '3month') {
    const cut = new Date(); cut.setMonth(cut.getMonth()-3);
    notes = notes.filter(n => new Date(n.date) >= cut);
  } else if (statsPeriod === '6month') {
    const cut = new Date(); cut.setMonth(cut.getMonth()-6);
    notes = notes.filter(n => new Date(n.date) >= cut);
  } else if (statsPeriod === 'year') {
    const y = new Date().getFullYear();
    notes = notes.filter(n => new Date(n.date).getFullYear() === y);
  } else if (statsPeriod === 'custom' && statsFrom && statsTo) {
    notes = notes.filter(n => n.date >= statsFrom && n.date <= statsTo);
  }
  return notes;
}

function applyCustomPeriod() {
  statsFrom = document.getElementById('stats-date-from').value;
  statsTo = document.getElementById('stats-date-to').value;
  if (!statsFrom || !statsTo) { showToast('기간을 설정해주세요.'); return; }
  renderStats();
}

function renderStats() {
  const notes = getFilteredNotes();
  const scored = notes.filter(n => n.score !== null && n.score !== undefined);
  const avgScore = scored.length ? Math.round(scored.reduce((s,n) => s+n.score, 0)/scored.length) : null;
  const totalMl = notes.reduce((s,n) => s+(n.amount||0), 0);
  const typeSet = new Set(notes.map(n => n.type==='custom' ? (n.typeCustom||'custom') : n.type));

  document.getElementById('stats-subtitle').textContent = `${notes.length}개 시음 기록 분석`;
  document.getElementById('stats-summary').innerHTML = `
    <div class="stats-summary-card"><div class="stats-summary-num">${notes.length}</div><div class="stats-summary-label">총 시음 횟수</div></div>
    <div class="stats-summary-card"><div class="stats-summary-num">${totalMl > 0 ? totalMl+'ml' : '—'}</div><div class="stats-summary-label">총 시음량</div></div>
    <div class="stats-summary-card"><div class="stats-summary-num">${typeSet.size}</div><div class="stats-summary-label">술 종류 수</div></div>
    <div class="stats-summary-card"><div class="stats-summary-num">${avgScore !== null ? avgScore+'점' : '—'}</div><div class="stats-summary-label">평균 점수</div></div>
  `;

  renderBarChart('chart-category', groupBy(notes, n => {
    const t = TYPE_MAP[n.type]; return t ? (t.cat === 'korean' ? '한국 전통주' : t.cat === 'japanese' ? '일본주' : '기타') : '기타';
  }), notes.length);

  renderBarChart('chart-type', groupBy(notes, n => typeLabel(n)), notes.length);

  renderBarChart('chart-region', groupBy(notes, n => n.region ? regionLabel(n.region) : '미입력'), notes.length);

  // 점수 분석
  const scoreGroups = {'60 미만':0,'60~69':0,'70~79':0,'80~89':0,'90 이상':0};
  scored.forEach(n => {
    if (n.score < 60) scoreGroups['60 미만']++;
    else if (n.score < 70) scoreGroups['60~69']++;
    else if (n.score < 80) scoreGroups['70~79']++;
    else if (n.score < 90) scoreGroups['80~89']++;
    else scoreGroups['90 이상']++;
  });
  renderBarChart('chart-scores', scoreGroups, Math.max(...Object.values(scoreGroups), 1));

  // 취향 분석
  renderTasteReport(notes);
}

function groupBy(arr, fn) {
  const m = {};
  arr.forEach(item => { const k = fn(item) || '미입력'; m[k] = (m[k]||0)+1; });
  return m;
}

function renderBarChart(containerId, data, total) {
  const el = document.getElementById(containerId); if (!el) return;
  const sorted = Object.entries(data).sort((a,b) => b[1]-a[1]).slice(0, 8);
  if (sorted.length === 0) { el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">데이터 없음</p>'; return; }
  el.innerHTML = sorted.map(([k,v]) =>
    `<div class="bar-row">
      <span class="bar-label">${k}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/total*100)}%"></div></div>
      <span class="bar-count">${v}</span>
    </div>`
  ).join('');
}

function renderTasteReport(notes) {
  const el = document.getElementById('taste-report-section'); if (!el) return;
  const flNotes = notes.filter(n => n.flavors && Object.values(n.flavors).some(v => v > 0));
  if (flNotes.length < 2) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">향미 프로필 데이터가 2개 이상 있으면 리포트가 생성됩니다.</p>';
    return;
  }
  const avg = {};
  FLAVORS.forEach(f => { avg[f.key] = flNotes.reduce((s,n) => s+(n.flavors?.[f.key]||0), 0)/flNotes.length; });

  const sorted = FLAVORS.map(f => ({...f, val: avg[f.key]})).sort((a,b) => b.val-a.val);
  const top = sorted[0];
  const spread = Math.max(...Object.values(avg)) - Math.min(...Object.values(avg));
  let style, recommend;
  if (spread < 0.8) {
    style = '균형 잡힌 취향';
    recommend = '어떤 스타일이든 두루 즐기는 타입입니다. 다이긴조나 청주처럼 균형 잡힌 술이 잘 맞습니다.';
  } else if (top.key === 'sweet') {
    style = `${top.emoji} 달콤한 취향`;
    recommend = '단맛과 풍미가 풍부한 술을 선호합니다. 아마자케, 우메슈, 버번 캐스크 숙성 막걸리 등을 추천합니다.';
  } else if (top.key === 'acidic') {
    style = `${top.emoji} 산미 선호 취향`;
    recommend = '상쾌한 산미를 즐기는 타입입니다. 야마가타·이시카와의 준마이긴조, 막걸리(생막걸리) 등을 추천합니다.';
  } else if (top.key === 'umami') {
    style = `${top.emoji} 감칠맛 선호 취향`;
    recommend = '깊고 복합적인 풍미를 즐기는 타입입니다. 준마이 다이긴조, 약주, 숙성 청주 등을 추천합니다.';
  } else if (top.key === 'grain') {
    style = `${top.emoji} 곡물·쌀 선호 취향`;
    recommend = '곡물의 깨끗한 풍미를 즐기는 타입입니다. 혼조조, 증류식 소주, 보리소주를 추천합니다.';
  } else if (top.key === 'fruity') {
    style = `${top.emoji} 과일향 선호 취향`;
    recommend = '화사한 과일향을 선호합니다. 긴조·다이긴조계열, 우메슈, 과실주 등을 추천합니다.';
  } else if (top.key === 'floral') {
    style = `${top.emoji} 꽃향 선호 취향`;
    recommend = '섬세한 꽃향을 즐기는 타입입니다. 다이긴조, 야마가타 긴조, 제주 약주 등을 추천합니다.';
  } else {
    style = '다양한 취향';
    recommend = '다양한 향미를 균형있게 즐깁니다.';
  }

  const radarCanvas = document.createElement('canvas');
  radarCanvas.width = radarCanvas.height = 200;
  radarCanvas.className = 'detail-radar';
  setTimeout(() => drawRadarChart(radarCanvas, avg, { padding: 34, fontSize: 12, labelPad: 20, lineWidth: 2.5, dotRadius: 4 }), 50);

  el.innerHTML = `
    <div class="taste-report-body">
      <div class="taste-report-radar"></div>
      <div class="taste-report-text">
        <div class="taste-report-headline">${style}</div>
        <div class="taste-report-desc">${recommend}</div>
        <div class="taste-flavor-bars">
          ${sorted.map((f, i) => `
            <div class="taste-flavor-row">
              <span class="taste-flavor-rank">${['🥇','🥈','🥉','4','5','6'][i]}</span>
              <span class="taste-flavor-emoji">${f.emoji}</span>
              <span class="taste-flavor-name">${f.label}</span>
              <div class="taste-flavor-track"><div class="taste-flavor-fill" style="width:${f.val/5*100}%"></div></div>
              <span class="taste-flavor-score">${f.val.toFixed(1)}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
  el.querySelector('.taste-report-radar').appendChild(radarCanvas);
}

// ════ 위시리스트 ════
function renderWishlist() {
  const wl = Storage.getWishlist();
  const active = wl.filter(w => !w.done);
  const done = wl.filter(w => w.done);
  document.getElementById('wishlist-subtitle').textContent = `${active.length}개 목록 · ${done.length}개 완료`;
  const el = document.getElementById('wishlist-list');
  const empty = document.getElementById('wishlist-empty');
  if (wl.length === 0) { el.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  el.innerHTML = [...active, ...done].map(w => `
    <div class="wishlist-card priority-${w.priority||'medium'} ${w.done?'done':''}">
      <div class="wl-info">
        <div class="wl-name">${w.name}</div>
        <div class="wl-meta">
          ${w.type ? typeLabel({type:w.type,typeCustom:w.typeCustom||''})+'&nbsp;·&nbsp;' : ''}
          ${w.brewery||''} ${w.region?regionLabel(w.region):''} ${w.price?`· ₩${Number(w.price).toLocaleString()}`:''}
          ${w.notes ? `<br>${w.notes}` : ''}
        </div>
      </div>
      <div class="wl-actions">
        ${!w.done ? `<button class="btn btn-sm btn-primary" onclick="completeWishlist('${w.id}')">완료</button>` : '<span style="font-size:12px;color:var(--text-muted)">완료</span>'}
        <button class="btn btn-sm btn-outline" onclick="editWishlist('${w.id}')">수정</button>
        <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:rgba(224,84,84,0.3)" onclick="deleteWishlist('${w.id}')">삭제</button>
      </div>
    </div>`).join('');
}

function openAddWishlist() {
  editingWlId = null;
  document.getElementById('modal-wl-title').textContent = '위시리스트 추가';
  setVal('wl-name',''); setVal('wl-brewery',''); setVal('wl-type','');
  setVal('wl-type-custom',''); setVal('wl-region','');
  setVal('wl-priority','medium'); setVal('wl-price',''); setVal('wl-notes','');
  document.getElementById('wl-type-custom-group').style.display = 'none';
  openModal('modal-wishlist');
}
function handleWlTypeChange() {
  const val = document.getElementById('wl-type').value;
  document.getElementById('wl-type-custom-group').style.display = val === 'custom' ? '' : 'none';
}
function editWishlist(id) {
  const w = Storage.getWishlist().find(x => x.id === id); if (!w) return;
  editingWlId = id;
  document.getElementById('modal-wl-title').textContent = '위시리스트 수정';
  setVal('wl-name', w.name); setVal('wl-brewery', w.brewery||'');
  setVal('wl-type', w.type||''); handleWlTypeChange();
  if (w.type === 'custom') setVal('wl-type-custom', w.typeCustom||'');
  setVal('wl-region', w.region||''); setVal('wl-priority', w.priority||'medium');
  setVal('wl-price', w.price||''); setVal('wl-notes', w.notes||'');
  openModal('modal-wishlist');
}
function saveWishlist() {
  const name = getVal('wl-name'); if (!name) { showToast('이름을 입력해주세요.'); return; }
  const type = getVal('wl-type');
  const item = {
    id: editingWlId || uid(),
    name, brewery: getVal('wl-brewery'), type,
    typeCustom: type === 'custom' ? getVal('wl-type-custom') : '',
    region: getVal('wl-region'), priority: getVal('wl-priority'),
    price: getVal('wl-price') ? +getVal('wl-price') : null,
    notes: getVal('wl-notes'), done: false,
  };
  const wl = Storage.getWishlist();
  if (editingWlId) {
    const i = wl.findIndex(x => x.id === editingWlId);
    if (i >= 0) { item.done = wl[i].done; wl[i] = item; }
  } else { wl.unshift(item); }
  Storage.saveWishlist(wl);
  closeModal('modal-wishlist');
  showToast('저장됐습니다.');
  renderWishlist();
}
function completeWishlist(id) {
  const wl = Storage.getWishlist();
  const i = wl.findIndex(x => x.id === id);
  if (i >= 0) wl[i].done = true;
  Storage.saveWishlist(wl);
  renderWishlist();
}
function deleteWishlist(id) {
  if (!confirm('삭제할까요?')) return;
  Storage.saveWishlist(Storage.getWishlist().filter(x => x.id !== id));
  showToast('삭제됐습니다.');
  renderWishlist();
}

// ════ 사진 크롭 ════
function openCropModal(imgSrc, callback) {
  _cropCallback = callback;
  const img = document.getElementById('crop-img');
  img.src = imgSrc;
  img.onload = () => {
    _cropScale = 1; _cropX = 0; _cropY = 0;
    document.getElementById('crop-zoom-slider').value = 100;
    applyCropTransform();
  };
  openModal('modal-crop');
}
function cancelCrop() { closeModal('modal-crop'); }
function cropSetZoom(v) { _cropScale = v/100; applyCropTransform(); }
function applyCropTransform() {
  const img = document.getElementById('crop-img');
  const c = document.getElementById('crop-container');
  const cw = c.offsetWidth;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = cw / Math.max(iw, ih) * _cropScale;
  img.style.width = iw*base + 'px';
  img.style.height = ih*base + 'px';
  img.style.left = _cropX + 'px';
  img.style.top = _cropY + 'px';
}
function confirmCrop() {
  const img = document.getElementById('crop-img');
  const c = document.getElementById('crop-container');
  const cw = c.offsetWidth;
  const SIZE = 400;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = cw / Math.max(iw, ih) * _cropScale;
  const dw = iw*base, dh = ih*base;
  const ratio = SIZE/cw;
  ctx.drawImage(img, _cropX*ratio, _cropY*ratio, dw*ratio, dh*ratio);
  closeModal('modal-crop');
  if (_cropCallback) _cropCallback(canvas.toDataURL('image/jpeg', 0.88));
  _cropCallback = null;
}
function initCropDrag() {
  const c = document.getElementById('crop-container');
  c.addEventListener('mousedown', e => { _cropDragging=true; _cropLx=e.clientX-_cropX; _cropLy=e.clientY-_cropY; e.preventDefault(); });
  c.addEventListener('touchstart', e => { _cropDragging=true; const t=e.touches[0]; _cropLx=t.clientX-_cropX; _cropLy=t.clientY-_cropY; e.preventDefault(); }, {passive:false});
  const move = (x, y) => { if (!_cropDragging) return; _cropX=x-_cropLx; _cropY=y-_cropLy; applyCropTransform(); };
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  document.addEventListener('touchmove', e => { if (!_cropDragging) return; const t=e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }, {passive:false});
  document.addEventListener('mouseup', () => _cropDragging=false);
  document.addEventListener('touchend', () => _cropDragging=false);
}

// ════ 데이터 내보내기/가져오기 ════
async function exportData() {
  showToast('내보내는 중...');
  const notes = Storage.getNotes();
  const wishlist = Storage.getWishlist();
  const imgData = {};
  for (const n of notes) {
    const img = await ImageDB.get('note_' + n.id);
    if (img) imgData['note_' + n.id] = img;
  }
  const blob = new Blob([JSON.stringify({ notes, wishlist, images: imgData, version: 1 }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hanju-note-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('내보내기 완료!');
}

let _importData = null;
function openImportModal() { document.getElementById('import-preview').innerHTML=''; _importData=null; document.getElementById('import-btn-merge').disabled=true; document.getElementById('import-btn-replace').disabled=true; openModal('modal-import'); }
function handleImportFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      _importData = JSON.parse(e.target.result);
      document.getElementById('import-preview').innerHTML =
        `<p style="color:var(--primary-dark);font-weight:600;margin-top:8px">✅ 파일 확인됨: 시음기록 ${_importData.notes?.length||0}개 · 위시리스트 ${_importData.wishlist?.length||0}개 · 이미지 ${Object.keys(_importData.images||{}).length}개</p>`;
      document.getElementById('import-btn-merge').disabled=false;
      document.getElementById('import-btn-replace').disabled=false;
    } catch { document.getElementById('import-preview').innerHTML='<p style="color:var(--danger)">❌ 올바른 JSON 파일이 아닙니다.</p>'; }
  };
  reader.readAsText(file);
}
async function doImport(mode) {
  if (!_importData) return;
  if (mode === 'replace') {
    if (!confirm('기존 데이터를 모두 삭제하고 가져올까요? 되돌릴 수 없습니다.')) return;
    Storage.saveNotes([]); Storage.saveWishlist([]);
  }
  if (mode === 'merge') {
    const existing = new Set(Storage.getNotes().map(n => n.id));
    const newNotes = (_importData.notes||[]).filter(n => !existing.has(n.id));
    const allNotes = [...Storage.getNotes(), ...newNotes].sort((a,b) => new Date(b.date)-new Date(a.date));
    Storage.saveNotes(allNotes);
    const ewl = new Set(Storage.getWishlist().map(w => w.id));
    const newWl = (_importData.wishlist||[]).filter(w => !ewl.has(w.id));
    Storage.saveWishlist([...Storage.getWishlist(), ...newWl]);
  } else {
    Storage.saveNotes(_importData.notes||[]);
    Storage.saveWishlist(_importData.wishlist||[]);
  }
  for (const [k, v] of Object.entries(_importData.images||{})) { await ImageDB.set(k, v); }
  closeModal('modal-import');
  showToast('가져오기 완료!');
  renderNoteList();
}

function resetAllData() {
  if (!confirm('모든 데이터를 초기화할까요? 되돌릴 수 없습니다.')) return;
  Storage.saveNotes([]); Storage.saveWishlist([]);
  showToast('초기화됐습니다.');
  navigateTo('tasting');
}

// ════ 피드백 ════
function openFeedbackModal() { openModal('modal-feedback'); }
function closeFeedbackModal() { closeModal('modal-feedback'); }
function sendEmailFeedback() {
  const text = document.getElementById('feedback-text').value.trim();
  if (!text) { showToast('내용을 입력해주세요.'); return; }
  location.href = `mailto:shuttle1207@gmail.com?subject=주향노트 피드백&body=${encodeURIComponent(text)}`;
  closeFeedbackModal();
}

// ════ 더보기 메뉴 (모바일) ════
function openMoreMenu() { document.getElementById('more-menu-overlay').classList.add('open'); }
function closeMoreMenu() { document.getElementById('more-menu-overlay').classList.remove('open'); }

// ════ 초기화 ════
function init() {
  initDarkMode();
  // 네비게이션 이벤트
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // 통계 기간 탭
  document.querySelectorAll('.stats-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stats-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statsPeriod = btn.dataset.period;
      document.getElementById('stats-custom-date').style.display = statsPeriod === 'custom' ? 'flex' : 'none';
      if (statsPeriod !== 'custom') renderStats();
    });
  });

  // 필터 탭
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterCat = btn.dataset.cat;
      renderNoteList();
    });
  });

  initCropDrag();
  navigateTo('tasting');
  checkConsentBanner();
}

document.addEventListener('DOMContentLoaded', init);
