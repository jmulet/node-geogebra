/**
 * node-geogebra
 * 
 * Copyright (c) 2026 Josep Mulet
 * 
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as puppeteer from 'puppeteer';
import { EventEmitter } from 'events';
import { GGBPlotter } from './GGBPlotter';
import { PriorityQueue } from './PriorityQueue';
import { GGBOptions } from './GGBOptions';
import * as path from 'path';

let window: any;
const DEBUG = false;

export class GGBPool {
    browser: puppeteer.Browser;
    availableWorkers: GGBPlotter[];
    usedWorkers: GGBPlotter[] = [];
    releasedEmitter: EventEmitter;
    priorityCue: PriorityQueue;
    isCreated: boolean;

    availablePages: puppeteer.Page[];
    opts: GGBOptions;

    constructor(options?: GGBOptions) {
        this.opts = { ggb: "local", plotters: 3, ...options };
        this.releasedEmitter = new EventEmitter();
        this.priorityCue = new PriorityQueue(this.releasedEmitter)
        // Return released workers to the pool
        this.releasedEmitter.on("released", (worker: GGBPlotter) => {
            const indx = this.usedWorkers.indexOf(worker);
            this.usedWorkers.splice(indx, 1);
            this.availableWorkers.push(worker);
        });
    }

    async ready(): Promise<GGBPool> {
        if (this.isCreated) {
            return this;
        }

        // Wait for browser
        // "--disable-web-security" --> breaks it
        const opts: puppeteer.LaunchOptions = {
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

        const promises = new Array<Promise<puppeteer.BrowserContext>>(this.opts.plotters);
        for (var i = 0; i < this.opts.plotters; i++) {
            promises[i] = this.browser.createBrowserContext();
        }
        const browserContexts = await Promise.all(promises);
        DEBUG && console.log("browsers created");


        const promises2 = new Array<Promise<puppeteer.Page>>(this.opts.plotters);
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
        } else {
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
        if (perspective === "3" || perspective === "3D") perspective = "T";

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
                } catch (e) {
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

        this.availableWorkers = this.availablePages.map((p, i) => new GGBPlotter(i + 1, p, this.releasedEmitter));

        DEBUG && console.log("WORKERS HAVE BEEN CREATED")

        return this;
    }


    private pickaWorker(): GGBPlotter {
        const worker = this.availableWorkers[0];
        this.availableWorkers.splice(0, 1);
        this.usedWorkers.push(worker);
        return worker;
    }

    async getGGBPlotter(): Promise<GGBPlotter> {
        if (this.availableWorkers.length) {
            return this.pickaWorker();
        } else {
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

