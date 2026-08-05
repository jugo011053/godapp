export function shouldOfferAccount(state) {
  return Boolean(
    !state?.auth?.userId &&
    (state?.currentPlan || state?.planHistory?.length || state?.preferences?.favoriteRecipeIds?.length)
  );
}

export function createSyncState() {
  return {
    status: 'local_only',
    lastSuccessfulSyncAt: null,
    lastError: null,
    pendingLocalChanges: false
  };
}

export function reduceSyncStatus(syncState = createSyncState(), event) {
  const next = { ...syncState };
  if (event?.type !== 'sync') return next;

  if (event.status === 'ok') {
    next.status = 'synced';
    next.lastSuccessfulSyncAt = new Date().toISOString();
    next.lastError = null;
    next.pendingLocalChanges = false;
    return next;
  }

  if (event.status === 'offline' || event.status === 'offline_or_failed') {
    next.status = 'offline';
    next.lastError = 'Keine Verbindung. Lokale Änderungen bleiben erhalten.';
    next.pendingLocalChanges = true;
    return next;
  }

  if (event.status === 'failed') {
    next.status = 'error';
    next.lastError = `Synchronisierung fehlgeschlagen${event.httpStatus ? ` (${event.httpStatus})` : ''}.`;
    next.pendingLocalChanges = true;
  }
  return next;
}

export function mergeLocalStateIntoRemote(localState, remoteState = {}) {
  const remoteHistory = Array.isArray(remoteState.planHistory) ? remoteState.planHistory : [];
  const localHistory = Array.isArray(localState.planHistory) ? localState.planHistory : [];
  const historyMap = new Map();
  [...remoteHistory, ...localHistory].forEach((entry) => historyMap.set(entry.id, entry));

  return {
    ...remoteState,
    ...localState,
    profile: { ...(remoteState.profile || {}), ...(localState.profile || {}) },
    preferences: {
      ...(remoteState.preferences || {}),
      ...(localState.preferences || {}),
      favoriteRecipeIds: [...new Set([
        ...(remoteState.preferences?.favoriteRecipeIds || []),
        ...(localState.preferences?.favoriteRecipeIds || [])
      ])],
      excludedRecipeIds: [...new Set([
        ...(remoteState.preferences?.excludedRecipeIds || []),
        ...(localState.preferences?.excludedRecipeIds || [])
      ])]
    },
    planHistory: [...historyMap.values()]
      .sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')))
      .slice(0, 12)
  };
}
