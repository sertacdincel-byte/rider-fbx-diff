import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const STUB_PNG = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const g = c.getContext('2d');
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 1, 1);
  return c.toDataURL('image/png');
})();
const LOD_RE = /(?:^|[_\-. ])LOD[_ ]?(\d+)$/i;

const app = {
  mode: 'diff',
  dark: false,
  sides: [],
  renderer: null,
  webglError: null,
  dirty: true,
  syncing: false,
  framed: false,
  clock: new THREE.Clock(),
  selected: null,
  opts: { shading: 'clay', wire: false, bones: false, grid: true, rotate: 'auto', lod: 'all', sync: true, clip: '', playing: false, layout: 0 },
  table: { sort: 'tris', dir: -1, onlyChanged: false, filter: '' },
};

const mats = {
  clay: new THREE.MeshStandardMaterial({ color: 0xb4b9c2, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
  normals: new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }),
  highlight: new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0x5a2d00, roughness: 0.6, metalness: 0, side: THREE.DoubleSide }),
};

// ---------------------------------------------------------------- bridge

window.FbxDiff = {
  init(o) {
    if (app.sides.length) return;
    app.mode = o.mode === 'single' ? 'single' : 'diff';
    app.dark = !!o.dark;
    document.body.classList.toggle('dark', app.dark);
    const titles = o.titles || [];
    const n = app.mode === 'single' ? 1 : 2;
    for (let i = 0; i < n; i++) app.sides.push(createSide(i, titles[i] || (i === 0 ? 'Before' : 'After')));
    if (app.mode === 'single') $('btnSync').style.display = 'none';
    setupRenderer();
    refreshAll();
  },
  begin(i, size) {
    const s = app.sides[i];
    if (!s) return;
    s.status = 'loading';
    s.size = size;
    s.buffer = new Uint8Array(size);
    s.received = 0;
    setMessage(s, 'Receiving… 0%');
  },
  chunk(i, b64) {
    const s = app.sides[i];
    if (!s || !s.buffer) return;
    const bin = atob(b64);
    const len = bin.length;
    const buf = s.buffer;
    let off = s.received;
    for (let k = 0; k < len; k++) buf[off + k] = bin.charCodeAt(k);
    s.received += len;
    setMessage(s, 'Receiving… ' + Math.round((s.received / s.size) * 100) + '%');
  },
  end(i) {
    const s = app.sides[i];
    if (!s) return;
    setMessage(s, 'Parsing FBX…');
    setTimeout(() => parseSide(s), 16);
  },
  empty(i, text) {
    const s = app.sides[i];
    if (!s) return;
    s.status = 'empty';
    setMessage(s, text || 'No file in this revision');
    onSidesChanged();
  },
  error(i, text) {
    const s = app.sides[i];
    if (!s) return;
    s.status = 'error';
    setMessage(s, text, true);
    onSidesChanged();
  },
};

// ---------------------------------------------------------------- sides

function createSide(index, title) {
  const el = document.createElement('div');
  el.className = 'view';
  el.innerHTML = '<div class="title"><span class="name"></span><span class="meta"></span></div><div class="hit"></div><div class="msg"></div>';
  $('views').appendChild(el);
  el.querySelector('.name').textContent = title;
  el.querySelector('.name').title = title;

  const s = {
    index, title, el,
    hit: el.querySelector('.hit'),
    msgEl: el.querySelector('.msg'),
    metaEl: el.querySelector('.meta'),
    status: 'waiting', size: 0, received: 0, buffer: null,
    root: null, stats: null, header: null,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(40, 1, 0.01, 1000),
    pivot: new THREE.Group(),
    controls: null, mixer: null, action: null, skeleton: null, grid: null,
  };
  setMessage(s, 'Waiting for data…');

  s.scene.add(s.camera);
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(0.6, 0.8, 0.2);
  key.target.position.set(0, 0, -1);
  s.camera.add(key, key.target);
  s.scene.add(new THREE.HemisphereLight(0xffffff, 0x50505a, 1.4));
  s.scene.add(s.pivot);
  s.camera.position.set(0, 1, 3);

  s.controls = new OrbitControls(s.camera, s.hit);
  s.controls.addEventListener('change', () => {
    app.dirty = true;
    if (app.syncing || !app.opts.sync) return;
    app.syncing = true;
    for (const o of app.sides) {
      if (o === s) continue;
      o.camera.position.copy(s.camera.position);
      o.camera.quaternion.copy(s.camera.quaternion);
      o.camera.near = s.camera.near;
      o.camera.far = s.camera.far;
      o.controls.target.copy(s.controls.target);
      o.controls.update();
    }
    app.syncing = false;
  });
  return s;
}

