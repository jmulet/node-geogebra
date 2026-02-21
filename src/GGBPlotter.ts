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
import { GGBOptions } from './GGBOptions';
import * as path from 'path';

let window: any;
const DEBUG = false;

/**
 * A single GeoGebra plotter backed by a headless Chromium page.
 *
 * `GGBPlotter` wraps one Puppeteer {@link puppeteer.Page} that has the
 * GeoGebra Classic app loaded.  It exposes a high-level API to:
 *
 * - Evaluate GGBScript commands ({@link evalGGBScript})
 * - Export the current construction as PNG, SVG, PDF, or `.ggb`
 * - Reset or release the underlying browser resources
 *
 * **Standalone usage** (manages its own browser):
 * ```ts
 * const plotter = new GGBPlotter({ ggb: "local" });
 * await plotter.ready();
 * await plotter.evalGGBScript(["f=sin(x)"], 600, 400);
 * const png = await plotter.exportPNG();
 * await plotter.release();
 * ```
 *
 * **Pool usage** (browser managed by {@link GGBPool}):
 * ```ts
 * const plotter = await pool.getGGBPlotter();
 * await plotter.evalGGBScript(["f=cos(x)"], 600, 400);
 * await plotter.release(); // returns worker to the pool
 * ```
 */
export class GGBPlotter {
    /**
     * Event emitter shared with the owning {@link GGBPool}.
     * When the plotter is released it emits `"released"` so the pool can
     * reclaim the worker.  `undefined` for standalone plotters.
     */
    releasedEmitter: EventEmitter | undefined;

    /**
     * Unique identifier for this plotter.
     * Pool workers use a numeric index (`1`, `2`, …); standalone plotters
     * receive a random alphanumeric string.
     */
    id: string | number;

    /** Resolved options in effect for this plotter instance. */
    poolOpts: GGBOptions;

    /**
     * Promise that resolves with the underlying Puppeteer page once the
     * GeoGebra applet is fully initialised.  Await {@link ready} instead of
     * accessing this directly.
     */
    pagePromise: Promise<puppeteer.Page>;

    /**
     * Puppeteer browser instance.  Only set for standalone plotters that own
     * their browser; pool workers leave this `undefined`.
     */
    browser: puppeteer.Browser;

    /** Current viewport width in pixels (excluding the GeoGebra toolbar). */
    width: number = 600;

    /** Current viewport height in pixels (excluding the GeoGebra toolbar). */
    height: number = 400;

    /**
     * Creates a new `GGBPlotter`.
     *
     * @param id - When called by user code, pass a {@link GGBOptions} object to
     *   configure the plotter (e.g. `{ ggb: "local", perspective: "G" }`).
     *   When called internally by {@link GGBPool}, pass the numeric worker
     *   index.  Omit entirely to use defaults.
     * @param page - An already-open Puppeteer page.  Supplied by {@link GGBPool};
     *   omit for standalone use (the plotter will launch its own browser).
     * @param releasedEmitter - Internal event emitter used by the pool to be
     *   notified when this plotter is released.
     */
    constructor(id?: number | GGBOptions, page?: puppeteer.Page, releasedEmitter?: EventEmitter) {
        if (id) {
            if (typeof (id) == "number") {
                this.id = id;
                this.poolOpts = { plotters: 1, ggb: "local" };
            } else {
                this.poolOpts = { plotters: 3, ggb: "local", ...id };
                this.id = Math.random().toString(36).substring(2).padStart(8, '0');
            }
        } else {
            this.poolOpts = { plotters: 3, ggb: "local" };
            this.id = Math.random().toString(36).substring(2).padStart(8, '0');
        }
        this.pagePromise = this.createPage(page);
        this.releasedEmitter = releasedEmitter;
    }

