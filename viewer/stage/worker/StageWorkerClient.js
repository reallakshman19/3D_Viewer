import { createStageWorkerRuntime, runStageWorkerJob } from './StageWorkerRuntime.js';

export function createStageWorkerClient(options = {}) {
  const state = {
    worker: options.useWorker === false ? null : createBrowserWorker(),
    runtime: null,
    onMessage: typeof options.onMessage === 'function' ? options.onMessage : null,
    disposed: false,
  };
  if (!state.worker) state.runtime = createStageWorkerRuntime({ onMessage: (message) => state.onMessage?.(message) });
  return {
    run(job) {
      if (state.disposed) return Promise.reject(new Error('Stage worker client disposed'));
      return state.worker ? runBrowserWorkerJob(state, job) : runStageWorkerJob(state.runtime, job);
    },
    dispose() {
      state.disposed = true;
      state.worker?.terminate();
      state.worker = null;
      state.runtime = null;
    },
  };
}

function createBrowserWorker() {
  if (typeof Worker !== 'function') return null;
  try {
    return new Worker(new URL('./stage-worker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

function runBrowserWorkerJob(state, job) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      state.worker.removeEventListener('message', onMessage);
      state.worker.removeEventListener('error', onError);
    };
    const onMessage = (event) => {
      if (event.data?.kind === 'stage-worker-message') state.onMessage?.(event.data.message);
      if (event.data?.kind === 'stage-worker-result') {
        cleanup();
        resolve(event.data.result);
      }
    };
    const onError = (event) => {
      cleanup();
      reject(new Error(event.message || 'Stage worker failed'));
    };
    state.worker.addEventListener('message', onMessage);
    state.worker.addEventListener('error', onError);
    state.worker.postMessage(job);
  });
}
