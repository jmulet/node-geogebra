import { QueueTask } from "./QueueTak";
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