/**
 * node-geogebra
 * 
 * Copyright (c) 2026 Josep Mulet
 * 
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { GGBPool } = require("../dist/GGBPool");
const fs = require("fs");
const path = require("path");

const pool = new GGBPool({ ggb: "local", plotters: 2, perspective: "3" });

(async () => {
    await pool.ready();
    console.log("> Pool ready with 3D perspective");

    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    async function plot3D(task, formula) {
        const plotter = await pool.getGGBPlotter();
        console.log(`> Worker ${plotter.id} plotting ${task}`);

        await plotter.evalGGBScript([
            `f(x, y) = ${formula}`,
            "CenterView((0, 0, 0))"
        ], 600, 400);

        const png = await plotter.export64("png");
        fs.writeFileSync(path.join(outputDir, `pooled3d-${task}.png`), Buffer.from(png.replace("data:image/png;base64,", ""), 'base64'));

        await plotter.release();
        console.log(`> Worker ${plotter.id} released`);
    }

    await Promise.all([
        plot3D("surface1", "sin(x) + cos(y)"),
        plot3D("surface2", "x^2 - y^2")
    ]);

    await pool.release();
    console.log("> Done");
})();
