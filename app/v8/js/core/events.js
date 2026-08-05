const listeners = new Map();

export function on(eventName, handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);
  return () => listeners.get(eventName)?.delete(handler);
}

export function emit(eventName, payload) {
  listeners.get(eventName)?.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[Preply V8] Event-Fehler bei ${eventName}`, error);
    }
  });
}
