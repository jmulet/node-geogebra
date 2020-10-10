"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueTask = void 0;
class QueueTask {
    constructor(id, cue) {
        this.id = id;
        this.cue = cue;
    }
    subscribe() {
        const self = this;
        return new Promise((resolve, reject) => {
            // Listen to released events from the pool
            const listener = function (worker) {
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
exports.QueueTask = QueueTask;
//# sourceMappingURL=QueueTak.js.map