function setMessage(s, text, isError) {
  s.msgEl.textContent = text || '';
  s.msgEl.style.display = text ? '' : 'none';
  s.msgEl.classList.toggle('err', !!isError);
}

function parseSide(s) {
  try {
    s.header = readHeader(s.buffer);
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => (url.startsWith('data:') || url.startsWith('blob:') ? url : STUB_PNG));
    const root = new FBXLoader(manager).parse(s.buffer.buffer, '');
    s.root = root;
    prepareModel(s);
    s.stats = collectStats(s);
    s.status = 'ready';
    setMessage(s, app.webglError ? '3D preview unavailable: ' + app.webglError : '');
  } catch (e) {
    console.error(e);
    s.status = 'error';
    setMessage(s, 'Could not read FBX: ' + (e && e.message ? e.message : e), true);
  }
  s.buffer = null;
  onSidesChanged();
}

function readHeader(u8) {
  const h = { format: '?', version: null, creator: null };
  const ascii = (a, b) => { let t = ''; for (let i = a; i < b && i < u8.length; i++) t += String.fromCharCode(u8[i]); return t; };
  if (ascii(0, 18) === 'Kaydara FBX Binary') {
    h.format = 'Binary';
    h.version = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(23, true);
    const head = ascii(0, Math.min(u8.length, 65536));
    const at = head.indexOf('Creator');
    if (at > 0 && head.charCodeAt(at + 7) === 0x53) {
      const len = new DataView(u8.buffer, u8.byteOffset).getUint32(at + 8, true);
      if (len > 0 && len < 512) h.creator = ascii(at + 12, at + 12 + len);
    }
  } else {
    const head = ascii(0, Math.min(u8.length, 8192));
    h.format = 'ASCII';
    const v = /FBXVersion:\s*(\d+)/.exec(head);
    if (v) h.version = parseInt(v[1], 10);
    const c = /Creator:\s*"([^"]*)"/.exec(head);
    if (c) h.creator = c[1];
  }
  return h;
}

function prepareModel(s) {
  const root = s.root;
  s.pivot.add(root);
  let hasBones = false;
  root.traverse((o) => {
    if (o.isMesh) {
      o.userData.origMat = o.material;
      o.frustumCulled = false;
      o.userData.lod = findLod(o, root);
    }
    if (o.isLight || o.isCamera) o.visible = false;
    if (o.isBone) hasBones = true;
  });
  if (hasBones) {
    s.skeleton = new THREE.SkeletonHelper(root);
    s.scene.add(s.skeleton);
  }
  if (root.animations && root.animations.length) s.mixer = new THREE.AnimationMixer(root);
}

function findLod(o, root) {
  for (let p = o; p && p !== root.parent; p = p.parent) {
    const m = LOD_RE.exec(p.name || '');
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// ---------------------------------------------------------------- stats

function collectStats(s) {
  const root = s.root;
  const meshes = [];
  const seen = Object.create(null);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const parts = [];
    for (let p = o; p && p !== root; p = p.parent) parts.unshift(p.name || p.type);
    let key = parts.join('/');
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] > 1) key += ' #' + seen[key];
    const g = o.geometry;
    const pos = g.attributes.position;
    const counts = countVertices(g);
    const om = o.userData.origMat;
    const materials = (Array.isArray(om) ? om : [om]).map((m) => (m && m.name) || '(unnamed)');
    meshes.push({
      key,
      name: o.name || '(unnamed)',
      lod: o.userData.lod,
      skinned: !!o.isSkinnedMesh,
      tris: Math.round((g.index ? g.index.count : pos.count) / 3),
      verts: counts.split,
      positions: counts.positions,
      bones: o.isSkinnedMesh && o.skeleton ? o.skeleton.bones.length : 0,
      morphs: g.morphAttributes.position ? g.morphAttributes.position.length : 0,
      uvSets: Object.keys(g.attributes).filter((k) => /^uv\d*$/.test(k)).length,
      colors: !!g.attributes.color,
      materials,
      obj: o,
    });
  });

  const boneSet = new Set();
  root.traverse((o) => { if (o.isBone) boneSet.add(o); });
  const materialUse = new Map();
  for (const m of meshes) for (const n of m.materials) materialUse.set(n, (materialUse.get(n) || 0) + 1);
  const anims = (root.animations || []).map((c) => ({ name: c.name || '(unnamed)', duration: c.duration, tracks: c.tracks.length }));
  const sum = (f) => meshes.reduce((a, m) => a + m[f], 0);

  return {
    meshes, anims, materialUse,
    totals: {
      meshes: meshes.length,
      tris: sum('tris'),
      verts: sum('verts'),
      positions: sum('positions'),
      bones: boneSet.size,
      morphs: sum('morphs'),
      materials: materialUse.size,
      clips: anims.length,
    },
  };
}

