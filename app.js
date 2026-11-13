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
  aucune_recompense: 'Aucune récompense à utiliser.'
};
const errText = code => ERRORS[code] || 'Erreur : ' + code;

const ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7L12 17.3 5.7 21.2l1.7-7L2 9.5l7.1-.6z"/></svg>';
const ICON_GIFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/></svg>';

// Carte façon Wallet. card = {first_name, code, stamps, rewards, resto:{name, goal, reward, color}}
function cardHTML(card) {
  const r = card.resto;
  let st = '';
  for (let i = 0; i < r.goal; i++) {
    const on = i < card.stamps, last = i === r.goal - 1;
    st += '<div class="stamp ' + (on ? 'on' : '') + (last && !on ? ' gift' : '') + '">' + (on ? ICON_STAR : (last ? ICON_GIFT : '')) + '</div>';
  }
  return '<div class="wallet">' +
    '<div class="row sp" style="align-items:flex-start"><div class="logo">' + esc(r.name) + '</div>' +
    '<div style="text-align:right"><div class="lbl">Tampons</div><div class="val">' + card.stamps + ' / ' + r.goal + '</div></div></div>' +
    '<div class="stamps">' + st + '</div>' +
    (card.rewards ? '<div class="reward-banner">🎁 ' + esc(r.reward) + ' à récupérer' + (card.rewards > 1 ? ' ×' + card.rewards : '') + '</div>' : '') +
    '<div class="row sp" style="margin-bottom:14px"><div><div class="lbl">Membre</div><div class="val">' + esc(card.first_name) + '</div></div>' +
    '<div style="text-align:right"><div class="lbl">Récompense</div><div class="val">' + esc(r.reward) + '</div></div></div>' +
    '<div class="qrbox"><div id="qr"></div><div class="code">' + esc(card.code) + '</div></div>' +
    '</div>';
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
