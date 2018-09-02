import { GGBPlotter } from "./GGBPlotter";
import { PriorityQueue } from "./PriorityQueue";
export declare class QueueTask {
    id: number;
    private cue;
    isSubscribed: boolean;
    watcher: any;
    constructor(id: number, cue: PriorityQueue);
    subscribe(): Promise<GGBPlotter>;
}
