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
const puppeteer = require("puppeteer");
const events_1 = require("events");
const path = require("path");
const DEBUG = false;
let window;
// A pool --> browser
// A worker --> is a page browser
class GGBPool {
    constructor(numWorkers) {
        this.usedWorkers = [];
        this.numWorkers = numWorkers || 1;
        this.releasedEmitter = new events_1.EventEmitter();
        this.priorityCue = new PriorityCue(this.releasedEmitter);
        // Return released workers to the pool
        this.releasedEmitter.on("released", (worker) => {
            const indx = this.usedWorkers.indexOf(worker);
            this.usedWorkers.splice(indx, 1);
            this.availableWorkers.push(worker);
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isCreated) {
                return this;
            }
            // Wait for browser
            // "--disable-web-security" --> breaks it
            const opts = { devtools: false,
                args: ["--allow-file-access-from-files", "--non-secure",
                    "--allow-running-insecure-content", "--no-sandbox",
                    "--no-startup-window"] };
            this.browser = yield puppeteer.launch(opts);
            const promises = new Array(this.numWorkers);
            for (var i = 0; i < this.numWorkers; i++) {
                promises[i] = this.browser.createIncognitoBrowserContext();
            }
            const browserContexts = yield Promise.all(promises);
            DEBUG && console.log("browsers created");
            const promises2 = new Array(this.numWorkers);
            for (var i = 0; i < this.numWorkers; i++) {
                promises2[i] = browserContexts[i].newPage();
            }
            // Wait for windows contexts
            this.availablePages = yield Promise.all(promises2);
            DEBUG && console.log("pages have been created");
            // Load empty geogebra templates
            let promises3 = new Array(this.numWorkers);
            for (var i = 0; i < this.numWorkers; i++) {
                promises3[i] = this.availablePages[i].goto("https://www.geogebra.org/classic");
            }
            yield Promise.all(promises3);
            DEBUG && console.log("https://www.geogebra.org/classic have loaded in all pages");
            // Wait for ... ggbApplet injected    
            promises3 = new Array(this.numWorkers);
            for (var i = 0; i < this.numWorkers; i++) {
                promises3[i] = this.availablePages[i].waitForFunction("window.ggbApplet!=null");
            }
            yield Promise.all(promises3);
            DEBUG && console.log("ggbApplet is ready in all pages");
            promises3 = new Array(this.numWorkers);
            for (var i = 0; i < this.numWorkers; i++) {
                promises3[i] = this.availablePages[i].evaluate('window.ggbApplet.evalCommand(\'SetPerspective("G")\\nShowGrid(true)\')');
            }
            yield Promise.all(promises3);
            DEBUG && console.log("All pages have been initialized");
            this.availableWorkers = this.availablePages.map((p, i) => new GGBWorker(i + 1, p, this.releasedEmitter));
            DEBUG && console.log("WORKERS HAVE BEEN CREATED");
            return this;
        });
    }
    pickaWorker() {
        const worker = this.availableWorkers[0];
        this.availableWorkers.splice(0, 1);
        this.usedWorkers.push(worker);
        return worker;
    }
    getGGBWorker() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.availableWorkers.length) {
                return this.pickaWorker();
            }
            else {
                const watcher = this.priorityCue.wait();
                watcher.then((worker) => {
                    const idx = this.availableWorkers.indexOf(worker);
                    this.availableWorkers.splice(idx, 1);
                    this.usedWorkers.push(worker);
                });
                return watcher;
            }
        });
    }
    release() {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            for (var i = 0; i < this.numWorkers; i++) {
                promises.push(this.availablePages[i].close());
            }
            yield Promise.all(promises);
            yield this.browser.close();
        });
    }
}
exports.GGBPool = GGBPool;
/**
function listenChangesinArray(arr, callback){
  // Add more methods here if you want to listen to them
 ['push'].forEach((m) => {
     arr[m] = function(){
                  var res = Array.prototype[m].apply(arr, arguments);  // call normal behaviour
                  callback(m, arguments);  // finally call the callback supplied
                  return res;
              }
 });
}
**/
class PriorityCue {
    constructor(releasedEmitter) {
        this.releasedEmitter = releasedEmitter;
        this.tasks = [];
    }
    wait() {
        return __awaiter(this, void 0, void 0, function* () {
            PriorityCue.counter += 1;
            const cueTask = new CueTask(PriorityCue.counter, this);
            this.tasks.push(cueTask);
            return cueTask.subscribe();
        });
    }
}
PriorityCue.counter = 0;
class CueTask {
    constructor(id, cue) {
        this.id = id;
        this.cue = cue;
    }
    subscribe() {
        const self = this;
        return new Promise((resolve, reject) => {
            // Listen to released events from the pool
            self.cue.releasedEmitter.on("released", function (worker) {
                //check if am i the first in the cue?
                const order = self.cue.tasks.indexOf(self);
                console.log("I am task " + self.id + " my place is " + order + "; ");
                if (order === 0) {
                    //Am taking this worker. Remove me from the cue
                    self.cue.tasks.splice(0, 1);
                    resolve(worker);
                }
            });
        });
    }
}
class GGBWorker {
    constructor(id, page, releasedEmitter) {
        this.id = id;
        this.page = page;
        this.releasedEmitter = releasedEmitter;
    }
    exportSVG() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.page.evaluate(() => window.ggbApplet.exportSVG());
        });
    }
    exportSVG64() {
        return __awaiter(this, void 0, void 0, function* () {
            const svg = yield this.exportSVG();
            return "data:image/svg+xml;base64," + Buffer.from(svg).toString('base64');
        });
    }
    exportPDF() {
        return __awaiter(this, void 0, void 0, function* () {
            const pdf64 = yield this.exportPDF64();
            const raw = pdf64.replace("data:application/pdf;base64,", "");
            return Buffer.from(raw, 'base64');
        });
    }
    exportPDF64() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.page.evaluate(() => window.ggbApplet.exportPDF());
        });
    }
    eval(width, height, ggbScript) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.page.setViewport({ width: width, height: height });
            yield this.page.evaluate((x) => window.ggbApplet.evalCommand(x), ggbScript.join("\n"));
        });
    }
    release() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.page.evaluate(() => window.ggbApplet.reset());
            // notify to the cue that a worker has been released and must be returned to the pool
            this.releasedEmitter.emit("released", this);
        });
    }
}
//# sourceMappingURL=node-ggb.js.map