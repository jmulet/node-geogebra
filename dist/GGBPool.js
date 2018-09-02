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
const GGBPlotter_1 = require("./GGBPlotter");
const PriorityQueue_1 = require("./PriorityQueue");
let window;
const DEBUG = false;
class GGBPool {
    constructor(numWorkers) {
        this.usedWorkers = [];
        this.numWorkers = numWorkers || 1;
        this.releasedEmitter = new events_1.EventEmitter();
        this.priorityCue = new PriorityQueue_1.PriorityQueue(this.releasedEmitter);
        // Return released workers to the pool
        this.releasedEmitter.on("released", (worker) => {
            const indx = this.usedWorkers.indexOf(worker);
            this.usedWorkers.splice(indx, 1);
            this.availableWorkers.push(worker);
        });
    }
    ready() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isCreated) {
                return this;
            }
            // Wait for browser
            // "--disable-web-security" --> breaks it
            const opts = {
                devtools: false,
                args: ["--allow-file-access-from-files", "--non-secure",
                    "--allow-running-insecure-content", "--no-sandbox",
                    "--no-startup-window"]
            };
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
            this.availableWorkers = this.availablePages.map((p, i) => new GGBPlotter_1.GGBPlotter(i + 1, p, this.releasedEmitter));
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
    getGGBPlotter() {
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
//# sourceMappingURL=GGBPool.js.map