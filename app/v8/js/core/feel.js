/* Haptik und Gesten. Alles hier ist Beiwerk: Wenn ein Browser etwas nicht
   kann, bleibt die Bedienung per Tippen unverändert vollständig. */

const reduceMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/* iOS/Safari kennt die Vibration API nicht — dort passiert schlicht nichts.
   Android und die meisten Desktop-Browser mit Motor geben Rückmeldung. */
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const PATTERNS = {
  tap: 8,          // Auswahl, Umschalten
  confirm: [0, 14],// abgehakt, favorisiert
  strong: [0, 22], // Plan erstellt, Gericht getauscht
  warn: [0, 12, 60, 12]
};

export function haptic(kind = 'tap') {
  if (!canVibrate || reduceMotion()) return;
  try {
    navigator.vibrate(PATTERNS[kind] ?? PATTERNS.tap);
  } catch {
    /* Manche Browser werfen ohne vorherige Nutzergeste — unkritisch. */
  }
}

function pointerY(event) {
  return event.touches?.[0]?.clientY ?? event.clientY ?? 0;
}
function pointerX(event) {
  return event.touches?.[0]?.clientX ?? event.clientX ?? 0;
}

/* Bottom-Sheet nach unten wegziehen. Schliesst ueber einen Klick auf den
   Hintergrund, damit die Aufraeumlogik des jeweiligen Sheets greift statt
   den Knoten nur zu entfernen. */
export function enableSheetDismiss(overlay) {
  const sheet = overlay.querySelector('.v8-dialog');
  if (!sheet || sheet.dataset.dragBound === 'true') return;
  sheet.dataset.dragBound = 'true';

  if (!sheet.querySelector('.sheet-grabber')) {
    const grabber = document.createElement('span');
    grabber.className = 'sheet-grabber';
    grabber.setAttribute('aria-hidden', 'true');
    sheet.prepend(grabber);
  }

  let startY = 0;
  let delta = 0;
  let dragging = false;

  const start = (event) => {
    /* Nur ziehen, wenn das Sheet oben steht — sonst will der Finger scrollen. */
    if (sheet.scrollTop > 0) return;
    startY = pointerY(event);
    delta = 0;
    dragging = true;
    overlay.dataset.dragging = 'true';
    overlay.removeAttribute('data-settling');
  };

  const move = (event) => {
    if (!dragging) return;
    delta = pointerY(event) - startY;
    if (delta < 0) delta = 0;
    if (delta > 0 && event.cancelable) event.preventDefault();
    sheet.style.transform = `translateY(${delta}px)`;
    overlay.style.opacity = String(Math.max(0.35, 1 - delta / 460));
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    overlay.removeAttribute('data-dragging');
    overlay.dataset.settling = 'true';

    const far = delta > Math.min(140, sheet.offsetHeight * 0.28);
    if (far) {
      haptic('tap');
      sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
      overlay.style.opacity = '0';
      setTimeout(() => {
        /* Loest die Schliesslogik aus, die das Sheet selbst registriert hat. */
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: false }));
        /* Falls dieses Sheet keinen Hintergrund-Klick kennt: zuruecksetzen,
           damit es nicht unsichtbar stehen bleibt. */
        if (overlay.isConnected) {
          overlay.style.opacity = '';
          sheet.style.transform = '';
          overlay.removeAttribute('data-settling');
        }
      }, 200);
      return;
    }

    sheet.style.transform = '';
    overlay.style.opacity = '';
    setTimeout(() => overlay.removeAttribute('data-settling'), 240);
  };

  const grabber = sheet.querySelector('.sheet-grabber');
  for (const target of [grabber, sheet]) {
    target.addEventListener('touchstart', start, { passive: true });
    target.addEventListener('touchmove', move, { passive: false });
    target.addEventListener('touchend', end);
    target.addEventListener('touchcancel', end);
  }
  grabber.addEventListener('mousedown', (event) => {
    start(event);
    const mm = (e) => move(e);
    const mu = () => {
      end();
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
}

/* Zeile waagerecht wischen, um sie umzuschalten. Die Achse wird nach den
   ersten Pixeln festgelegt, damit senkrechtes Scrollen Vorrang behaelt. */
export function enableSwipeToggle(row, onToggle) {
  if (!row || row.dataset.swipeBound === 'true') return;
  row.dataset.swipeBound = 'true';

  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let axis = null;

  row.addEventListener('touchstart', (event) => {
    x0 = pointerX(event);
    y0 = pointerY(event);
    dx = 0;
    axis = null;
    row.removeAttribute('data-settling');
  }, { passive: true });

  row.addEventListener('touchmove', (event) => {
    const ndx = pointerX(event) - x0;
    const ndy = pointerY(event) - y0;
    if (!axis) {
      if (Math.abs(ndx) < 10 && Math.abs(ndy) < 10) return;
      axis = Math.abs(ndx) > Math.abs(ndy) ? 'x' : 'y';
    }
    if (axis !== 'x') return;
    if (event.cancelable) event.preventDefault();
    dx = ndx;
    row.dataset.swiping = 'true';
    row.style.transform = `translateX(${dx}px)`;
    row.dataset.swipeActive = Math.abs(dx) > 64 ? 'true' : 'false';
  }, { passive: false });

  const finish = () => {
    row.removeAttribute('data-swiping');
    if (axis === 'x' && Math.abs(dx) > 64) {
      haptic('confirm');
      onToggle();
    }
    row.dataset.settling = 'true';
    row.style.transform = '';
    row.dataset.swipeActive = 'false';
    setTimeout(() => row.removeAttribute('data-settling'), 220);
    axis = null;
    dx = 0;
  };

  row.addEventListener('touchend', finish);
  row.addEventListener('touchcancel', finish);
}

/* Ein Beobachter statt acht Einbauorte: Jedes Sheet, das sich als
   wegwischbar meldet, bekommt Griff und Geste automatisch. */
export function initFeel(root = document.body) {
  const attach = (node) => {
    if (node.nodeType !== 1) return;
    const overlays = node.matches?.('.v8-overlay[data-dismissible]')
      ? [node]
      : [...(node.querySelectorAll?.('.v8-overlay[data-dismissible]') || [])];
    overlays.forEach(enableSheetDismiss);
  };

  new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(attach);
  }).observe(root, { childList: true, subtree: true });

  attach(root);
}
