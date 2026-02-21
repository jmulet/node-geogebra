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
exports.GGBPlotter = void 0;
const puppeteer = __importStar(require("puppeteer"));
const path = __importStar(require("path"));
let window;
const DEBUG = false;
class GGBPlotter {
    releasedEmitter;
    id;
    poolOpts;
    pagePromise;
    browser;
    width = 600;
    height = 400;
    constructor(id, page, releasedEmitter) {
        if (id) {
            if (typeof (id) == "number") {
                this.id = id;
                this.poolOpts = { plotters: 1, ggb: "local" };
            }
            else {
                this.poolOpts = { plotters: 3, ggb: "local", ...id };
                this.id = Math.random().toString(32).substring(2);
            }
        }
        else {
            this.poolOpts = { plotters: 3, ggb: "local" };
            this.id = Math.random().toString(32).substring(2);
        }
        this.pagePromise = this.createPage(page);
        this.releasedEmitter = releasedEmitter;
    }
    async createPage(page) {
        if (page) {
            return page;
        }
        else {
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
            DEBUG && console.log("Launching browser with options: ", opts);
            this.browser = await puppeteer.launch(opts);
            DEBUG && console.log("Browser launched successfully");
            const newPage = await this.browser.newPage();
            let url;
            if (this.poolOpts.ggb === "local") {
                const dir = path.resolve(__dirname, "../geogebra-math-apps-bundle/GeoGebra/HTML5/5.0/GeoGebra.html");
                url = "file://" + dir;
            }
            else {
                url = "https://www.geogebra.org/classic";
            }
            DEBUG && console.log("Navigating to: " + url);
            await newPage.goto(url, { waitUntil: 'domcontentloaded' });
            DEBUG && console.log(url + " has been loaded");
            DEBUG && console.log("Waiting for window.ggbApplet to be fully functional...");
            let perspective = this.poolOpts.perspective || "G";
            // Map common aliases
            if (perspective === "3" || perspective === "3D")
                perspective = "T";
            await newPage.waitForFunction((p) => {
                try {
                    if (window.ggbApplet && typeof window.ggbApplet.evalCommand === 'function') {
                        window.ggbApplet.evalCommand(`SetPerspective("${p}")\nShowGrid(true)`);
                        // If 3D, check if 3D view is visible (id 512)
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
            // Extra wait for 3D engine to initialize WebGL
            if (perspective === "T" || perspective === "D" || perspective === "5") {
                await new Promise(r => setTimeout(r, 2000));
            }
            DEBUG && console.log(`ggbApplet is fully ready with perspective ${perspective}`);
            return newPage;
        }
    }
    async ready() {
        return this.pagePromise;
    }
    async evalGGBScript(ggbScript, width, height) {
        const page = await this.pagePromise;
        // 53 px accounts for the toolbar which cannot be removed in geogebra app mode
        this.width = width || 600;
        this.height = height || 400;
        await page.setViewport({ width: this.width, height: this.height + 53 });
        if (ggbScript && ggbScript.length) {
            await page.evaluate((script, w, h) => {
                window.ggbApplet.setSize(w, h);
                window.ggbApplet.evalCommand(script);
                window.ggbApplet.refreshViews();
            }, ggbScript.join("\n"), this.width, this.height);
        }
    }
    async exportPNG(alpha, dpi) {
        const pdf64 = await this.exportPNG64(alpha, dpi);
        const raw = pdf64.replace("data:image/png;base64,", "");
        return Buffer.from(raw, 'base64');
    }
    async exportPNG64(alpha, dpi) {
        const page = await this.pagePromise;
        const out = await page.evaluate((alpha, dpi) => window.ggbApplet.getPNGBase64(1, !!alpha, dpi || 300), alpha, dpi);
        return "data:image/png;base64," + out;
    }
    async exportSVG() {
        const page = await this.pagePromise;
        return page.evaluate(() => new Promise((resolve) => {
            window.ggbApplet.exportSVG((data) => resolve(data));
        }));
    }
    async exportSVG64() {
        const svg = await this.exportSVG();
        return "data:image/svg+xml;base64," + Buffer.from(svg).toString('base64');
    }
    async exportPDF() {
        const pdf64 = await this.exportPDF64();
        const prefix = "data:application/pdf;base64,";
        const raw = (pdf64.startsWith(prefix) ? pdf64.substring(prefix.length) : pdf64).trim();
        return Buffer.from(raw, 'base64');
    }
    async exportPDF64() {
        const page = await this.pagePromise;
        // Small delay to ensure rendering engine has settled
        await new Promise(r => setTimeout(r, 500));
        return page.evaluate(() => new Promise((resolve) => {
            // GeoGebra 5 signature: exportPDF(scale, callback, sliderLabel)
            window.ggbApplet.exportPDF(1, (data) => resolve(data));
        }));
    }
    async exportGGB() {
        const raw = await this.exportGGB64();
        return Buffer.from(raw, 'base64');
    }
    async exportGGB64() {
        const page = await this.pagePromise;
        return page.evaluate(() => window.ggbApplet.getBase64());
    }
    async export(format) {
        switch (format) {
            case ("png"): return this.exportPNG();
            case ("pngalpha"): return this.exportPNG(true);
            case ("pdf"): return this.exportPDF();
            case ("svg"): return this.exportSVG();
            case ("ggb"): return this.exportGGB();
            default: return this.exportPNG();
        }
    }
    async export64(format) {
        switch (format) {
            case ("pngalpha"): return this.exportPNG64(true);
            case ("pdf"): return this.exportPDF64();
            case ("svg"): return this.exportSVG64();
            case ("ggb"): return this.exportGGB64();
            default: return this.exportPNG64();
        }
    }
    async reset() {
        const page = await this.pagePromise;
        await page.evaluate(() => window.ggbApplet.reset());
    }
    async exec(ggbAppletProperty, args) {
        const page = await this.pagePromise;
        await page.evaluate((prop, argz) => {
            const property = window.ggbApplet[prop];
            if (typeof (property) === "function") {
                return property.apply(window.ggbApplet, argz);
            }
            else {
                return property;
            }
        }, ggbAppletProperty, args);
    }
    async release() {
        const page = await this.pagePromise;
        await page.evaluate(() => window.ggbApplet.reset());
        if (this.releasedEmitter) {
            // notify to the cue that a worker has been released and must be returned to the pool
            this.releasedEmitter.emit("released", this);
        }
        if (this.browser) {
            await page.close();
            await this.browser.close();
        }
    }
}
exports.GGBPlotter = GGBPlotter;
//# sourceMappingURL=GGBPlotter.js.map