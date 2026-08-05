import { emit } from './events.js';
import { createEmptyState, loadState, saveState } from './storage.js';

let state = createEmptyState();
let initialized = false;

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function initializeStore() {
  if (!initialized) {
    state = loadState();
    initialized = true;
    emit('state:initialized', clone(state));
  }
  return getState();
}

export function getState() {
  return clone(state);
}

export function replaceState(nextState, { persist = true } = {}) {
  state = { ...createEmptyState(), ...clone(nextState) };
  if (persist) saveState(state);
  emit('state:changed', getState());
  return getState();
}

export function updateState(updater, { persist = true } = {}) {
  if (typeof updater !== 'function') {
    throw new TypeError('updateState benötigt eine Funktion.');
  }
  const draft = getState();
  const result = updater(draft);
  return replaceState(result === undefined ? draft : result, { persist });
}

export function resetState() {
  return replaceState(createEmptyState());
}
