export const SHOW_ACTION_LIFECYCLE_VERSION = 'symbiote-show-action-lifecycle-v1';

function abortError(reason) {
  if (reason instanceof Error) return reason;
  let error = new Error(String(reason || 'show action cancelled'));
  error.name = 'AbortError';
  return error;
}

function serializable(value) {
  if (value === undefined) return undefined;
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function phaseReceipt(phase, status, result) {
  let cloned = serializable(result);
  return Object.freeze({
    phase,
    status,
    ...(cloned === undefined ? {} : { result: cloned }),
  });
}

/**
 * Product-neutral orchestration for actions whose target can live inside a
 * collapsed panel or a mobile drawer. Consumers inject state and DOM adapters;
 * the provider owns ordering, cancellation, stale suppression, and restoration.
 */
export class ShowActionLifecycle {
  constructor(adapter = {}) {
    this._adapter = Object.freeze({ ...adapter });
    this._sequence = 0;
    this._current = null;
  }

  get snapshot() {
    let operation = this._current;
    return Object.freeze({
      version: SHOW_ACTION_LIFECYCLE_VERSION,
      active: Boolean(operation),
      operationId: operation?.id || '',
      phase: operation?.phase || '',
      reason: operation?.reason || '',
    });
  }

  run(action, context = {}) {
    let previous = this._current;
    if (previous) {
      return this._cancelOperation(previous, 'replacement', { restore: true })
        .then(() => this.run(action, context));
    }

    let controller = new AbortController();
    let operation = {
      id: `show-action-${++this._sequence}`,
      action,
      context,
      controller,
      phase: 'inspect',
      phases: [],
      reason: '',
      restore: true,
      userSuperseded: false,
      inspected: undefined,
      reveal: undefined,
      target: undefined,
      result: undefined,
      done: null,
    };
    this._current = operation;
    operation.done = this._execute(operation);
    return operation.done;
  }

  cancel(reason = 'cancelled', options = {}) {
    if (!this._current) return Promise.resolve(null);
    return this._cancelOperation(this._current, reason, {
      restore: options.restore !== false,
      userSuperseded: options.userSuperseded === true,
    });
  }

  pause() { return this.cancel('pause'); }
  stop() { return this.cancel('stop'); }
  seek() { return this.cancel('seek'); }
  branchChange() { return this.cancel('branch-change'); }
  branchReturn() { return this.cancel('branch-return'); }
  meaningfulInteraction() {
    return this.cancel('meaningful-interaction', { restore: false, userSuperseded: true });
  }

  _cancelOperation(operation, reason, options = {}) {
    if (!operation.reason) operation.reason = String(reason || 'cancelled');
    if (options.restore === false) operation.restore = false;
    if (options.userSuperseded) operation.userSuperseded = true;
    if (!operation.controller.signal.aborted) {
      operation.controller.abort(abortError(operation.reason));
    }
    return operation.done || Promise.resolve(null);
  }

  async _phase(operation, phase, callback, input = {}) {
    operation.phase = phase;
    let signal = operation.controller.signal;
    if (signal.aborted) throw abortError(signal.reason);
    try {
      let result = typeof callback === 'function'
        ? await callback({
            operationId: operation.id,
            action: operation.action,
            context: operation.context,
            inspected: operation.inspected,
            reveal: operation.reveal,
            target: operation.target,
            signal,
            ...input,
          })
        : undefined;
      if (signal.aborted) throw abortError(signal.reason);
      operation.phases.push(phaseReceipt(phase, 'completed', result));
      return result;
    } catch (error) {
      operation.phases.push(phaseReceipt(
        phase,
        signal.aborted ? 'cancelled' : 'failed',
        { reason: signal.aborted ? operation.reason : error?.message || String(error) },
      ));
      throw error;
    }
  }

  async _restore(operation) {
    if (
      !operation.restore ||
      operation.userSuperseded ||
      operation.reveal?.changed !== true ||
      typeof this._adapter.restore !== 'function'
    ) {
      return;
    }
    operation.phase = 'restore';
    try {
      let result = await this._adapter.restore({
        operationId: operation.id,
        action: operation.action,
        context: operation.context,
        inspected: operation.inspected,
        reveal: operation.reveal,
        reason: operation.reason,
      });
      operation.phases.push(phaseReceipt('restore', 'completed', result));
    } catch (error) {
      operation.phases.push(phaseReceipt('restore', 'failed', { reason: error?.message || String(error) }));
      if (!operation.reason) throw error;
    }
  }

  async _execute(operation) {
    let status = 'completed';
    let failure;
    try {
      operation.inspected = await this._phase(operation, 'inspect', this._adapter.inspect);
      operation.reveal = await this._phase(operation, 'reveal', this._adapter.reveal);
      await this._phase(operation, 'transition', this._adapter.awaitTransition);
      let targetResult = await this._phase(operation, 'target', this._adapter.awaitTarget);
      operation.target = targetResult?.target ?? targetResult;
      operation.result = await this._phase(operation, 'act', this._adapter.act);
    } catch (error) {
      if (operation.controller.signal.aborted) {
        status = 'cancelled';
      } else {
        status = 'failed';
        failure = error;
      }
    }

    try {
      await this._restore(operation);
    } catch (error) {
      status = 'failed';
      failure ||= error;
    }

    if (this._current === operation) this._current = null;
    let receipt = Object.freeze({
      version: SHOW_ACTION_LIFECYCLE_VERSION,
      operationId: operation.id,
      status,
      reason: operation.reason || (failure ? failure?.message || String(failure) : ''),
      inspected: serializable(operation.inspected),
      reveal: serializable(operation.reveal),
      result: serializable(operation.result),
      phases: Object.freeze([...operation.phases]),
    });
    if (failure) throw Object.assign(failure, { receipt });
    return receipt;
  }
}

export function createShowActionLifecycle(adapter) {
  return new ShowActionLifecycle(adapter);
}
