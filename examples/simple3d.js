/**
 * node-geogebra
 * 
 * Copyright (c) 2026 Josep Mulet
 * 
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { GGBPlotter } = require("../dist/GGBPlotter");
const fs = require("fs");
const path = require("path");

const plotter = new GGBPlotter({ ggb: "local", perspective: "3" });

(async () => {
    await plotter.ready();
    console.log("> Plotter ready in 3D mode");

    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const ggbScript = [
        "f(x, y) = sin(x) * cos(y)",
        "CenterView((0, 0, 0))",
        "Rotate(f, 0.5, (0, 0, 1))"
    ];

    console.log("> Evaluating 3D script...");
    await plotter.evalGGBScript(ggbScript, 800, 600);

    // Allow some time for 3D engine to render
    await new Promise(r => setTimeout(r, 1000));

    console.log("> Exporting PNG...");
    const png = await plotter.exportPNG();
    fs.writeFileSync(path.join(outputDir, "simple3d.png"), png);

    console.log("> Done. saved to examples/output/simple3d.png");
    await plotter.release();
})();
