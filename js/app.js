(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ICONES = window.ICONES;
const CAT = window.CATALOGUE;
const CAT_INDEX = {};
CAT.forEach((g) => g.items.forEach((it) => { CAT_INDEX[it.id] = { ...it, sens: g.sens || -1 }; }));

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utilitaires ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NF2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmt(v) {
  const a = Math.abs(Math.round(v * 100) / 100);
  return (Number.isInteger(a) ? NF0 : NF2).format(a).replace(/[   ]/g, ' ');
}
const signe = (v, plus = true) => (v < 0 ? '−' : v > 0 && plus ? '+' : '') + fmt(v);
const sg = (v, plus = true) => `<span class="sg">${v < 0 ? '−' : v > 0 && plus ? '+' : ''}</span>${fmt(v)}`;
function lireMontant(s) {
  const t = String(s || '').replace(/\s| | |€/g, '').replace(',', '.');
  if (!/^\d*\.?\d{0,2}$/.test(t) || t === '' || t === '.') return NaN;
  return Number(t);
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* mois sous forme 'AAAA-MM' */
const cle = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const decoupe = (k) => { const [y, m] = k.split('-').map(Number); return { y, m: m - 1 }; };
const rang = (k) => { const { y, m } = decoupe(k); return y * 12 + m; };
const decaler = (k, n) => { const i = rang(k) + n; return cle(Math.floor(i / 12), ((i % 12) + 12) % 12); };
const joursDans = (k) => { const { y, m } = decoupe(k); return new Date(y, m + 1, 0).getDate(); };
const cleAuj = () => { const d = new Date(); return cle(d.getFullYear(), d.getMonth()); };
const nomMois = (k) => MOIS[decoupe(k).m];
const moisAnnee = (k) => { const { y, m } = decoupe(k); return `${MOIS[m]} ${y}`; };

/* ---------- icônes ---------- */
function svg(ref) {
  const [t, n] = ref.split(':');
  if (t === 'si') return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICONES.si[n]}"/></svg>`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES.lu[n]}</svg>`;
}
function hydrater(root = document) {
  $$('svg[data-ic]:not([data-pret])', root).forEach((el) => {
    const [t, n] = el.dataset.ic.split(':');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('aria-hidden', 'true');
    if (t === 'si') { el.setAttribute('fill', 'currentColor'); el.innerHTML = `<path d="${ICONES.si[n]}"/>`; }
    else {
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor');
      if (!el.hasAttribute('stroke-width')) el.setAttribute('stroke-width', '2');
      el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      el.innerHTML = ICONES.lu[n];
    }
    el.dataset.pret = '';
  });
}
function tampon(o, grand = false) {
  const c = o.cat && CAT_INDEX[o.cat];
  if (c && c.ic) return `<span class="tampon">${svg(c.ic)}</span>`;
  if (c && c.tampon) {
    const t = grand || c.tampon.length <= 4 ? c.tampon : c.tampon[0].toUpperCase();
    return `<span class="tampon texte${grand ? ' large' : ''}">${esc(t)}</span>`;
  }
  return `<span class="tampon libre${o.sens > 0 ? ' in' : ''}">${svg(o.sens > 0 ? 'lu:arrow-down-left' : 'lu:arrow-up-right')}</span>`;
}

/* ---------- données ---------- */
const CLE = 'mois.donnees.v1';
const vierge = () => ({ v: 1, recurrents: [], mouvements: [], ajust: {}, maj: 0 });
function valide(o) { return o && Array.isArray(o.recurrents) && Array.isArray(o.mouvements); }
function charger() {
  try {
    const o = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (valide(o)) return Object.assign(vierge(), o);
  } catch (e) { /* stockage indisponible : on part de zéro */ }
  return vierge();
}
let D = charger();
function sauver() {
  D.maj = Date.now();
  try { localStorage.setItem(CLE, JSON.stringify(D)); }
  catch (e) { toast('Impossible d’enregistrer sur cet appareil.'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function actif(r, k) {
  const debut = r.debut || cleAuj();
  if (rang(k) < rang(debut)) return false;
  if (r.fin && rang(k) > rang(r.fin)) return false;
  return (rang(k) - rang(debut)) % (r.freq || 1) === 0;
}
const enCours = (r) => !r.fin || rang(r.fin) >= rang(cleAuj());

function occurrences(k) {
  const n = joursDans(k);
  const L = [];
  for (const r of D.recurrents) {
    if (!actif(r, k)) continue;
    const a = D.ajust[r.id + '|' + k] || {};
    L.push({
      type: 'rec', id: r.id, r, nom: r.nom, cat: r.cat, sens: r.sens,
      montant: a.montant != null ? a.montant : r.montant,
      jour: Math.min(r.jour || 1, n), saute: !!a.saute, ajuste: a.montant != null,
    });
  }
  for (const m of D.mouvements) {
    if (m.date.slice(0, 7) !== k) continue;
    L.push({ type: 'mvt', id: m.id, m, nom: m.nom, cat: m.cat, sens: m.sens, montant: m.montant, jour: Number(m.date.slice(8, 10)) });
  }
  L.sort((a, b) => a.jour - b.jour || b.sens - a.sens || b.montant - a.montant);
  return L;
}

function totaux(k) {
  const L = occurrences(k);
  const t = cleAuj();
  const j = new Date().getDate();
  const etat = rang(k) < rang(t) ? 'passe' : rang(k) > rang(t) ? 'futur' : 'present';
  let auj = 0, fin = 0, rent = 0, sort = 0;
  for (const o of L) {
    if (o.saute) continue;
    const v = o.sens * o.montant;
    fin += v;
    if (o.sens > 0) rent += o.montant; else sort += o.montant;
    if (etat === 'passe' || (etat === 'present' && o.jour <= j)) auj += v;
  }
  return { L, etat, auj, fin, rent, sort, j };
}

function texteRec(r) {
  let s = r.freq === 12 ? 'tous les ans' : r.freq === 3 ? 'tous les 3 mois' : 'tous les mois';
  if (r.fin) s += ` · jusqu’en ${moisAnnee(r.fin)}`;
  return s;
}

/* ---------- rendu ---------- */
let vu = cleAuj();
let vue = 'mois';

function poser(el, html) {
  if (el.innerHTML === html) return;
  el.innerHTML = html;
  if (reduit || !el.classList.contains('duo-n')) return;
  el.classList.remove('imprime'); void el.offsetWidth; el.classList.add('imprime');
}
const chiffre = (v, plus = false) => `${sg(Math.round(v), plus)}<small>€</small>`;

function ajusterTitre() {
  const el = $('#moisNom');
  const boite = el.parentElement.clientWidth;
  let s = Math.min(150, boite * 0.34);
  el.style.fontSize = s + 'px';
  for (let i = 0; i < 60 && el.scrollWidth > el.clientWidth + 1; i++) { s -= 1.5; el.style.fontSize = s + 'px'; }
}
// les deux gros chiffres gardent la même taille, la plus grande qui tient dans leur colonne
function ajusterChiffres() {
  const els = [$('#nG'), $('#nD')];
  els.forEach((el) => { el.style.fontSize = ''; });
  let s = parseFloat(getComputedStyle(els[0]).fontSize);
  for (let i = 0; i < 40 && els.some((el) => el.scrollWidth > el.clientWidth + 1); i++) {
    s -= 2; els.forEach((el) => { el.style.fontSize = s + 'px'; });
  }
}

function rendreBande(T) {
  const titre = $('#moisNom');
  const ancien = titre.textContent;
  titre.textContent = nomMois(vu);
  $('#annee').textContent = decoupe(vu).y;
  if (ancien !== titre.textContent) {
    ajusterTitre();
    if (!reduit) { titre.classList.remove('imprime'); void titre.offsetWidth; titre.classList.add('imprime'); }
  }
  $('#precNom').textContent = MOIS_COURT[decoupe(decaler(vu, -1)).m];
  $('#suivNom').textContent = MOIS_COURT[decoupe(decaler(vu, 1)).m];
  $('#ceMois').hidden = vu === cleAuj();

  if (T.etat === 'present') {
    $('#labG').textContent = 'Aujourd’hui';
    $('#labD').textContent = 'Fin du mois';
    poser($('#nG'), chiffre(T.auj));
    poser($('#nD'), chiffre(T.fin));
    $('#subG').textContent = `au ${T.j} ${MOIS_COURT[decoupe(vu).m]}`;
    const venir = T.fin - T.auj;
    $('#subD').textContent = venir ? `${signe(venir)} € à venir` : 'plus rien à venir';
  } else {
    const passe = T.etat === 'passe';
    $('#labG').textContent = passe ? 'Rentré' : 'Rentrées prévues';
    $('#labD').textContent = passe ? 'Sorti' : 'Sorties prévues';
    poser($('#nG'), chiffre(T.rent, true));
    poser($('#nD'), chiffre(-T.sort));
    $('#subG').textContent = '';
    $('#subD').textContent = `reste ${signe(T.fin, false)} €`;
  }
  rendreJauge(T);
  ajusterChiffres();
}

// sismographe du mois : une barre par jour, rentrées vers le haut, sorties vers le bas
function rendreJauge(T) {
  const n = joursDans(vu);
  const jours = Array.from({ length: n }, () => ({ e: 0, s: 0 }));
  T.L.forEach((o) => { if (!o.saute) jours[o.jour - 1][o.sens > 0 ? 'e' : 's'] += o.montant; });
  const max = Math.max(1, ...jours.map((d) => Math.max(d.e, d.s)));
  const h = (v) => (v ? Math.max(0.06, Math.sqrt(v / max)) : 0).toFixed(3);
  $('#jauge').innerHTML = jours.map((d, i) => {
    const futur = T.etat === 'futur' || (T.etat === 'present' && i + 1 > T.j);
    const auj = T.etat === 'present' && i + 1 === T.j;
    return `<i class="${futur ? 'futur' : ''}${auj ? ' auj' : ''}"><b class="up" style="--h:${h(d.e)}"></b><b class="dn" style="--h:${h(d.s)}"></b></i>`;
  }).join('');
}

function ligne(o, { venir = false, sous = '', max = 1, type = o.type } = {}) {
  const l = o.saute ? 0 : Math.min(1, o.montant / max);
  const cls = ['ligne', o.sens > 0 && 'in', venir && 'venir', o.saute && 'saute'].filter(Boolean).join(' ');
  return `<li><button type="button" class="${cls}" data-type="${type}" data-id="${esc(o.id)}" style="--l:${l.toFixed(3)}">`
    + `<span class="l-jour">${String(o.jour).padStart(2, '0')}</span>${tampon(o)}`
    + `<span class="l-nom"><b>${esc(o.nom)}</b>${sous ? `<small>${esc(sous)}</small>` : ''}</span>`
    + `<span class="l-m">${sg(o.sens * o.montant)}</span></button></li>`;
}

function rendreFil(T) {
  const max = Math.max(1, ...T.L.map((o) => o.montant));
  let html = '';
  let sep = false;
  for (const o of T.L) {
    const venir = T.etat === 'futur' || (T.etat === 'present' && o.jour > T.j);
    if (venir && !sep && T.etat === 'present') { html += '<li class="sep">à venir</li>'; sep = true; }
    const sous = o.type === 'rec' ? (o.saute ? 'pas ce mois-ci' : o.ajuste ? 'montant changé ce mois-ci' : texteRec(o.r)) : '';
    html += ligne(o, { venir, sous, max });
  }
  $('#fil').innerHTML = html;
  $('#videMois').hidden = T.L.length > 0;
}

function rendreRecurrents() {
  const R = D.recurrents.filter(enCours).sort((a, b) => a.jour - b.jour || b.sens - a.sens);
  let s = 0, e = 0;
  R.forEach((r) => { const v = r.montant / (r.freq || 1); if (r.sens > 0) e += v; else s += v; });
  $('#recTotal').innerHTML = R.length
    ? [s && `<b>${sg(-s)}</b> € sortent`, e && `<b>${sg(e)}</b> € rentrent`].filter(Boolean).join(' et ') + ' chaque mois.'
    : 'Aucun pour l’instant. Coche ce que tu as juste en dessous.';
  const max = Math.max(1, ...R.map((r) => r.montant));
  $('#recListe').innerHTML = R.map((r) => ligne({ ...r, jour: r.jour }, { sous: texteRec(r), max, type: 'recdef' })).join('');

  const coches = {};
  R.forEach((r) => { if (r.cat) coches[r.cat] = r; });
  $('#catalogue').innerHTML = CAT.map((g) => `<div class="cat-groupe"><h3>${esc(g.groupe)}</h3><div class="cat-grille">`
    + g.items.map((it) => {
      const r = coches[it.id];
      return `<label class="tuile"><input type="checkbox" data-cat="${it.id}"${r ? ' checked' : ''}>`
        + `<span class="coche">${svg('lu:check')}</span>${tampon({ cat: it.id, sens: g.sens || -1 }, true)}`
        + `<span class="tuile-nom">${esc(it.nom)}</span></label>`;
    }).join('') + '</div></div>').join('');
}

function rendre() {
  const T = totaux(vu);
  rendreBande(T);
  if (vue === 'mois') rendreFil(T);
  if (vue === 'recurrents') rendreRecurrents();
}

function changerVue(v) {
  vue = v;
  document.body.dataset.vue = v;
  $$('.onglet').forEach((b) => { if (b.dataset.vue === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $$('.vue').forEach((s) => { s.hidden = s.id !== 'vue-' + v; });
  rendre();
  window.scrollTo({ top: 0 });
}
function changerMois(n) { vu = n === 0 ? cleAuj() : decaler(vu, n); if (vue !== 'mois') changerVue('mois'); else rendre(); }

/* ---------- toast avec annulation ---------- */
let toastMinuteur = null;
let toastRetour = null;
function toast(texte, annuler) {
  $('#toastTexte').textContent = texte;
  toastRetour = annuler || null;
  $('#toastAnnuler').hidden = !annuler;
  $('#toast').hidden = false;
  clearTimeout(toastMinuteur);
  toastMinuteur = setTimeout(() => { $('#toast').hidden = true; toastRetour = null; }, 6000);
}
function avecAnnulation(texte, fn) {
  const avant = JSON.stringify(D);
  fn();
  sauver(); rendre();
  toast(texte, () => { D = JSON.parse(avant); sauver(); rendre(); });
}

/* ---------- feuille ---------- */
const F = { mode: null, id: null, cat: null };
const dlg = $('#feuille');
const champ = (id, visible) => { $(id).hidden = !visible; };

function remplirJours() {
  $('#fJour').innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">le ${i + 1}</option>`).join('');
}
function dateParDefaut() {
  const t = cleAuj();
  const j = vu === t ? new Date().getDate() : 1;
  return `${vu}-${String(Math.min(j, joursDans(vu))).padStart(2, '0')}`;
}
function sensChoisi() { return Number($('#fForm').querySelector('input[name="sens"]:checked').value); }
function poserSens(s) { $(`#fForm input[name="sens"][value="${s > 0 ? 1 : -1}"]`).checked = true; }

function ouvrir(mode, opts = {}) {
  Object.assign(F, { mode, id: opts.id || null, cat: opts.cat || null });
  const f = $('#fForm');
  f.reset();
  $('#fErreur').hidden = true;
  const r = opts.id && D.recurrents.find((x) => x.id === opts.id);
  const m = opts.id && D.mouvements.find((x) => x.id === opts.id);
  const cat = F.cat || (r && r.cat) || null;
  const c = cat && CAT_INDEX[cat];

  champ('#fMarque', !!c);
  if (c) $('#fMarque').innerHTML = tampon({ cat, sens: c.sens }, true) + `<span>${esc(c.nom)}</span>`;
  champ('#fSens', !c && mode !== 'occ');
  champ('#fNomChamp', !c && mode !== 'occ');
  champ('#fDateChamp', mode === 'nouveau' || mode === 'mvt');
  champ('#fRecChamp', mode === 'nouveau');
  champ('#fRecBloc', mode === 'catalogue' || mode === 'recdef');
  champ('#fAjust', mode === 'occ');
  champ('#fSupprimer', mode === 'mvt' || mode === 'recdef');
  $('#fSupprimer').lastChild.textContent = mode === 'recdef' ? 'Arrêter' : 'Supprimer';

  const titres = { nouveau: 'Nouveau mouvement', mvt: 'Modifier', catalogue: 'Combien, et quand ?', recdef: 'Tous les mois', occ: '' };
  $('#fOk').textContent = mode === 'nouveau' || mode === 'catalogue' ? 'Ajouter' : 'Enregistrer';

  if (mode === 'nouveau') {
    poserSens(-1);
    $('#fDate').value = dateParDefaut();
    $('#fJour').value = String(Number($('#fDate').value.slice(8, 10)));
    $('#fDebut').value = vu;
  }
  if (mode === 'mvt' && m) {
    poserSens(m.sens); $('#fMontant').value = String(m.montant).replace('.', ',');
    $('#fNom').value = m.nom; $('#fDate').value = m.date;
  }
  if (mode === 'catalogue') {
    poserSens(c.sens);
    $('#fJour').value = String(new Date().getDate());
    $('#fFreq').value = '1';
    $('#fDebut').value = cleAuj();
  }
  if (mode === 'recdef' && r) {
    poserSens(r.sens); $('#fMontant').value = String(r.montant).replace('.', ',');
    $('#fNom').value = r.nom; $('#fJour').value = String(r.jour); $('#fFreq').value = String(r.freq || 1);
    $('#fDebut').value = r.debut || ''; $('#fFin').value = r.fin || '';
  }
  if (mode === 'occ' && r) {
    const a = D.ajust[r.id + '|' + vu] || {};
    const montant = a.montant != null ? a.montant : r.montant;
    $('#fMontant').value = String(montant).replace('.', ',');
    $('#fAjustTexte').textContent = `Revient ${texteRec(r).replace(' · ', ', ')}, le ${r.jour}. Ce que tu changes ici ne vaut que pour ${nomMois(vu)}.`;
    $('#fSauter').textContent = a.saute ? 'Le compter ce mois-ci' : 'Pas ce mois-ci';
  }
  $('#fTitre').textContent = mode === 'occ' ? (c ? `En ${nomMois(vu)}` : `${r.nom} en ${nomMois(vu)}`) : titres[mode];
  hydrater(dlg);
  dlg.showModal();
  if (mode === 'nouveau' || mode === 'catalogue') setTimeout(() => $('#fMontant').focus(), 30);
}

function erreur(t) { $('#fErreur').textContent = t; $('#fErreur').hidden = false; $('#fMontant').focus(); }

function enregistrer() {
  const montant = lireMontant($('#fMontant').value);
  if (!(montant > 0)) return erreur('Indique un montant, par exemple 12,50.');
  const sens = sensChoisi();
  const nomSaisi = $('#fNom').value.trim();
  const nomDefaut = sens > 0 ? 'Rentrée' : 'Sortie';
  const fin = $('#fFin').value || '';
  const debutSaisi = $('#fDebut').value || '';
  if (fin && debutSaisi && rang(fin) < rang(debutSaisi)) return erreur('La fin tombe avant le début.');

  if (F.mode === 'nouveau') {
    if ($('#fRec').checked) {
      D.recurrents.push({ id: uid(), nom: nomSaisi || nomDefaut, cat: null, sens, montant, jour: Number($('#fJour').value), freq: Number($('#fFreq').value), debut: debutSaisi || vu, fin });
    } else {
      const date = $('#fDate').value || dateParDefaut();
      D.mouvements.push({ id: uid(), nom: nomSaisi || nomDefaut, cat: null, sens, montant, date });
      vu = date.slice(0, 7);
    }
  } else if (F.mode === 'mvt') {
    const m = D.mouvements.find((x) => x.id === F.id);
    Object.assign(m, { sens, montant, nom: nomSaisi || nomDefaut, date: $('#fDate').value || m.date });
  } else if (F.mode === 'catalogue') {
    const c = CAT_INDEX[F.cat];
    D.recurrents.push({ id: uid(), nom: c.nom, cat: F.cat, sens: c.sens, montant, jour: Number($('#fJour').value), freq: Number($('#fFreq').value), debut: debutSaisi || cleAuj(), fin });
  } else if (F.mode === 'recdef') {
    const r = D.recurrents.find((x) => x.id === F.id);
    Object.assign(r, { montant, jour: Number($('#fJour').value), freq: Number($('#fFreq').value), debut: debutSaisi || r.debut, fin });
    if (!r.cat) Object.assign(r, { sens, nom: nomSaisi || r.nom });
  } else if (F.mode === 'occ') {
    const r = D.recurrents.find((x) => x.id === F.id);
    const k = r.id + '|' + vu;
    const a = { ...(D.ajust[k] || {}) };
    if (montant === r.montant) delete a.montant; else a.montant = montant;
    if (Object.keys(a).length) D.ajust[k] = a; else delete D.ajust[k];
  }
  sauver();
  dlg.close();
  rendre();
}

function terminer(r) {
  if (rang(r.debut || cleAuj()) >= rang(cleAuj())) {
    D.recurrents = D.recurrents.filter((x) => x !== r);
    Object.keys(D.ajust).forEach((k) => { if (k.startsWith(r.id + '|')) delete D.ajust[k]; });
  } else {
    r.fin = decaler(cleAuj(), -1);
  }
}

/* ---------- événements ---------- */
function brancher() {
  remplirJours();
  hydrater();

  $('#prec').addEventListener('click', () => changerMois(-1));
  $('#suiv').addEventListener('click', () => changerMois(1));
  $('#ceMois').addEventListener('click', () => changerMois(0));
  $$('.onglet').forEach((b) => b.addEventListener('click', () => changerVue(b.dataset.vue)));
  $$('[data-aller]').forEach((b) => b.addEventListener('click', () => changerVue(b.dataset.aller)));
  $('#ajouter').addEventListener('click', () => { if (vue !== 'mois') changerVue('mois'); ouvrir('nouveau'); });
  $('#autreRec').addEventListener('click', () => { ouvrir('nouveau'); $('#fRec').checked = true; $('#fRec').dispatchEvent(new Event('change')); });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.ligne');
    if (!b) return;
    if (b.dataset.type === 'mvt') ouvrir('mvt', { id: b.dataset.id });
    else if (b.dataset.type === 'rec') ouvrir('occ', { id: b.dataset.id });
    else if (b.dataset.type === 'recdef') ouvrir('recdef', { id: b.dataset.id });
  });

  $('#catalogue').addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-cat]');
    if (!cb) return;
    const cat = cb.dataset.cat;
    cb.checked = !cb.checked; // l'état réel suit les données, pas le clic
    const r = D.recurrents.find((x) => x.cat === cat && enCours(x));
    if (r) avecAnnulation(`${r.nom} retiré`, () => terminer(r));
    else ouvrir('catalogue', { cat });
  });

  $('#fRec').addEventListener('change', () => {
    const on = $('#fRec').checked;
    champ('#fRecBloc', on); champ('#fDateChamp', !on);
    if (on) { const d = $('#fDate').value; if (d) { $('#fJour').value = String(Number(d.slice(8, 10))); $('#fDebut').value = d.slice(0, 7); } }
  });
  $('#fForm').addEventListener('submit', (e) => { e.preventDefault(); enregistrer(); });
  $('[data-fermer]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('#fSupprimer').addEventListener('click', () => {
    if (F.mode === 'mvt') {
      const m = D.mouvements.find((x) => x.id === F.id);
      dlg.close();
      avecAnnulation(`${m.nom} supprimé`, () => { D.mouvements = D.mouvements.filter((x) => x !== m); });
    } else if (F.mode === 'recdef') {
      const r = D.recurrents.find((x) => x.id === F.id);
      dlg.close();
      avecAnnulation(`${r.nom} arrêté`, () => terminer(r));
    }
  });
  $('#fSauter').addEventListener('click', () => {
    const k = F.id + '|' + vu;
    const a = { ...(D.ajust[k] || {}) };
    if (a.saute) delete a.saute; else a.saute = true;
    if (Object.keys(a).length) D.ajust[k] = a; else delete D.ajust[k];
    sauver(); dlg.close(); rendre();
  });
  $('#fTousMois').addEventListener('click', () => { const id = F.id; dlg.close(); ouvrir('recdef', { id }); });

  $('#toastAnnuler').addEventListener('click', () => { const f = toastRetour; $('#toast').hidden = true; toastRetour = null; if (f) f(); });

  $('#exporter').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mois-copie-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#importer').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const o = JSON.parse(await file.text());
      if (!valide(o)) throw new Error('format');
      avecAnnulation('Copie reprise', () => { D = Object.assign(vierge(), o); });
    } catch (err) { toast('Ce fichier n’est pas une copie de Mois.'); }
  });
  $('#effacer').addEventListener('click', () => avecAnnulation('Tout est effacé', () => { D = vierge(); }));

  // glisser sur le bandeau pour changer de mois
  let x0 = null, y0 = null;
  const bande = $('#bande');
  bande.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  bande.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changerMois(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', (e) => {
    if (dlg.open || e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') changerMois(-1);
    if (e.key === 'ArrowRight') changerMois(1);
  });

  window.addEventListener('resize', () => { ajusterTitre(); ajusterChiffres(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rendre(); });
  if (document.fonts) document.fonts.ready.then(() => { ajusterTitre(); ajusterChiffres(); });
}

brancher();
rendre();
ajusterTitre();

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// accès pour les tests
window.MOIS_APP = { get donnees() { return D; }, set donnees(o) { D = Object.assign(vierge(), o); sauver(); rendre(); }, rendre, changerVue, changerMois, ouvrir };
})();
