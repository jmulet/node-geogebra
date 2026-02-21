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

export class PriorityQueue {
    static counter = 0;
    tasks: QueueTask[];
    constructor(public releasedEmitter: EventEmitter) {
        this.tasks = [];
    }
    async wait(): Promise<GGBPlotter> {
        PriorityQueue.counter += 1;
        const cueTask = new QueueTask(PriorityQueue.counter, this);
        this.tasks.push(cueTask);
        return cueTask.subscribe();
    }
}