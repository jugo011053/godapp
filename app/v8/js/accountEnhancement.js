import { getState, updateState, silentUpdate } from './core/store.js';
import { on, emit } from './core/events.js';
import { haptic } from './core/feel.js';
import { showToast as rawToast } from './core/toast.js';
import {
  isSignedIn, currentUser, signIn, signUp, signOut, validatePassword
} from './features/auth/account.js';
import { syncNow } from './features/sync/userSync.js';
import {
  currentHousehold, createHousehold, joinHousehold, leaveHousehold, formatInviteCode
} from './features/household/household.js';

/* Konto und Haushalt sitzen im Profil, also im Nebenmenue — die Hauptseiten
   bleiben gross und einfach. Ohne Konto funktioniert die App unveraendert
   weiter; das Konto ist ein Zugewinn, keine Schranke. */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
));

const ui = { household: null, householdLoaded: false, syncing: false };

/* showToast erwartet den Behaelter als erstes Argument. Hier immer der Body,
   weil die Meldungen ueber der ganzen Seite liegen. */
const showToast = (message) => rawToast(document.body, message);

function closeOverlay(overlay) {
  overlay?.remove();
}

function appendSheet(root, content) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-menu-overlay';
  overlay.dataset.dismissible = 'true';
  overlay.innerHTML = content;
  root.appendChild(overlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay(overlay);
  });
  overlay.querySelectorAll('[data-sheet-close]').forEach((button) =>
    button.addEventListener('click', () => closeOverlay(overlay)));
  return overlay;
}

