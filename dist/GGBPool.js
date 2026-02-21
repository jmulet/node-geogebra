"use strict";
/**
 * node-geogebra
 *
 * Copyright (c) 2026 Josep Mulet
 *
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GGBPool = void 0;
const puppeteer = __importStar(require("puppeteer"));
const events_1 = require("events");
const GGBPlotter_1 = require("./GGBPlotter");
const PriorityQueue_1 = require("./PriorityQueue");
const path = __importStar(require("path"));
let window;
const DEBUG = false;
class GGBPool {
    browser;
    availableWorkers;
    usedWorkers = [];
    releasedEmitter;
    priorityCue;
    isCreated;
    availablePages;
    opts;
    constructor(options) {
        this.opts = { ggb: "local", plotters: 3, ...options };
        this.releasedEmitter = new events_1.EventEmitter();
        this.priorityCue = new PriorityQueue_1.PriorityQueue(this.releasedEmitter);
        // Return released workers to the pool
        this.releasedEmitter.on("released", (worker) => {
            const indx = this.usedWorkers.indexOf(worker);
            this.usedWorkers.splice(indx, 1);
            this.availableWorkers.push(worker);
        });
    }
    async ready() {
        if (this.isCreated) {
            return this;
        }
        // Wait for browser
        // "--disable-web-security" --> breaks it
        const opts = {
            headless: true,
            args: [
                "--allow-file-access-from-files",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--enable-webgl",
                "--ignore-gpu-blacklist",
                "--use-gl=angle",
                "--use-angle=metal"
            ]
        };
        this.browser = await puppeteer.launch(opts);
        const promises = new Array(this.opts.plotters);
        for (var i = 0; i < this.opts.plotters; i++) {
            promises[i] = this.browser.createBrowserContext();
        }
        const browserContexts = await Promise.all(promises);
        DEBUG && console.log("browsers created");
        const promises2 = new Array(this.opts.plotters);
        for (var i = 0; i < this.opts.plotters; i++) {
            promises2[i] = browserContexts[i].newPage();
        }
        // Wait for windows contexts
        this.availablePages = await Promise.all(promises2);
        DEBUG && console.log("pages have been created");
        // Load empty geogebra templates
        let url;
        if (this.opts.ggb === "local") {
            const dir = path.resolve(__dirname, "../geogebra-math-apps-bundle/GeoGebra/HTML5/5.0/GeoGebra.html");
            url = "file://" + dir;
        }
        else {
            url = "https://www.geogebra.org/classic";
        }
        let promises3 = new Array(this.opts.plotters);
        for (var i = 0; i < this.opts.plotters; i++) {
            DEBUG && console.log(`Worker ${i} navigating to ${url}`);
            promises3[i] = this.availablePages[i].goto(url, { waitUntil: 'domcontentloaded' });
        }
        await Promise.all(promises3);
        DEBUG && console.log("All pages have loaded");
        // Wait for ... ggbApplet injected    
        promises3 = new Array(this.opts.plotters);
        let perspective = this.opts.perspective || "G";
        if (perspective === "3" || perspective === "3D")
            perspective = "T";
        for (var i = 0; i < this.opts.plotters; i++) {
            DEBUG && console.log(`Worker ${i} waiting for window.ggbApplet to be fully functional...`);
            promises3[i] = this.availablePages[i].waitForFunction((p) => {
                try {
                    if (window.ggbApplet && typeof window.ggbApplet.evalCommand === 'function') {
                        window.ggbApplet.evalCommand(`SetPerspective("${p}")\nShowGrid(true)`);
                        if (p === "T" || p === "D" || p === "5") {
                            const xml = window.ggbApplet.getPerspectiveXML();
                            return xml.includes('id="512"');
                        }
                        return true;
                    }
                }
                catch (e) {
                    // Scripting commands not loaded yet or other error
                }
                return false;
            }, { timeout: 60000 }, perspective);
        }
        await Promise.all(promises3);
        if (perspective === "T" || perspective === "D" || perspective === "5") {
            await new Promise(r => setTimeout(r, 2000));
        }
        DEBUG && console.log(`ggbApplet is fully ready in all pages with perspective ${perspective}`);
        DEBUG && console.log("All pages have been initialized");
        this.availableWorkers = this.availablePages.map((p, i) => new GGBPlotter_1.GGBPlotter(i + 1, p, this.releasedEmitter));
        DEBUG && console.log("WORKERS HAVE BEEN CREATED");
        return this;
    }
    pickaWorker() {
        const worker = this.availableWorkers[0];
        this.availableWorkers.splice(0, 1);
        this.usedWorkers.push(worker);
        return worker;
    }
    async getGGBPlotter() {
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
    }
    async release() {
        const promises = [];
        for (var i = 0; i < this.opts.plotters; i++) {
            promises.push(this.availablePages[i].close());
        }
        await Promise.all(promises);
        await this.browser.close();
    }
}
exports.GGBPool = GGBPool;
//# sourceMappingURL=GGBPool.js.map