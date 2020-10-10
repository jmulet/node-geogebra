"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GGBPool = void 0;
const puppeteer = require("puppeteer");
const events_1 = require("events");
const GGBPlotter_1 = require("./GGBPlotter");
const PriorityQueue_1 = require("./PriorityQueue");
const path = require("path");
let window;
const DEBUG = false;
class GGBPool {
    constructor(options) {
        this.usedWorkers = [];
        this.opts = Object.assign({ ggb: "local", plotters: 3 }, options);
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
            const promises = new Array(this.opts.plotters);
            for (var i = 0; i < this.opts.plotters; i++) {
                promises[i] = this.browser.createIncognitoBrowserContext();
            }
            const browserContexts = yield Promise.all(promises);
            DEBUG && console.log("browsers created");
            const promises2 = new Array(this.opts.plotters);
            for (var i = 0; i < this.opts.plotters; i++) {
                promises2[i] = browserContexts[i].newPage();
            }
            // Wait for windows contexts
            this.availablePages = yield Promise.all(promises2);
            DEBUG && console.log("pages have been created");
            // Load empty geogebra templates
            let url;
            if (this.opts.ggb === "local") {
                const dir = path.resolve(__dirname, "../geogebra-math-apps-bundle/Geogebra/HTML5/5.0/GeoGebra.html");
                url = "file://" + dir;
            }
            else {
                url = "https://www.geogebra.org/classic";
            }
            let promises3 = new Array(this.opts.plotters);
            for (var i = 0; i < this.opts.plotters; i++) {
                promises3[i] = this.availablePages[i].goto(url, { waitUntil: 'networkidle2' });
            }
            yield Promise.all(promises3);
            DEBUG && console.log("https://www.geogebra.org/classic have loaded in all pages");
            // Wait for ... ggbApplet injected    
            promises3 = new Array(this.opts.plotters);
            for (var i = 0; i < this.opts.plotters; i++) {
                promises3[i] = this.availablePages[i].waitForFunction("window.ggbApplet!=null");
            }
            yield Promise.all(promises3);
            DEBUG && console.log("ggbApplet is ready in all pages");
            promises3 = new Array(this.opts.plotters);
            for (var i = 0; i < this.opts.plotters; i++) {
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
            for (var i = 0; i < this.opts.plotters; i++) {
                promises.push(this.availablePages[i].close());
            }
            yield Promise.all(promises);
            yield this.browser.close();
        });
    }
}
exports.GGBPool = GGBPool;
//# sourceMappingURL=GGBPool.js.map