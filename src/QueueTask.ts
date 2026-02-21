/**
 * node-geogebra
 * 
 * Copyright (c) 2026 Josep Mulet
 * 
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GGBPlotter } from "./GGBPlotter";
import { PriorityQueue } from "./PriorityQueue";

export class QueueTask {
  isSubscribed: boolean;
  watcher: Promise<GGBPlotter>;
  constructor(public id: number, private cue: PriorityQueue) {
  }

  subscribe(): Promise<GGBPlotter> {
    const self = this;
    return new Promise((resolve, reject) => {
      // Listen to released events from the pool

      const listener = function (worker: GGBPlotter) {
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