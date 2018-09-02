"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const QueueTak_1 = require("./QueueTak");
class PriorityQueue {
    constructor(releasedEmitter) {
        this.releasedEmitter = releasedEmitter;
        this.tasks = [];
    }
    wait() {
        return __awaiter(this, void 0, void 0, function* () {
            PriorityQueue.counter += 1;
            const cueTask = new QueueTak_1.QueueTask(PriorityQueue.counter, this);
            this.tasks.push(cueTask);
            return cueTask.subscribe();
        });
    }
}
PriorityQueue.counter = 0;
exports.PriorityQueue = PriorityQueue;
//# sourceMappingURL=PriorityQueue.js.map