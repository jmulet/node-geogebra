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
/**
 * A pool of pre-initialised {@link GGBPlotter} workers backed by a shared
 * headless Chromium browser.
 *
 * `GGBPool` is the recommended entry point when you need to process multiple
 * GeoGebra constructions **in parallel**.  It maintains a fixed set of workers
 * (one Puppeteer page each) and automatically queues callers when all workers
 * are busy.
 *
 * **Lifecycle:**
 * 1. Construct the pool with {@link GGBPool.constructor}.
 * 2. Await {@link ready} — this launches the browser and initialises every
 *    worker.
 * 3. For each plotting task, call {@link getGGBPlotter} to borrow a worker.
 * 4. When done with a worker, call `plotter.release()` to return it to the
 *    pool.
 * 5. When all work is finished, call {@link release} to shut down the browser.
 *
 * @example
 * ```ts
 * const pool = new GGBPool({ plotters: 3, ggb: "local" });
 * await pool.ready();
 *
 * const plotter = await pool.getGGBPlotter();
 * await plotter.evalGGBScript(["f = cos(x)"], 600, 400);
 * const svg = await plotter.export64("svg");
 * await plotter.release();   // returns worker to the pool
 *
 * await pool.release();      // shuts down browser
 * ```
 */
class GGBPool {
    /** The shared Puppeteer browser instance used by all workers. */
    browser;
    /**
     * Workers that are currently idle and available for borrowing via
     * {@link getGGBPlotter}.
     */
    availableWorkers;
    /** Workers that have been borrowed and not yet released. */
    usedWorkers = [];
    /**
     * Internal event emitter that coordinates worker hand-off between
     * {@link GGBPlotter.release} and the pool / {@link PriorityQueue}.
     * Emits `"released"` with the returning {@link GGBPlotter} as payload.
     */
    releasedEmitter;
    /**
     * FIFO queue used to park callers of {@link getGGBPlotter} when no worker
     * is currently available.
     */
    priorityQueue;
    /**
     * `true` after {@link ready} has completed successfully; `false` initially
     * and after {@link release}.  Guards against double-initialisation.
     */
    isCreated;
    /** Raw Puppeteer page handles, one per worker. */
    availablePages;
    /** Resolved options in effect for this pool. */
    opts;
    /**
     * Creates a new `GGBPool`.
     *
     * > **Note:** the browser is **not** launched here.  Call {@link ready}
     * > and await it before using the pool.
     *
     * @param options - Pool configuration.  Defaults:
     *   `{ ggb: "local", plotters: 3, perspective: "G" }`.
     */
    constructor(options) {
        this.opts = { ggb: "local", plotters: 3, ...options };
        this.releasedEmitter = new events_1.EventEmitter();
        this.priorityQueue = new PriorityQueue_1.PriorityQueue(this.releasedEmitter);
        // Return released workers to the pool
        this.releasedEmitter.on("released", (worker) => {
            const indx = this.usedWorkers.indexOf(worker);
            this.usedWorkers.splice(indx, 1);
            // Only return to the idle pool when nobody is waiting in the queue.
            // If there are waiters, QueueTask delivers the worker directly
            // without routing it through availableWorkers.
            if (this.priorityQueue.tasks.length === 0) {
                this.availableWorkers.push(worker);
            }
        });
    }
    /**
     * Initialises the pool by launching the headless browser, creating one
     * isolated browser context per worker, loading the GeoGebra app in each
     * context, and waiting for every applet to become fully functional.
     *
     * Calling this method multiple times is safe — subsequent calls return
     * immediately without re-initialising.
     *
     * @returns The pool itself, allowing `await pool.ready()` chaining.
     * @throws If the browser fails to launch or any page fails to load within
     *   the 60-second timeout.
     *
     * @example
     * ```ts
     * const pool = new GGBPool({ plotters: 2 });
     * await pool.ready();
     * // pool is now ready to use
     * ```
     */
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
        for (let i = 0; i < this.opts.plotters; i++) {
            promises[i] = this.browser.createBrowserContext();
        }
        const browserContexts = await Promise.all(promises);
        DEBUG && console.log("browsers created");
        const promises2 = new Array(this.opts.plotters);
        for (let i = 0; i < this.opts.plotters; i++) {
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
        for (let i = 0; i < this.opts.plotters; i++) {
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
        for (let i = 0; i < this.opts.plotters; i++) {
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
        this.isCreated = true;
        return this;
    }
    /**
     * Picks the first available worker from the pool, moves it to
     * {@link usedWorkers}, and returns it.
     *
     * @returns The borrowed {@link GGBPlotter}.
     * @internal
     */
    pickWorker() {
        if (this.availableWorkers.length === 0) {
            return null;
        }
        const worker = this.availableWorkers[0];
        this.availableWorkers.splice(0, 1);
        this.usedWorkers.push(worker);
        return worker;
    }
    /**
     * Borrows a {@link GGBPlotter} worker from the pool.
     *
     * - If a worker is idle, it is returned immediately.
     * - If all workers are busy, the returned promise stays pending until one
     *   is released, then resolves in FIFO order relative to other waiting
     *   callers.
     *
     * > **Important:** always call `plotter.release()` when finished so the
     * > worker is returned and waiting callers can proceed.
     *
     * @returns A promise that resolves with an available {@link GGBPlotter}.
     *
     * @example
     * ```ts
     * const plotter = await pool.getGGBPlotter();
     * try {
     *     await plotter.evalGGBScript(["f = tan(x)"], 600, 400);
     *     const png = await plotter.exportPNG();
     * } finally {
     *     await plotter.release();
     * }
     * ```
     */
    async getGGBPlotter() {
        const worker = this.pickWorker();
        if (worker) {
            return worker;
        }
        else {
            // No idle worker available — park this caller in the FIFO queue.
            // The "released" event handler will NOT add the returning worker to
            // availableWorkers (because tasks.length > 0 at that point), so
            // QueueTask resolves the promise directly with the worker.
            return this.priorityQueue.wait();
        }
    }
    /**
     * Closes all browser pages and shuts down the shared Chromium browser,
     * freeing all system resources.
     *
     * This method is idempotent — calling it on an uninitialised or already
     * released pool is a no-op.
     *
     * > **Important:** the Node.js process will not exit until this method has
     * > been awaited.
     *
     * @example
     * ```ts
     * await pool.release();
     * console.log("Browser closed, process may now exit.");
     * ```
     */
    async release() {
        if (!this.isCreated || !this.availablePages) {
            return;
        }
        const promises = [];
        for (let i = 0; i < this.opts.plotters; i++) {
            promises.push(this.availablePages[i].close());
        }
        await Promise.all(promises);
        await this.browser.close();
        this.isCreated = false;
    }
}
exports.GGBPool = GGBPool;
//# sourceMappingURL=GGBPool.js.map