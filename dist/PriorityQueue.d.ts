/// <reference types="node" />
import { QueueTask } from "./QueueTak";
import { EventEmitter } from "events";
import { GGBPlotter } from "./GGBPlotter";
export declare class PriorityQueue {
    releasedEmitter: EventEmitter;
    static counter: number;
    tasks: QueueTask[];
    constructor(releasedEmitter: EventEmitter);
    wait(): Promise<GGBPlotter>;
}
