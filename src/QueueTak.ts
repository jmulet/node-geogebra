import { GGBPlotter } from "./GGBPlotter";
import { PriorityQueue } from "./PriorityQueue";

export class QueueTask {
  isSubscribed: boolean;
  watcher;
  constructor(public id: number, private cue: PriorityQueue) {
  }

  subscribe(): Promise<GGBPlotter> {
    const self = this;
    return new Promise((resolve, reject) => {
       // Listen to released events from the pool
      
       const listener = function(worker) {
        //check if am i the first in the cue?
        const order = self.cue.tasks.indexOf(self);
        if (order === 0) {
          //Am taking this worker. Remove me from the cue
          self.cue.releasedEmitter.removeListener("released", listener);
          self.cue.tasks.splice(0, 1);
          resolve(worker);
        }
      };

      self.cue.releasedEmitter.on("released", listener);
    });
  }


}