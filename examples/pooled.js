/**
 * node-geogebra
 * 
 * Copyright (c) 2026 Josep Mulet
 * 
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

const GGBPool = require("../dist/GGBPool").GGBPool;
const fs = require("fs");
const path = require("path");

// You can test the startup time by changing ggb to local or remote
// Please note that "remote" option is not working at the moment :-(
const pool = new GGBPool({ ggb: "local", plotters: 3 });

(async () => {
    const t0 = new Date();
    // It is required in the pool to wait its creation
    await pool.ready();
    const t1 = new Date();

    console.log("> Startup time", t1.getTime() - t0.getTime());

    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const t2 = new Date();
    async function doFunGraph(task, axisScales, dimensions, ext) {
        // Every plotting task takes a plotter from the pool
        const plotter = await pool.getGGBPlotter();
        console.log(task + ":: has taken from the pool, plotter id=" + plotter.id);
        // This is the desired image size in pixels
        const w = dimensions[0];
        const h = dimensions[1];

        const xA = Math.random() * Math.PI;
        const ggbScript = [
            "f=" + task + "(x)",
            "A=(" + xA + ",f(" + xA + "))",
            "t=Tangent(f, A)",
            "SetColor(f, blue)",
            "SetLineStyle(t, 1)",
            "ZoomIn(" + axisScales.join(",") + ")"];

        await plotter.evalGGBScript(ggbScript, w, h);
        console.log(task + ":: has been evaluated in plotter id=" + plotter.id);
        const fileContents = await plotter.export(ext);
        console.log(task + ":: " + ext + " has been exported in plotter id= " + plotter.id);
        const filePath = path.join(__dirname, "output", "pooled-ggb-" + task + "." + ext);
        fs.writeFileSync(filePath, fileContents);

        // Very important is to release the plotter to the pool. The reset method is not sufficient!
        await plotter.release();
        console.log(task + ":: plotter " + plotter.id + " has been erased & returned to the pool.");
    }

    /*
     * In this example we are using a a pool of plotters, so calls
     * can be run in parallel. 
     * If you need a series plotting look at simple.js example
     */
    await Promise.all([
        doFunGraph("sin", [-6, -2, 6, 2], [300, 200], "pdf"),
        doFunGraph("cos", [-10, -1, 10, 1], [400, 300], "png"),
        doFunGraph("tan", [-3, -4, 3, 4], [800, 600], "svg"),
        doFunGraph("arctan", [-10, -3, 10, 3], [500, 500], "ggb")
    ]);
    const t3 = new Date();

    console.log("Plotting Time ", t3.getTime() - t2.getTime(), " ms")

    /*
     * Node process would not finish unless you release the GGBPool 
     */
    await pool.release();
    console.log("GGBPool instance has been released.");
})()
