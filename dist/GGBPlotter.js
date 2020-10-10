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
exports.GGBPlotter = void 0;
const puppeteer = require("puppeteer");
const path = require("path");
let window;
const DEBUG = false;
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
class GGBPlotter {
    constructor(id, page, releasedEmitter) {
        if (id) {
            if (typeof (id) == "number") {
                this.id = id;
            }
            else {
                this.poolOpts = Object.assign({ plotters: 3, ggb: "local" }, id);
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
    createPage(page) {
        return __awaiter(this, void 0, void 0, function* () {
            if (page) {
                return page;
            }
            else {
                const opts = {
                    devtools: false,
                    args: ["--allow-file-access-from-files", "--non-secure",
                        "--allow-running-insecure-content", "--no-sandbox",
                        "--no-startup-window"]
                };
                this.browser = yield puppeteer.launch(opts);
                const newPage = yield this.browser.newPage();
                let url;
                if (this.poolOpts.ggb === "local") {
                    const dir = path.resolve(__dirname, "../geogebra-math-apps-bundle/Geogebra/HTML5/5.0/GeoGebra.html");
                    url = "file://" + dir;
                }
                else {
                    url = "https://www.geogebra.org/classic";
                }
                yield newPage.goto(url, { waitUntil: 'networkidle2' });
                DEBUG && console.log(url + " has been loaded");
                yield newPage.waitForFunction("window.ggbApplet!=null");
                DEBUG && console.log("ggbApplet is ready");
                yield newPage.evaluate('window.ggbApplet.evalCommand(\'SetPerspective("G")\\nShowGrid(true)\')');
                DEBUG && console.log("SetPerspective->G, showGrid->true");
                return newPage;
            }
        });
    }
    ready() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.pagePromise;
        });
    }
    evalGGBScript(ggbScript, width, height) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            // 53 px accounts for the toolbar which cannot be removed in geogebra app mode
            yield page.setViewport({ width: width || 600, height: (height || 400) + 53 });
            if (ggbScript && ggbScript.length) {
                yield page.evaluate((x) => window.ggbApplet.evalCommand(x), ggbScript.join("\n"));
            }
        });
    }
    exportPNG(alpha, dpi) {
        return __awaiter(this, void 0, void 0, function* () {
            const pdf64 = yield this.exportPNG64(alpha, dpi);
            const raw = pdf64.replace("data:image/png;base64,", "");
            return Buffer.from(raw, 'base64');
        });
    }
    exportPNG64(alpha, dpi) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            const out = yield page.evaluate((alpha, dpi) => window.ggbApplet.getPNGBase64(1, alpha, dpi || 300), alpha, dpi);
            return "data:image/png;base64," + out;
        });
    }
    exportSVG() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            return page.evaluate(() => window.ggbApplet.exportSVG());
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
            const page = yield this.pagePromise;
            return page.evaluate(() => window.ggbApplet.exportPDF());
        });
    }
    exportGGB() {
        return __awaiter(this, void 0, void 0, function* () {
            const raw = yield this.exportGGB64();
            return Buffer.from(raw, 'base64');
        });
    }
    exportGGB64() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            return page.evaluate(() => window.ggbApplet.getBase64());
        });
    }
    export(format) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (format) {
                case ("pngalpha"): return this.exportPNG(true);
                case ("pdf"): return this.exportPDF();
                case ("svg"): return this.exportSVG();
                case ("ggb"): return this.exportGGB();
                default: return this.exportPNG();
            }
        });
    }
    export64(format) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (format) {
                case ("pngalpha"): return this.exportPNG64(true);
                case ("pdf"): return this.exportPDF64();
                case ("svg"): return this.exportSVG64();
                case ("ggb"): return this.exportGGB64();
                default: return this.exportPNG64();
            }
        });
    }
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            yield page.evaluate(() => window.ggbApplet.reset());
        });
    }
    exec(ggbAppletProperty, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            yield page.evaluate((prop, argz) => {
                const property = window.ggbApplet[prop];
                if (typeof (property) === "function") {
                    return property.apply(window.ggbApplet, argz);
                }
                else {
                    return property;
                }
            }, ggbAppletProperty, args);
        });
    }
    release() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            yield page.evaluate(() => window.ggbApplet.reset());
            if (this.releasedEmitter) {
                // notify to the cue that a worker has been released and must be returned to the pool
                this.releasedEmitter.emit("released", this);
            }
            if (this.browser) {
                yield page.close();
                yield this.browser.close();
            }
        });
    }
}
exports.GGBPlotter = GGBPlotter;
//# sourceMappingURL=GGBPlotter.js.map