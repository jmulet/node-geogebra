"use strict";
/**
 * node-geogebra
 *
 * Copyright (c) 2026 Josep Mulet
 *
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueTask = void 0;
/**
 * Represents a single pending request for a {@link GGBPlotter} worker inside a
 * {@link PriorityQueue}.
 *
 * A `QueueTask` is created by {@link PriorityQueue.wait} and immediately
 * {@link subscribe | subscribed} to the pool's `"released"` event.  When the
 * task reaches the head of the queue and a worker becomes available, the
 * internal promise resolves and the worker is handed to the caller.
 *
 * @internal
 */
class QueueTask {
    id;
    queue;
    /**
     * Whether this task has already claimed a worker.
     * Set to `true` the moment {@link subscribe} resolves.
     */
    isSubscribed;
    /**
     * The promise returned by {@link subscribe}.
     * Stored here so external code can inspect or chain off it if needed.
     */
    watcher;
    /**
     * @param id    - Unique monotonic identifier assigned by {@link PriorityQueue}.
     * @param queue - Back-reference to the owning queue, used to inspect
     *                ordering and remove the task once it is served.
     */
    constructor(id, queue) {
        this.id = id;
        this.queue = queue;
    }
    /**
     * Starts listening for `"released"` events on the pool emitter and returns
     * a promise that resolves with the first available {@link GGBPlotter} whose
     * turn it is to serve this task.
     *
     * The task only accepts a worker when it is at position `0` in the queue
     * (i.e. it is the oldest waiting request), ensuring strict FIFO ordering.
     * Once accepted, the listener is removed and the task is spliced out of
     * the queue.
     *
     * @returns A promise that resolves with the assigned {@link GGBPlotter}.
     */
    subscribe() {
        const self = this;
        return new Promise((resolve, _reject) => {
            // Listen to released events from the pool
            const listener = function (worker) {
                // Check if this task is first in the queue
                const order = self.queue.tasks.indexOf(self);
                if (order === 0) {
                    // Claim the worker: unsubscribe and remove from queue
                    self.queue.releasedEmitter.removeListener("released", listener);
                    self.queue.tasks.splice(0, 1);
                    self.isSubscribed = true;
                    resolve(worker);
                }
            };
            self.queue.releasedEmitter.on("released", listener);
        });
    }
}
exports.QueueTask = QueueTask;
//# sourceMappingURL=QueueTask.js.map