// Unique positions approximate the DCC vertex count; unique (position, normal, uv*, color)
// tuples approximate the vertex count Unity reports after import.
function countVertices(g) {
  const a = g.attributes;
  const pos = a.position;
  const extra = [];
  if (a.normal) extra.push([a.normal, 1e3]);
  for (const k of Object.keys(a)) if (/^uv\d*$/.test(k)) extra.push([a[k], 1e5]);
  if (a.color) extra.push([a.color, 1e3]);
  const posSet = new Set();
  const fullSet = new Set();
  const q = (v, s) => Math.round(v * s);
  for (let i = 0; i < pos.count; i++) {
    const pk = q(pos.getX(i), 1e4) + ',' + q(pos.getY(i), 1e4) + ',' + q(pos.getZ(i), 1e4);
    posSet.add(pk);
    let k = pk;
    for (const [attr, sc] of extra) {
      k += '|' + q(attr.getX(i), sc);
      if (attr.itemSize > 1) k += ',' + q(attr.getY(i), sc);
      if (attr.itemSize > 2) k += ',' + q(attr.getZ(i), sc);
    }
    fullSet.add(k);
  }
  return { positions: posSet.size, split: fullSet.size };
}

function buildRows() {
  const [A, B] = app.sides;
  if (app.mode === 'single') {
    return A.stats ? A.stats.meshes.map((m) => ({ id: 'n:' + m.key, name: m.key, a: null, b: m, status: 'same' })) : [];
  }
  const am = A.stats ? A.stats.meshes : [];
  const bm = B.stats ? B.stats.meshes : [];
  const rows = [];
  const usedB = new Set();
  const byKey = new Map(bm.map((m) => [m.key, m]));
  const pending = [];
  for (const m of am) {
    const other = byKey.get(m.key);
    if (other && !usedB.has(other)) { usedB.add(other); rows.push(makeRow(m, other)); } else pending.push(m);
  }
  const unmatched = [];
  for (const m of pending) {
    const other = bm.find((x) => !usedB.has(x) && x.name === m.name);
    if (other) { usedB.add(other); rows.push(makeRow(m, other)); } else unmatched.push(m);
  }
  // A mesh that gained or lost a LOD suffix ("Body" <-> "Body_LOD0") is the same mesh.
  for (const m of unmatched) {
    const base = baseName(m.name);
    const candidates = bm.filter((x) => !usedB.has(x) && baseName(x.name) === base && (x.lod || 0) === (m.lod || 0));
    const other = candidates[0];
    if (other) { usedB.add(other); rows.push(makeRow(m, other)); } else rows.push(makeRow(m, null));
  }
  for (const m of bm) if (!usedB.has(m)) rows.push(makeRow(null, m));
  return rows;
}

function baseName(n) {
  return n.replace(LOD_RE, '').toLowerCase();
}

const FIELDS = ['tris', 'verts', 'positions', 'bones', 'morphs', 'uvSets', 'lod'];

function makeRow(a, b) {
  let status = 'same';
  if (!a) status = 'added';
  else if (!b) status = 'removed';
  else if (FIELDS.some((f) => a[f] !== b[f]) || a.skinned !== b.skinned || a.materials.join('\n') !== b.materials.join('\n')) status = 'changed';
  const ref = b || a;
  return { id: (a ? a.key : '') + ' ⇄ ' + (b ? b.key : ''), name: ref.key, a, b, status };
}

// ---------------------------------------------------------------- rendering of tables

const fmt = (n) => (n === null || n === undefined ? '—' : typeof n === 'number' ? n.toLocaleString('en-US') : String(n));
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B');
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function deltaHtml(o, n) {
  if (typeof o !== 'number' || typeof n !== 'number' || o === n) return '';
  const d = n - o;
  const pct = o !== 0 ? ' ' + (d > 0 ? '+' : '') + ((d / o) * 100).toFixed(1) + '%' : '';
  return '<span class="d ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '+' : '') + d.toLocaleString('en-US') + pct + '</span>';
}

