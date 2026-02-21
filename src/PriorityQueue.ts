/**
 * node-geogebra
 *
 * Copyright (c) 2026 Josep Mulet
 *
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QueueTask } from "./QueueTask";
import { EventEmitter } from "events";
import { GGBPlotter } from "./GGBPlotter";

/**
 * A FIFO waiting queue used by {@link GGBPool} when all workers are busy.
 *
 * Callers invoke {@link wait} to receive a promise that resolves as soon as a
 * {@link GGBPlotter} worker is released back to the pool.  Tasks are served in
 * the order they arrived (first-in, first-out).
 *
 * @internal
 */
export class PriorityQueue {
    /** Monotonically increasing counter used to assign task IDs. */
    static counter = 0;

    /** Ordered list of pending tasks waiting for a free worker. */
    tasks: QueueTask[];

    /**
     * @param releasedEmitter - The shared {@link EventEmitter} that emits a
     *   `"released"` event every time a {@link GGBPlotter} is returned to the
     *   pool.
     */
    constructor(public releasedEmitter: EventEmitter) {
        this.tasks = [];
    }

    /**
     * Enqueues the caller and returns a promise that resolves with the next
     * available {@link GGBPlotter} worker.
     *
     * The promise resolves only when a worker is released **and** this task is
     * at the head of the queue, guaranteeing FIFO ordering.
     *
     * @returns A promise that resolves with the assigned {@link GGBPlotter}.
     */
    async wait(): Promise<GGBPlotter> {
        PriorityQueue.counter += 1;
        const queueTask = new QueueTask(PriorityQueue.counter, this);
        this.tasks.push(queueTask);
        return queueTask.subscribe();
    }
}