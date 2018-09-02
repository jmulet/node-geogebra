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
let window;
const DEBUG = false;
class GGBPlotter {
    constructor(id, page, releasedEmitter) {
        this.id = id || Math.random().toString(32).substring(2);
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
                yield newPage.goto("https://www.geogebra.org/classic");
                yield newPage.waitForFunction("window.ggbApplet!=null");
                yield newPage.evaluate('window.ggbApplet.evalCommand(\'SetPerspective("G")\\nShowGrid(true)\')');
                return newPage;
            }
        });
    }
    ready() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.pagePromise;
        });
    }
    evalGGBScript(width, height, ggbScript) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.pagePromise;
            // 53 px accounts for the toolbar which cannot be removed in geogebra app mode
            yield page.setViewport({ width: width, height: height + 53 });
            yield page.evaluate((x) => window.ggbApplet.evalCommand(x), ggbScript.join("\n"));
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
            return page.evaluate((alpha, dpi) => window.ggbApplet.getPNGBase64(1, alpha, dpi || 300), alpha, dpi);
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