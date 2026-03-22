/**
 * actionHandlers.js
 * Pure handler stubs per action type.
 * Each returns a partial result shape.
 */

export function noopResult(notes) {
  return {
    executed: true,
    executionMode: 'noop',
    result: { articleChanged: false, metadataChanged: false, newVersion: null, notes: notes || [] },
    rollback: { applied: false, reason: null },
  };
}

export function prepareOnlyResult(notes) {
  return {
    executed: false,
    executionMode: 'prepare_only',
    result: { articleChanged: false, metadataChanged: false, newVersion: null, notes: notes || [] },
    rollback: { applied: false, reason: null },
  };
}

export function rollbackResult(reason, notes) {
  return {
    executed: true,
    executionMode: 'content_update',
    result: { articleChanged: false, metadataChanged: false, newVersion: null, notes: notes || [] },
    rollback: { applied: true, reason: reason || 'score degraded' },
  };
}