function pairHtml(o, n, format) {
  const f = format || fmt;
  if (app.mode === 'single') return esc(f(n));
  if (o === undefined) return esc(f(n));
  if (n === undefined) return '<span class="muted">' + esc(f(o)) + '</span>';
  if (o === n) return esc(f(n));
  return '<span class="muted">' + esc(f(o)) + '</span><span class="arrow">→</span>' + esc(f(n)) + deltaHtml(o, n);
}

function rowVal(r, f) {
  const a = r.a ? r.a[f] : undefined;
  const b = r.b ? r.b[f] : undefined;
  return [a, b];
}

function renderStats() {
  const el = $('stats');
  const [A, B] = app.sides;
  const sideReady = (s) => s && s.stats;
  const parts = [];

  // summary cards
  const cardDefs = [
    ['File size', (s) => s.size, fmtSize],
    ['FBX', (s) => (s.header ? s.header.format + ' ' + (s.header.version || '?') : null), String],
    ['Meshes', (s) => s.stats.totals.meshes],
    ['Triangles', (s) => s.stats.totals.tris],
    ['Vertices (≈Unity)', (s) => s.stats.totals.verts],
    ['Positions', (s) => s.stats.totals.positions],
    ['Bones', (s) => s.stats.totals.bones],
    ['Blend shapes', (s) => s.stats.totals.morphs],
    ['Materials', (s) => s.stats.totals.materials],
    ['Anim clips', (s) => s.stats.totals.clips],
  ];
  const singleSide = app.mode === 'single' ? A : null;
  const ready = app.sides.filter(sideReady);
  if (!ready.length) {
    el.innerHTML = '<div class="empty">' + (app.sides.some((s) => s.status === 'loading' || s.status === 'waiting') ? 'Loading…' : 'Nothing to compare.') + '</div>';
    return;
  }
  parts.push('<div class="cards">');
  for (const [label, get, f] of cardDefs) {
    let html;
    if (singleSide) html = esc((f || fmt)(get(singleSide)));
    else {
      const o = sideReady(A) ? get(A) : undefined;
      const n = sideReady(B) ? get(B) : undefined;
      html = pairHtml(o, n, f);
    }
    parts.push('<div class="card"><div class="k">' + esc(label) + '</div><div class="v">' + html + '</div></div>');
  }
  parts.push('</div>');
  const creators = app.sides.map((s) => (s.header && s.header.creator) || null).filter(Boolean);
  if (creators.length) {
    const uniq = [...new Set(creators)];
    parts.push('<div class="section muted">Exporter: ' + esc(uniq.join('  →  ')) + '</div>');
  }

  // LOD summary
  const lodSet = new Set();
  for (const s of ready) for (const m of s.stats.meshes) if (m.lod !== null) lodSet.add(m.lod);
  if (lodSet.size) {
    lodSet.add(0);
    const lods = [...lodSet].sort((x, y) => x - y);
    const at = (s, lod) => s.stats.meshes.filter((m) => (m.lod === null ? 0 : m.lod) === lod);
    const agg = (s, lod, f) => (sideReady(s) ? at(s, lod).reduce((t, m) => t + m[f], 0) : undefined);
    const cnt = (s, lod) => (sideReady(s) ? at(s, lod).length : undefined);
    parts.push('<div class="section"><h3>LOD levels <span class="opt">meshes without a LOD suffix count as LOD0</span></h3><table><thead><tr><th class="l">LOD</th><th>Meshes</th><th>Triangles</th><th>Vertices (≈Unity)</th><th>Positions</th></tr></thead><tbody>');
    for (const lod of lods) {
      const one = (fn) => (app.mode === 'single' ? pairHtml(undefined, fn(A)) : pairHtml(fn(A), fn(B)));
      parts.push('<tr data-lod="' + lod + '"><td class="l">LOD' + lod + '</td><td>' + one((s) => cnt(s, lod)) + '</td><td>' + one((s) => agg(s, lod, 'tris')) + '</td><td>' + one((s) => agg(s, lod, 'verts')) + '</td><td>' + one((s) => agg(s, lod, 'positions')) + '</td></tr>');
    }
    parts.push('</tbody></table></div>');
  }

  // mesh table
  const rows = buildRows();
  const t = app.table;
  let shown = rows;
  if (t.onlyChanged && app.mode !== 'single') shown = shown.filter((r) => r.status !== 'same');
  if (t.filter) {
    const q = t.filter.toLowerCase();
    shown = shown.filter((r) => r.name.toLowerCase().includes(q));
  }
  const sortVal = (r) => {
    if (t.sort === 'name') return r.name.toLowerCase();
    if (t.sort === 'status') return ['removed', 'added', 'changed', 'same'].indexOf(r.status);
    if (t.sort === 'materials') return (r.b || r.a).materials.length;
    const v = (r.b || r.a)[t.sort];
    return v === null ? -1 : v;
  };
  shown = shown.slice().sort((x, y) => {
    const a = sortVal(x), b = sortVal(y);
    return (a < b ? -1 : a > b ? 1 : 0) * t.dir;
  });
  const changedCount = rows.filter((r) => r.status !== 'same').length;
  const cols = [
    ['status', 'Status', 'l'], ['name', 'Mesh', 'l'], ['lod', 'LOD'], ['tris', 'Triangles'], ['verts', 'Vertices (≈Unity)'],
    ['positions', 'Positions'], ['bones', 'Bones'], ['morphs', 'Blend shapes'], ['uvSets', 'UV sets'], ['materials', 'Materials'],
  ].filter((c) => app.mode !== 'single' || c[0] !== 'status');
  parts.push('<div class="section"><h3>Meshes <span class="muted">' + rows.length + (app.mode !== 'single' ? ' · ' + changedCount + ' changed' : '') + '</span>');
  if (app.mode !== 'single') parts.push('<label class="opt"><input type="checkbox" id="onlyChanged"' + (t.onlyChanged ? ' checked' : '') + '>Only changed</label>');
  parts.push('<span class="opt"><input type="search" id="meshFilter" placeholder="Filter" value="' + esc(t.filter) + '"></span></h3>');
  parts.push('<table id="meshTable"><thead><tr>');
  for (const [k, label, cls] of cols) parts.push('<th data-sort="' + k + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(label) + (t.sort === k ? (t.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>');
  parts.push('</tr></thead><tbody>');
  if (!shown.length) parts.push('<tr><td colspan="' + cols.length + '" class="l muted">No meshes</td></tr>');
  for (const r of shown) {
    const sel = app.selected && app.selected.id === r.id ? ' class="sel"' : '';
    parts.push('<tr data-id="' + esc(r.id) + '"' + sel + '>');
    for (const [k] of cols) {
      if (k === 'status') { parts.push('<td class="l"><span class="st ' + r.status + '">' + r.status + '</span></td>'); continue; }
      if (k === 'name') {
        const ref = r.b || r.a;
        parts.push('<td class="l name" title="' + esc(r.name) + '">' + esc(r.name) + (ref.skinned ? ' <span class="muted">(skinned)</span>' : '') + '</td>');
        continue;
      }
      if (k === 'materials') {
        const ma = r.a ? r.a.materials : null;
        const mb = r.b ? r.b.materials : null;
        const tip = esc(((mb || ma) || []).join(', ') + (ma && mb && ma.join() !== mb.join() ? '  (was: ' + ma.join(', ') + ')' : ''));
        const o = ma ? ma.length : undefined;
        const n = mb ? mb.length : undefined;
        const namesChanged = ma && mb && ma.join('\n') !== mb.join('\n') && o === n;
        parts.push('<td title="' + tip + '">' + (app.mode === 'single' ? pairHtml(undefined, n) : pairHtml(o, n)) + (namesChanged ? ' <span class="d up">renamed</span>' : '') + '</td>');
        continue;
      }
      const [o, n] = rowVal(r, k);
      const f = k === 'lod' ? (v) => (v === null || v === undefined ? '—' : 'LOD' + v) : fmt;
      parts.push('<td>' + (app.mode === 'single' ? pairHtml(undefined, n, f) : pairHtml(o, n, f)) + '</td>');
    }
    parts.push('</tr>');
  }
  parts.push('</tbody></table></div>');

  // animations
  const clipNames = new Set();
  for (const s of ready) for (const c of s.stats.anims) clipNames.add(c.name);
  if (clipNames.size) {
    const find = (s, n) => (sideReady(s) ? s.stats.anims.find((c) => c.name === n) : undefined);
    parts.push('<div class="section"><h3>Animation clips</h3><table><thead><tr><th class="l">Clip</th><th>Duration (s)</th><th>Tracks</th></tr></thead><tbody>');
    for (const n of clipNames) {
      const ca = app.mode === 'single' ? undefined : find(A, n);
      const cb = app.mode === 'single' ? find(A, n) : find(B, n);
      const d = (c) => (c ? Math.round(c.duration * 1000) / 1000 : undefined);
      const tr = (c) => (c ? c.tracks : undefined);
      const status = app.mode === 'single' ? '' : !ca ? ' <span class="st added">added</span>' : !cb ? ' <span class="st removed">removed</span>' : '';
      parts.push('<tr><td class="l">' + esc(n) + status + '</td><td>' + pairHtml(ca ? d(ca) : app.mode === 'single' ? undefined : null, d(cb)) + '</td><td>' + pairHtml(ca ? tr(ca) : app.mode === 'single' ? undefined : null, tr(cb)) + '</td></tr>');
    }
    parts.push('</tbody></table></div>');
  }

  // materials
  const matNames = new Set();
  for (const s of ready) for (const n of s.stats.materialUse.keys()) matNames.add(n);
  if (matNames.size) {
    const use = (s, n) => (sideReady(s) ? s.stats.materialUse.get(n) || 0 : undefined);
    parts.push('<div class="section"><h3>Materials</h3><table><thead><tr><th class="l">Material</th><th>Used by meshes</th></tr></thead><tbody>');
    for (const n of [...matNames].sort()) {
      const o = app.mode === 'single' ? undefined : use(A, n);
      const v = app.mode === 'single' ? use(A, n) : use(B, n);
      const status = app.mode === 'single' ? '' : o === 0 ? ' <span class="st added">added</span>' : v === 0 ? ' <span class="st removed">removed</span>' : '';
      parts.push('<tr><td class="l">' + esc(n) + status + '</td><td>' + pairHtml(o, v) + '</td></tr>');
    }
    parts.push('</tbody></table></div>');
  }

  const scroll = el.scrollTop;
  const focused = document.activeElement && document.activeElement.id === 'meshFilter';
  el.innerHTML = parts.join('');
  el.scrollTop = scroll;
  app.rowsById = new Map(rows.map((r) => [r.id, r]));

  const filter = $('meshFilter');
  if (filter) {
    filter.addEventListener('input', () => { app.table.filter = filter.value; renderStats(); });
    if (focused) { filter.focus(); filter.setSelectionRange(filter.value.length, filter.value.length); }
  }
  const oc = $('onlyChanged');
  if (oc) oc.addEventListener('change', () => { app.table.onlyChanged = oc.checked; renderStats(); });
}

$('stats').addEventListener('click', (e) => {
  const th = e.target.closest('th[data-sort]');
  if (th) {
    const k = th.getAttribute('data-sort');
    if (app.table.sort === k) app.table.dir = -app.table.dir;
    else { app.table.sort = k; app.table.dir = k === 'name' || k === 'status' ? 1 : -1; }
    renderStats();
    return;
  }
  const lodRow = e.target.closest('tr[data-lod]');
  if (lodRow) {
    $('lod').value = lodRow.getAttribute('data-lod');
    app.opts.lod = $('lod').value;
    applyVisibility();
    frameAll();
    return;
  }
  const tr = e.target.closest('tr[data-id]');
  if (tr && app.rowsById) {
    const r = app.rowsById.get(tr.getAttribute('data-id'));
    app.selected = app.selected && r && app.selected.id === r.id ? null : r;
    applyMaterials();
    renderStats();
  }
});

// ---------------------------------------------------------------- 3D

function setupRenderer() {
  try {
    const r = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
    r.setPixelRatio(window.devicePixelRatio || 1);
    r.setClearColor(new THREE.Color(getComputedStyle(document.body).getPropertyValue('--view-bg').trim() || '#25272b'));
    app.renderer = r;
  } catch (e) {
    app.webglError = (e && e.message) || 'WebGL is not available';
    for (const s of app.sides) setMessage(s, '3D preview unavailable: ' + app.webglError, true);
  }
  new ResizeObserver(() => { app.dirty = true; }).observe($('viewsWrap'));
  requestAnimationFrame(loop);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = app.clock.getDelta();
  if (app.opts.playing) {
    for (const s of app.sides) if (s.mixer) s.mixer.update(dt);
    app.dirty = true;
  }
  if (app.dirty) { app.dirty = false; render(); }
}

function render() {
  const r = app.renderer;
  if (!r) return;
  const wrap = $('viewsWrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  const size = r.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) r.setSize(w, h, false);
  const wr = wrap.getBoundingClientRect();
  r.setScissorTest(false);
  r.clear();
  r.setScissorTest(true);
  for (const s of app.sides) {
    const rc = s.el.getBoundingClientRect();
    const vw = rc.width, vh = rc.height;
    if (vw <= 0 || vh <= 0) continue;
    const left = rc.left - wr.left;
    const bottom = wr.bottom - rc.bottom;
    r.setViewport(left, bottom, vw, vh);
    r.setScissor(left, bottom, vw, vh);
    s.camera.aspect = vw / vh;
    s.camera.updateProjectionMatrix();
    r.render(s.scene, s.camera);
  }
}

function lodVisible(lod) {
  return app.opts.lod === 'all' || lod === null || lod === undefined || String(lod) === app.opts.lod;
}

function applyVisibility() {
  for (const s of app.sides) {
    if (!s.root) continue;
    s.root.traverse((o) => { if (o.isMesh) o.visible = lodVisible(o.userData.lod); });
    if (s.skeleton) s.skeleton.visible = app.opts.bones;
    if (s.grid) s.grid.visible = app.opts.grid;
    s.pivot.rotation.x = app.opts.rotate === 'auto' ? 0 : app.opts.rotate === 'x-' ? -Math.PI / 2 : Math.PI / 2;
  }
  app.dirty = true;
}

function applyMaterials() {
  const selObjs = new Set();
  if (app.selected) { if (app.selected.a) selObjs.add(app.selected.a.obj); if (app.selected.b) selObjs.add(app.selected.b.obj); }
  const used = new Set([mats.clay, mats.normals, mats.highlight]);
  for (const s of app.sides) {
    if (!s.root) continue;
    s.root.traverse((o) => {
      if (!o.isMesh) return;
      let m;
      if (selObjs.has(o)) m = mats.highlight;
      else if (app.opts.shading === 'clay') m = mats.clay;
      else if (app.opts.shading === 'normals') m = mats.normals;
      else m = o.userData.origMat;
      o.material = m;
      (Array.isArray(o.userData.origMat) ? o.userData.origMat : [o.userData.origMat]).forEach((x) => x && used.add(x));
    });
  }
  for (const m of used) { m.wireframe = app.opts.wire; m.needsUpdate = true; }
  app.dirty = true;
}

function frameAll() {
  const box = new THREE.Box3();
  for (const s of app.sides) {
    if (!s.root) continue;
    s.pivot.updateMatrixWorld(true);
    s.root.traverse((o) => { if (o.isMesh && o.visible) box.expandByObject(o); });
  }
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const rad = sphere.radius > 0 ? sphere.radius : 1;
  const dir = new THREE.Vector3(0.55, 0.35, 1).normalize();
  for (const s of app.sides) {
    const cam = s.camera;
    cam.near = rad / 200;
    cam.far = rad * 200;
    const dist = (rad / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.05;
    cam.position.copy(sphere.center).addScaledVector(dir, dist);
    cam.updateProjectionMatrix();
    s.controls.target.copy(sphere.center);
    app.syncing = true;
    s.controls.update();
    app.syncing = false;
    if (s.grid) { s.scene.remove(s.grid); s.grid.geometry.dispose(); s.grid.material.dispose(); }
    const gridColor = app.dark ? 0x4a4d55 : 0xc4c7cf;
    s.grid = new THREE.GridHelper(rad * 4, 20, gridColor, gridColor);
    s.grid.position.set(sphere.center.x, box.min.y, sphere.center.z);
    s.grid.visible = app.opts.grid;
    s.scene.add(s.grid);
  }
  app.framed = true;
  app.dirty = true;
}

function setupAnimationUi() {
  const names = [];
  for (const s of app.sides) if (s.root) for (const c of s.root.animations || []) if (!names.includes(c.name)) names.push(c.name);
  const sel = $('clip');
  $('animGroup').style.display = names.length ? '' : 'none';
  sel.innerHTML = names.map((n) => '<option>' + esc(n) + '</option>').join('');
  if (names.length && !names.includes(app.opts.clip)) app.opts.clip = names[0];
  sel.value = app.opts.clip;
}

function applyClip() {
  for (const s of app.sides) {
    if (!s.mixer) continue;
    s.mixer.stopAllAction();
    s.action = null;
    const clip = (s.root.animations || []).find((c) => c.name === app.opts.clip);
    if (clip && app.opts.playing) {
      s.action = s.mixer.clipAction(clip);
      s.action.play();
    }
  }
  if (!app.opts.playing) for (const s of app.sides) if (s.root) s.root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  app.dirty = true;
}

function setupLodUi() {
  const set = new Set();
  for (const s of app.sides) if (s.stats) for (const m of s.stats.meshes) if (m.lod !== null) set.add(m.lod);
  const lods = [...set].sort((a, b) => a - b);
  $('lodGroup').style.display = lods.length ? '' : 'none';
  if (!lods.length) { app.opts.lod = 'all'; return; }
  $('lod').innerHTML = '<option value="all">All</option>' + lods.map((l) => '<option value="' + l + '">LOD' + l + '</option>').join('');
  if (!app.lodInitialized) { app.opts.lod = String(lods[0]); app.lodInitialized = true; }
  $('lod').value = app.opts.lod;
}

function onSidesChanged() {
  const busy = app.sides.some((s) => s.status === 'waiting' || s.status === 'loading');
  for (const s of app.sides) {
    const bits = [];
    if (s.size && s.status !== 'empty') bits.push(fmtSize(s.size));
    if (s.header) bits.push('FBX ' + s.header.format + ' ' + (s.header.version || '?'));
    if (s.stats) bits.push(s.stats.totals.tris.toLocaleString('en-US') + ' tris');
    s.metaEl.textContent = bits.join(' · ');
  }
  setupLodUi();
  setupAnimationUi();
  applyMaterials();
  applyVisibility();
  if (!busy || !app.framed) frameAll();
  renderStats();
}

function refreshAll() {
  applyMaterials();
  applyVisibility();
  renderStats();
}

// ---------------------------------------------------------------- toolbar

function toggle(id, key, after) {
  const b = $(id);
  b.classList.toggle('on', !!app.opts[key]);
  b.addEventListener('click', () => {
    app.opts[key] = !app.opts[key];
    b.classList.toggle('on', app.opts[key]);
    after();
  });
}

$('shading').addEventListener('change', (e) => { app.opts.shading = e.target.value; applyMaterials(); });
toggle('btnWire', 'wire', applyMaterials);
toggle('btnBones', 'bones', applyVisibility);
toggle('btnGrid', 'grid', applyVisibility);
toggle('btnSync', 'sync', () => {
  if (app.opts.sync && app.sides.length > 1) {
    const s = app.sides[0];
    s.controls.dispatchEvent({ type: 'change' });
  }
});
$('upAxis').addEventListener('change', (e) => { app.opts.rotate = e.target.value; applyVisibility(); frameAll(); });
$('lod').addEventListener('change', (e) => { app.opts.lod = e.target.value; applyVisibility(); frameAll(); });
$('btnFrame').addEventListener('click', frameAll);
$('clip').addEventListener('change', (e) => { app.opts.clip = e.target.value; applyClip(); });
$('btnPlay').addEventListener('click', () => {
  app.opts.playing = !app.opts.playing;
  $('btnPlay').textContent = app.opts.playing ? 'Stop' : 'Play';
  $('btnPlay').classList.toggle('on', app.opts.playing);
  app.clock.getDelta();
  applyClip();
});

const LAYOUTS = ['3D + Stats', '3D only', 'Stats only'];
$('btnLayout').addEventListener('click', () => {
  app.opts.layout = (app.opts.layout + 1) % 3;
  $('btnLayout').textContent = LAYOUTS[app.opts.layout];
  $('viewsWrap').classList.toggle('hidden', app.opts.layout === 2);
  $('stats').classList.toggle('hidden', app.opts.layout === 1);
  $('divider').classList.toggle('hidden', app.opts.layout !== 0);
  app.dirty = true;
});

(() => {
  const div = $('divider');
  let startY = 0, startH = 0;
  const move = (e) => {
    const total = $('split').clientHeight;
    const h = Math.max(80, Math.min(total - 60, startH + e.clientY - startY));
    $('viewsWrap').style.flex = '0 0 ' + h + 'px';
    $('stats').style.flex = '1 1 0';
    app.dirty = true;
  };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  div.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    startH = $('viewsWrap').clientHeight;
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  });
})();

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.key === 'f' || e.key === 'F') frameAll();
});
