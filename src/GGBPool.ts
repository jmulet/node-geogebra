import * as puppeteer from 'puppeteer';
import { EventEmitter } from 'events';
import { GGBPlotter } from './GGBPlotter';
import { PriorityQueue } from './PriorityQueue';
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
    numWorkers: number;

    constructor(numWorkers?: number) {
        this.numWorkers = numWorkers ||  1;
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
            devtools: false,
            args: ["--allow-file-access-from-files", "--non-secure",
                "--allow-running-insecure-content", "--no-sandbox",
                "--no-startup-window"]
        };

        this.browser = await puppeteer.launch(opts);

        const promises = new Array<Promise<puppeteer.BrowserContext>>(this.numWorkers);
        for (var i = 0; i < this.numWorkers; i++) {
            promises[i] = this.browser.createIncognitoBrowserContext();
        }
        const browserContexts = await Promise.all(promises);
        DEBUG && console.log("browsers created");


        const promises2 = new Array<Promise<puppeteer.Page>>(this.numWorkers);
        for (var i = 0; i < this.numWorkers; i++) {
            promises2[i] = browserContexts[i].newPage();
        }
        // Wait for windows contexts
        this.availablePages = await Promise.all(promises2);
        DEBUG && console.log("pages have been created");

        // Load empty geogebra templates
        let promises3 = new Array(this.numWorkers);
        for (var i = 0; i < this.numWorkers; i++) {
            promises3[i] = this.availablePages[i].goto("https://www.geogebra.org/classic");
        }
        await Promise.all(promises3);
        DEBUG && console.log("https://www.geogebra.org/classic have loaded in all pages");

        // Wait for ... ggbApplet injected    
        promises3 = new Array(this.numWorkers);
        for (var i = 0; i < this.numWorkers; i++) {
            promises3[i] = this.availablePages[i].waitForFunction("window.ggbApplet!=null");
        }
        await Promise.all(promises3);
        DEBUG && console.log("ggbApplet is ready in all pages");


        promises3 = new Array(this.numWorkers);
        for (var i = 0; i < this.numWorkers; i++) {
            promises3[i] = this.availablePages[i].evaluate('window.ggbApplet.evalCommand(\'SetPerspective("G")\\nShowGrid(true)\')');
        }
        await Promise.all(promises3);
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
        for (var i = 0; i < this.numWorkers; i++) {
            promises.push(this.availablePages[i].close());
        }
        await Promise.all(promises);
        await this.browser.close();
    }

}

