// Code partagé par toutes les pages
const CFG = window.FIDELE || {};
const CONFIGURED = !!CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes('XXXX') && !!window.supabase;
const sb = CONFIGURED ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY) : null;

const $ = (s, root) => (root || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const param = k => new URLSearchParams(location.search).get(k);
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

function toast(t) {
  let e = $('#toast');
  if (!e) { e = document.createElement('div'); e.id = 'toast'; e.className = 'toast'; document.body.appendChild(e); }
  e.textContent = t; e.classList.add('on');
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2600);
}

function setAccent(color) {
  if (/^#[0-9a-f]{6}$/i.test(color || '')) document.documentElement.style.setProperty('--accent', color);
}

function notConfigured(mount) {
  mount.innerHTML = '<div class="panel"><h3>Configuration manquante</h3><p class="small" style="margin-top:6px">Renseigne l’URL et la clé Supabase dans <b>config.js</b> (voir le README).</p></div>';
}

const ERRORS = {
  resto_inconnu: 'Restaurant introuvable.',
  prenom_invalide: 'Indique ton prénom.',
  telephone_invalide: 'Numéro de téléphone invalide.',
  deja_inscrit: 'Ce numéro a déjà une carte ici. Demande au serveur de te la réafficher.',
  reessayer: 'Petit souci, réessaie.',
  non_connecte: 'Session expirée, reconnecte-toi.',
  carte_inconnue: 'Carte inconnue pour ce restaurant.',
  aucune_recompense: 'Aucune récompense à utiliser.',
  recompense_inconnue: 'Récompense introuvable.',
  points_insuffisants: 'Pas assez de points.',
  epuise: 'Cette récompense est épuisée.'
};
const errText = code => ERRORS[code] || 'Erreur : ' + code;

const ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7L12 17.3 5.7 21.2l1.7-7L2 9.5l7.1-.6z"/></svg>';
const ICON_GIFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/></svg>';

// Restaurants avec un visuel à eux (images dans le dossier img/ du site)
const BRANDS = { 'casa-di-meco': 1 };
function brandImg(slug, kind) { return 'img/' + slug + '-' + kind + '.jpg'; }

// Carte façon Wallet. card = {first_name, code, points, resto:{name, slug, color}, catalog:[{name, cost, stock}]}
function cardHTML(card) {
  const r = card.resto, cat = card.catalog || [];
  const next = cat.find(w => w.cost > card.points && w.stock !== 0);
  const pct = next ? Math.min(100, card.points / next.cost * 100) : 100;
  const bar = next ? '<div style="height:8px;border-radius:99px;background:rgba(255,255,255,.25);overflow:hidden;margin:10px 0 6px"><b style="display:block;height:100%;width:' + pct + '%;background:#fff;border-radius:99px"></b></div>' +
      '<div style="font-size:13px;margin-bottom:16px">Encore ' + (next.cost - card.points) + ' pts pour : ' + esc(next.name) + '</div>' : '<div style="height:16px"></div>';
  if (BRANDS[r.slug]) return '<div class="wallet" style="padding:0;overflow:hidden;background:' + esc(r.color) + '">' +
    '<img src="' + brandImg(r.slug, 'wide') + '" alt="" style="display:block;width:100%;height:110px;object-fit:cover">' +
    '<div style="padding:18px 20px 20px"><img src="' + brandImg(r.slug, 'hero') + '" alt="' + esc(r.name) + '" style="display:block;height:74px;margin:0 auto 4px">' +
    '<div class="row sp" style="align-items:flex-end;margin-top:8px"><div><div class="lbl">Mes points</div><div style="font-family:Fraunces,Georgia,serif;font-size:52px;font-weight:600;line-height:1.05">' + card.points + '</div></div>' +
    '<div style="text-align:right"><div class="lbl">Membre</div><div class="val">' + esc(card.first_name) + '</div></div></div>' +
    bar + '<div class="qrbox"><div id="qr"></div><div class="code">' + esc(card.code) + '</div></div></div></div>';
  return '<div class="wallet">' +
    '<div class="row sp" style="align-items:flex-start"><div class="logo">' + esc(r.name) + '</div>' +
    '<div style="text-align:right"><div class="lbl">Membre</div><div class="val">' + esc(card.first_name) + '</div></div></div>' +
    '<div style="margin:22px 0 4px"><div class="lbl">Mes points</div><div style="font-family:Fraunces,Georgia,serif;font-size:52px;font-weight:600;line-height:1.05">' + card.points + '</div></div>' +
    (next ? '<div style="height:8px;border-radius:99px;background:rgba(255,255,255,.25);overflow:hidden;margin:10px 0 6px"><b style="display:block;height:100%;width:' + pct + '%;background:#fff;border-radius:99px"></b></div>' +
      '<div style="font-size:13px;margin-bottom:16px">Encore ' + (next.cost - card.points) + ' pts pour : ' + esc(next.name) + '</div>' : '<div style="height:16px"></div>') +
    '<div class="qrbox"><div id="qr"></div><div class="code">' + esc(card.code) + '</div></div>' +
    '</div>';
}

// Liste des récompenses sous la carte du client
function catalogHTML(card) {
  const cat = card.catalog || [];
  if (!cat.length) return '';
  return '<div class="panel" style="padding:14px 16px"><div class="eyebrow" style="margin-bottom:4px">Mes récompenses</div>' +
    '<p class="small" style="margin-bottom:8px">Échange tes points au comptoir quand tu veux, ou continue à cumuler.</p>' +
    cat.map(w => {
      const ok = card.points >= w.cost && w.stock !== 0;
      const tag = w.stock === 0 ? '<span class="pill">Épuisé</span>' : ok ? '<span class="pill gift">Disponible</span>' : '<span class="pill">Encore ' + (w.cost - card.points) + ' pts</span>';
      return '<div class="row sp" style="padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><div class="name" style="font-size:14px">' + esc(w.name) + '</div>' +
        '<div class="small">' + w.cost + ' pts' + (w.stock > 0 ? ' · ' + w.stock + ' place' + (w.stock > 1 ? 's' : '') + ' restante' + (w.stock > 1 ? 's' : '') : '') + '</div></div>' + tag + '</div>';
    }).join('') + '</div>';
}

function drawQR(el, text, size) {
  if (!el || !window.QRCode) return;
  el.innerHTML = '';
  new QRCode(el, { text: text, width: size || 160, height: size || 160, colorDark: '#1C1A17', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
}

// Connexion du staff. Appelle onReady() une fois connecté.
async function requireStaff(mount, onReady) {
  if (!CONFIGURED) return notConfigured(mount);
  const { data } = await sb.auth.getSession();
  if (data && data.session) return onReady();
  mount.innerHTML =
    '<h1>Connexion</h1><p class="small" style="margin-bottom:16px">Espace réservé à l’équipe du restaurant.</p>' +
    '<div class="panel"><form id="loginForm">' +
    '<div class="field"><label for="lgEmail">Email</label><input id="lgEmail" type="email" required autocomplete="username"></div>' +
    '<div class="field"><label for="lgPass">Mot de passe</label><input id="lgPass" type="password" required autocomplete="current-password"></div>' +
    '<button class="btn" type="submit">Se connecter</button><div class="err hide" id="lgErr"></div></form></div>';
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginForm button'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('#lgEmail').value.trim(), password: $('#lgPass').value });
    btn.disabled = false;
    if (error) { const el = $('#lgErr'); el.textContent = 'Email ou mot de passe incorrect.'; el.classList.remove('hide'); return; }
    mount.innerHTML = '';
    onReady();
  });
}

async function logout() { await sb.auth.signOut(); location.reload(); }

// Google Wallet (fonction Supabase "wallet")
const IS_ANDROID = /Android/i.test(navigator.userAgent);
async function walletCall(action, token) {
  const r = await fetch(CFG.SUPABASE_URL + '/functions/v1/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_KEY },
    body: JSON.stringify({ action: action, token: token })
  });
  return r.json();
}
