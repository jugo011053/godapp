/* Kurze Rueckmeldung am unteren Rand, wahlweise mit einer Handlung.
   Eine Neuplanung ohne "Rueckgaengig" waere unwiderruflich — und genau das
   macht sie fuer den Nutzer bedrohlich. */

let current = null;

function dismiss() {
  if (!current) return;
  const node = current;
  current = null;
  node.classList.remove('visible');
  setTimeout(() => node.remove(), 260);
}

export function showToast(root, message, options = {}) {
  /* Der erste Parameter ist der Behaelter, nicht der Text — eine Stolperstelle,
     in die man beim Aufrufen leicht tritt. Wer nur eine Nachricht uebergibt,
     bekommt sie trotzdem zu sehen. */
  if (typeof root === 'string') {
    options = message && typeof message === 'object' ? message : {};
    message = root;
    root = null;
  }
  const host = root instanceof Element || root instanceof Document ? root : document.body;
  host.querySelectorAll('.preply-toast').forEach((node) => node.remove());

  const toast = document.createElement('div');
  toast.className = 'preply-toast';

  const text = document.createElement('span');
  text.className = 'preply-toast-text';
  text.textContent = message;
  toast.appendChild(text);

  const timeout = Number(options.duration || (options.actionLabel ? 7000 : 2800));

  if (options.actionLabel && typeof options.onAction === 'function') {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'preply-toast-action';
    action.textContent = options.actionLabel;
    action.addEventListener('click', () => {
      clearTimeout(toast._timer);
      dismiss();
      options.onAction();
    });
    toast.appendChild(action);
  }

  host.appendChild(toast);
  current = toast;
  requestAnimationFrame(() => toast.classList.add('visible'));
  toast._timer = setTimeout(dismiss, timeout);
  return toast;
}