function relativeTime(iso) {
  if (!iso) return 'noch nie';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.round(hours / 24)} Tagen`;
}

/* --- Anmeldung ---------------------------------------------------------- */

function authSheet(root, mode = 'signin') {
  const isRegister = mode === 'signup';
  const overlay = appendSheet(root, `<section class="v8-dialog plan-menu-sheet account-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <div class="sheet-head">
      <h2 id="account-title">${isRegister ? 'Konto anlegen' : 'Anmelden'}</h2>
      <button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button>
    </div>
    <p class="account-copy">${isRegister
      ? 'Damit liegen Profil, Favoriten und Plan nicht mehr nur auf diesem Gerät — und ihr könnt euch einen Haushalt teilen.'
      : 'Melde dich an, um deine Daten auf diesem Gerät weiterzuführen.'}</p>
    <form class="account-form" data-account-form novalidate>
      <label class="master-form-field">
        <span>E-Mail</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required>
      </label>
      <label class="master-form-field">
        <span>Passwort</span>
        <input type="password" name="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required>
      </label>
      ${isRegister ? '<p class="master-form-hint">Mindestens acht Zeichen.</p>' : ''}
      <p class="account-error" data-account-error hidden></p>
      <button class="sheet-action primary" type="submit">${isRegister ? 'Konto anlegen' : 'Anmelden'}</button>
    </form>
    <button class="account-switch" type="button" data-account-switch="${isRegister ? 'signin' : 'signup'}">
      ${isRegister ? 'Ich habe schon ein Konto' : 'Noch kein Konto? Eins anlegen'}
    </button>
  </section>`);

  overlay.querySelector('[data-account-switch]').addEventListener('click', (event) => {
    closeOverlay(overlay);
    authSheet(root, event.currentTarget.dataset.accountSwitch);
  });

  const errorBox = overlay.querySelector('[data-account-error]');
  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  };

  overlay.querySelector('[data-account-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const button = event.currentTarget.querySelector('button[type="submit"]');

    if (!email.includes('@')) return showError('Bitte gib eine gültige E-Mail-Adresse ein.');
    if (isRegister) {
      const problem = validatePassword(password);
      if (problem) return showError(problem);
    }

    showError('');
    button.disabled = true;
    button.textContent = 'Einen Moment …';

    try {
      if (isRegister) {
        const result = await signUp(email, password);
        if (result.needsConfirmation) {
          closeOverlay(overlay);
          showToast('Prüf dein Postfach — wir haben dir einen Bestätigungslink geschickt.');
          return;
        }
      } else {
        await signIn(email, password);
      }
      closeOverlay(overlay);
      haptic('confirm');
      await runSync({ announce: true });
    } catch (error) {
      showError(error.message || 'Das hat nicht geklappt.');
      button.disabled = false;
      button.textContent = isRegister ? 'Konto anlegen' : 'Anmelden';
    }
  });

  overlay.querySelector('input[name="email"]')?.focus();
}

/* --- Synchronisieren ---------------------------------------------------- */

async function runSync({ announce = false } = {}) {
  if (!isSignedIn() || ui.syncing) return;
  ui.syncing = true;
  emit('account:changed', {});
  try {
    const merged = await syncNow(getState());
    /* Der zusammengefuehrte Zustand ersetzt den lokalen — replaceState waere
       zu grob, updateState loest den normalen Renderdurchlauf aus. */
    updateState(() => ({ ...merged, lastSyncAt: new Date().toISOString() }));
    if (announce) showToast('Gesichert. Deine Daten liegen jetzt auch im Konto.');
  } catch (error) {
    console.warn('[Preply] Synchronisierung', error);
    if (announce) showToast(error.message || 'Synchronisierung fehlgeschlagen.');
  } finally {
    ui.syncing = false;
    emit('account:changed', {});
  }
}

/* --- Haushalt ----------------------------------------------------------- */

async function loadHousehold({ force = false } = {}) {
  if (!isSignedIn()) { ui.household = null; ui.householdLoaded = true; return; }
  if (ui.householdLoaded && !force) return;
  try {
    ui.household = await currentHousehold();
  } catch { ui.household = null; }
  ui.householdLoaded = true;
  emit('account:changed', {});
}

function householdSheet(root) {
  const overlay = appendSheet(root, `<section class="v8-dialog plan-menu-sheet account-sheet" role="dialog" aria-modal="true" aria-labelledby="hh-title">
    <div class="sheet-head">
      <h2 id="hh-title">Haushalt</h2>
      <button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button>
    </div>
    <p class="account-copy">Ein gemeinsamer Haushalt heißt: ein Plan, eine Einkaufsliste. Was einer abhakt, ist auch beim anderen abgehakt.</p>
    <button class="sheet-action primary" type="button" data-hh-create>Haushalt erstellen</button>
    <form class="account-form" data-hh-join-form novalidate style="margin-top:18px">
      <label class="master-form-field">
        <span>Oder mit Code beitreten</span>
        <input type="text" name="code" placeholder="PREP-XXXXXX" autocapitalize="characters" autocomplete="off" spellcheck="false">
      </label>
      <p class="account-error" data-hh-error hidden></p>
      <button class="sheet-action" type="submit">Beitreten</button>
    </form>
  </section>`);

  const errorBox = overlay.querySelector('[data-hh-error]');
  const showError = (message) => { errorBox.textContent = message; errorBox.hidden = !message; };

  overlay.querySelector('[data-hh-create]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await createHousehold();
      await loadHousehold({ force: true });
      closeOverlay(overlay);
      haptic('confirm');
      showToast('Haushalt steht. Gib den Code weiter.');
    } catch (error) {
      showError(error.message);
      event.currentTarget.disabled = false;
    }
  });

  overlay.querySelector('[data-hh-join-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') || '');
    showError('');
    try {
      await joinHousehold(code);
      await loadHousehold({ force: true });
      closeOverlay(overlay);
      haptic('confirm');
      showToast('Du bist dabei.');
    } catch (error) {
      showError(error.message);
    }
  });
}

/* --- Abschnitt im Profil ------------------------------------------------ */

function sectionHtml() {
  const state = getState();
  const user = currentUser();

  if (!user) {
    return `<section class="master-profile-section">
      <h2>Konto</h2>
      <p class="account-note">Deine Daten liegen nur auf diesem Gerät. Mit einem Konto überstehen sie einen Gerätewechsel — und du kannst einen Haushalt teilen.</p>
      <button class="master-profile-row action" type="button" data-account-open><span>Konto anlegen oder anmelden</span><strong>›</strong></button>
    </section>`;
  }

  const household = ui.household;
  const members = household?.household_members?.length || 0;

  return `<section class="master-profile-section">
    <h2>Konto</h2>
    <div class="master-profile-row"><span>Angemeldet als</span><strong>${esc(user.email)}</strong></div>
    <div class="master-profile-row"><span>Zuletzt gesichert</span><strong>${esc(ui.syncing ? 'läuft …' : relativeTime(state.lastSyncAt))}</strong></div>
    <button class="master-profile-row action" type="button" data-account-sync ${ui.syncing ? 'disabled' : ''}><span>Jetzt sichern</span><strong>${ui.syncing ? '…' : '↻'}</strong></button>

    <h2 style="margin-top:22px">Haushalt</h2>
    ${household
      ? `<div class="master-profile-row"><span>Einladungscode</span><strong>${esc(formatInviteCode(household.invite_code))}</strong></div>
         <div class="master-profile-row"><span>Mitglieder</span><strong>${members}</strong></div>
         <button class="master-profile-row action" type="button" data-hh-copy><span>Code kopieren</span><strong>›</strong></button>
         <button class="master-profile-row action" type="button" data-hh-leave><span>Haushalt verlassen</span><strong>›</strong></button>`
      : `<p class="account-note">Noch kein gemeinsamer Haushalt. Ein Plan, eine Einkaufsliste, zwei Telefone.</p>
         <button class="master-profile-row action" type="button" data-hh-open><span>Haushalt erstellen oder beitreten</span><strong>›</strong></button>`}

    <button class="master-profile-row action" type="button" data-account-signout style="margin-top:14px"><span>Abmelden</span><strong>›</strong></button>
  </section>`;
}

export function refreshAccount(root) {
  const main = root.querySelector('.v8-main');
  if (!main) return;
  const anchor = main.querySelector('.master-profile-edit-button');
  if (!anchor) return;

  let section = main.querySelector('[data-account-section]');
  if (!section) {
    section = document.createElement('div');
    section.dataset.accountSection = 'true';
    anchor.insertAdjacentElement('beforebegin', section);
  }
  section.innerHTML = sectionHtml();

  if (isSignedIn() && !ui.householdLoaded) void loadHousehold();

  section.querySelector('[data-account-open]')?.addEventListener('click', () => {
    haptic('tap');
    authSheet(root, 'signup');
  });
  section.querySelector('[data-account-sync]')?.addEventListener('click', () => {
    haptic('tap');
    void runSync({ announce: true });
  });
  section.querySelector('[data-hh-open]')?.addEventListener('click', () => {
    haptic('tap');
    householdSheet(root);
  });
  section.querySelector('[data-hh-copy]')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(formatInviteCode(ui.household?.invite_code)).catch(() => {});
    showToast('Code kopiert.');
  });
  section.querySelector('[data-hh-leave]')?.addEventListener('click', async () => {
    await leaveHousehold(ui.household.id);
    await loadHousehold({ force: true });
    showToast('Haushalt verlassen.');
  });
  section.querySelector('[data-account-signout]')?.addEventListener('click', async () => {
    await signOut();
    ui.household = null;
    ui.householdLoaded = false;
    showToast('Abgemeldet. Deine Daten bleiben auf dem Gerät.');
  });
}

let initialized = false;

export function initializeAccount() {
  if (initialized) return;
  initialized = true;

  /* Beim Start einmal stillschweigend abgleichen, wenn eine Sitzung liegt. */
  if (isSignedIn()) {
    void loadHousehold();
    void runSync();
  }

  on('auth:changed', () => {
    ui.household = null;
    ui.householdLoaded = false;
  });

  /* Lokale Aenderungen wandern nach kurzer Ruhe ins Konto. Ohne Entprellung
     schriebe jeder Tastendruck im Profil eine eigene Anfrage. */
  let timer = null;
  on('state:changed', () => {
    if (!isSignedIn() || ui.syncing) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void runSync(); }, 4000);
  });
}

export { runSync };
