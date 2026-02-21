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
exports.PriorityQueue = void 0;
const QueueTask_1 = require("./QueueTask");
class PriorityQueue {
    releasedEmitter;
    static counter = 0;
    tasks;
    constructor(releasedEmitter) {
        this.releasedEmitter = releasedEmitter;
        this.tasks = [];
    }
    async wait() {
        PriorityQueue.counter += 1;
        const cueTask = new QueueTask_1.QueueTask(PriorityQueue.counter, this);
        this.tasks.push(cueTask);
        return cueTask.subscribe();
    }
}
exports.PriorityQueue = PriorityQueue;
//# sourceMappingURL=PriorityQueue.js.map