    /**
     * Launches (or reuses) a Puppeteer page and waits for the GeoGebra applet
     * to become fully functional before resolving.
     *
     * @param page - An existing page supplied by the pool, or `undefined` to
     *   launch a fresh browser.
     * @returns The initialised Puppeteer page.
     */
    private async createPage(page: puppeteer.Page): Promise<puppeteer.Page> {
        if (page) {
            return page;
        } else {
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

            DEBUG && console.log("Launching browser with options: ", opts);
            this.browser = await puppeteer.launch(opts);
            DEBUG && console.log("Browser launched successfully");
            const newPage = await this.browser.newPage();
            let url;
            if (this.poolOpts.ggb === "local") {
                const dir = path.resolve(__dirname, "../geogebra-math-apps-bundle/GeoGebra/HTML5/5.0/GeoGebra.html");
                url = "file://" + dir;
            } else {
                url = "https://www.geogebra.org/classic";
            }
            DEBUG && console.log("Navigating to: " + url);
            await newPage.goto(url, { waitUntil: 'domcontentloaded' });
            DEBUG && console.log(url + " has been loaded");
            DEBUG && console.log("Waiting for window.ggbApplet to be fully functional...");
            let perspective = this.poolOpts.perspective || "G";
            // Map common aliases
            if (perspective === "3" || perspective === "3D") perspective = "T";

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
                } catch (e) {
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

    /**
     * Waits until the GeoGebra applet is fully initialised and ready to
     * receive commands.
     *
     * For standalone plotters this also waits for the browser to launch.
     * Calling this method is optional but useful for measuring startup time.
     *
     * @returns The underlying Puppeteer page once ready.
     *
     * @example
     * ```ts
     * const plotter = new GGBPlotter({ ggb: "local" });
     * await plotter.ready();  // startup complete
     * ```
     */
    async ready() {
        return this.pagePromise;
    }

    /**
     * Evaluates an array of GGBScript commands in the GeoGebra applet and
     * sets the viewport to the given dimensions.
     *
     * Each element of `ggbScript` is a single GeoGebra scripting command (see
     * https://wiki.geogebra.org/en/Scripting_Commands).  They are joined with
     * newlines and passed to `window.ggbApplet.evalCommand`.
     *
     * @param ggbScript - Array of GGBScript command strings to execute.
     * @param width     - Desired graph width in pixels. Defaults to `600`.
     * @param height    - Desired graph height in pixels. Defaults to `400`.
     *
     * @example
     * ```ts
     * await plotter.evalGGBScript([
     *     "f = sin(x)",
     *     "A = (1, f(1))",
     *     "t = Tangent(f, A)",
     * ], 800, 600);
     * ```
     */
    async evalGGBScript(ggbScript: string[], width?: number, height?: number) {
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

    /**
     * Exports the current construction as a PNG image buffer.
     *
     * @param alpha - When `true`, the background is transparent. Default `false`.
     * @param dpi   - Resolution in dots per inch. Default `300`.
     * @returns A `Buffer` containing the raw PNG bytes.
     */
    async exportPNG(alpha?: boolean, dpi?: number): Promise<Buffer> {
        const pdf64 = await this.exportPNG64(alpha, dpi);
        const raw = pdf64.replace("data:image/png;base64,", "");
        return Buffer.from(raw, 'base64');
    }

    /**
     * Exports the current construction as a base64-encoded PNG data URL.
     *
     * @param alpha - When `true`, the background is transparent. Default `false`.
     * @param dpi   - Resolution in dots per inch. Default `300`.
     * @returns A string of the form `"data:image/png;base64,<data>"`.
     */
    async exportPNG64(alpha?: boolean, dpi?: number): Promise<string> {
        const page = await this.pagePromise;
        const out = await page.evaluate((alpha, dpi) => window.ggbApplet.getPNGBase64(1, !!alpha, dpi || 300), alpha, dpi) as string;
        return "data:image/png;base64," + out;
    }

    /**
     * Exports the current construction as an SVG string.
     *
     * @returns The raw SVG markup as a `string`.
     */
    async exportSVG(): Promise<string> {
        const page = await this.pagePromise;
        return page.evaluate(() => new Promise((resolve) => {
            window.ggbApplet.exportSVG((data: string) => resolve(data));
        })) as Promise<string>;
    }

    /**
     * Exports the current construction as a base64-encoded SVG data URL.
     *
     * @returns A string of the form `"data:image/svg+xml;base64,<data>"`.
     */
    async exportSVG64(): Promise<string> {
        const svg = await this.exportSVG();
        return "data:image/svg+xml;base64," + Buffer.from(svg).toString('base64');
    }

    /**
     * Exports the current construction as a PDF buffer.
     *
     * @returns A `Buffer` containing the raw PDF bytes.
     */
    async exportPDF(): Promise<Buffer> {
        const pdf64 = await this.exportPDF64();
        const prefix = "data:application/pdf;base64,";
        const raw = (pdf64.startsWith(prefix) ? pdf64.substring(prefix.length) : pdf64).trim();
        return Buffer.from(raw, 'base64');
    }

    /**
     * Exports the current construction as a base64-encoded PDF data URL.
     *
     * A short settling delay is applied before the export to allow the
     * GeoGebra rendering engine to finish drawing.
     *
     * @returns A string of the form `"data:application/pdf;base64,<data>"`.
     */
    async exportPDF64(): Promise<string> {
        const page = await this.pagePromise;
        // Small delay to ensure rendering engine has settled
        await new Promise(r => setTimeout(r, 500));
        return page.evaluate(() => new Promise((resolve) => {
            // GeoGebra 5 signature: exportPDF(scale, callback, sliderLabel)
            window.ggbApplet.exportPDF(1, (data: string) => resolve(data));
        })) as Promise<string>;
    }

    /**
     * Exports the current construction as a `.ggb` file buffer (ZIP archive).
     *
     * @returns A `Buffer` containing the raw `.ggb` bytes.
     */
    async exportGGB(): Promise<Buffer> {
        const raw = await this.exportGGB64();
        return Buffer.from(raw, 'base64');
    }

    /**
     * Exports the current construction as a base64-encoded `.ggb` string.
     *
     * @returns A base64 string representing the `.ggb` ZIP archive.
     */
    async exportGGB64(): Promise<string> {
        const page = await this.pagePromise;
        return page.evaluate(() => window.ggbApplet.getBase64());
    }

    /**
     * Convenience method that exports to the given format and returns a
     * `Buffer` (binary formats) or raw `string` (SVG).
     *
     * @param format - One of `"png"`, `"pngalpha"`, `"pdf"`, `"svg"`, `"ggb"`.
     *   Unknown values fall back to `"png"`.
     * @returns A `Buffer` for `png`, `pngalpha`, `pdf`, `ggb`; a `string` for `svg`.
     *
     * @example
     * ```ts
     * const buf = await plotter.export("pdf");
     * fs.writeFileSync("output.pdf", buf);
     * ```
     */
    async export(format: string): Promise<string | Buffer> {
        switch (format) {
            case ("png"): return this.exportPNG();
            case ("pngalpha"): return this.exportPNG(true);
            case ("pdf"): return this.exportPDF();
            case ("svg"): return this.exportSVG();
            case ("ggb"): return this.exportGGB();
            default: return this.exportPNG();
        }
    }

    /**
     * Convenience method that exports to the given format and returns a
     * base64 data URL string (suitable for embedding in HTML or sending over
     * HTTP).
     *
     * @param format - One of `"png"` (default), `"pngalpha"`, `"pdf"`, `"svg"`,
     *   `"ggb"`.
     * @returns A base64 data URL string.
     *
     * @example
     * ```ts
     * const dataUrl = await plotter.export64("svg");
     * // → "data:image/svg+xml;base64,..."
     * ```
     */
    async export64(format: string): Promise<string> {
        switch (format) {
            case ("pngalpha"): return this.exportPNG64(true);
            case ("pdf"): return this.exportPDF64();
            case ("svg"): return this.exportSVG64();
            case ("ggb"): return this.exportGGB64();
            default: return this.exportPNG64();
        }
    }

    /**
     * Clears all objects from the current GeoGebra construction without
     * closing the browser or returning the worker to the pool.
     *
     * Use this to prepare the plotter for a new script while keeping it
     * allocated.  Call {@link release} when you are completely done.
     */
    async reset() {
        const page = await this.pagePromise;
        await page.evaluate(() => window.ggbApplet.reset());
    }

    /**
     * Executes an arbitrary property or method on the `window.ggbApplet`
     * object and returns the result.
     *
     * This is an escape hatch for GeoGebra API calls not exposed directly by
     * `GGBPlotter`.  If `property` is a function it is invoked with `args`;
     * otherwise the property value is returned as-is.
     *
     * @param ggbAppletProperty - Name of the property or method on
     *   `window.ggbApplet` (e.g. `"getValueString"`).
     * @param args - Arguments forwarded to the method when it is a function.
     * @returns Whatever the applet property/method returns, serialised through
     *   the Puppeteer page boundary.
     *
     * @example
     * ```ts
     * const xml = await plotter.exec("getXML");
     * const val = await plotter.exec("getValue", ["a"]);
     * ```
     */
    async exec(ggbAppletProperty: string, args?: any[]): Promise<any> {
        const page = await this.pagePromise;
        return page.evaluate((prop, argz) => {
            const property = window.ggbApplet[prop];
            if (typeof property === "function") {
                return property.apply(window.ggbApplet, argz);
            } else {
                return property;
            }
        }, ggbAppletProperty, args);
    }

    /**
     * Resets the construction and releases all resources held by this plotter.
     *
     * - If the plotter belongs to a {@link GGBPool}, emitting `"released"`
     *   returns it to the pool for reuse; the browser and page are kept alive.
     * - If the plotter is standalone (i.e. it owns its browser), the page and
     *   browser are closed.
     *
     * > **Important:** the Node.js process will not exit until every plotter
     * > (and pool) has been released.
     */
    async release() {
        const page = await this.pagePromise;
        await page.evaluate(() => window.ggbApplet.reset());
        if (this.releasedEmitter) {
            // notify to the queue that a worker has been released and must be returned to the pool
            this.releasedEmitter.emit("released", this);
        }
        if (this.browser) {
            await page.close();
            await this.browser.close();
        }
    }
}