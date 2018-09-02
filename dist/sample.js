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
const node_ggb_1 = require("./node-ggb");
const fs = require("fs");
(() => __awaiter(this, void 0, void 0, function* () {
    const t0 = new Date();
    const pool = new node_ggb_1.GGBPool(2);
    yield pool.create();
    const t1 = new Date();
    console.log("Startup time", t1.getTime() - t0.getTime());
    const t2 = new Date();
    function doGraph(taskNum, axisScales) {
        return __awaiter(this, void 0, void 0, function* () {
            const worker = yield pool.getGGBWorker();
            console.log(taskNum + ":: OBTAINED WORKER_" + worker.id);
            // This is the desired image size in pixels
            const w = Math.floor(Math.random() * 100 + 200);
            const h = Math.floor(Math.random() * 100 + 150);
            const dx = axisScales[1] - axisScales[0];
            const dy = axisScales[3] - axisScales[2];
            //Which must fit the entire axisScales, so we must adjust the axis ratios accordingly
            const ratios = [dx, dy];
            const ggbScript = [
                "A=(" + Math.random() + "," + Math.random() + ")",
                "f=" + taskNum + "(" + Math.random() + "*x)",
                "SetColor(f, blue)",
                "SetAxesRatio(" + ratios.join(",") + ")",
                "ZoomIn(" + axisScales.join(",") + ")"
            ];
            yield worker.eval(w, h, ggbScript);
            console.log(taskNum + ":: EVAL WORKER_" + worker.id);
            const pdf = yield worker.exportPDF();
            console.log(taskNum + ":: PDF WORKER_" + worker.id + " --> ");
            fs.writeFileSync("prova-ggb-task" + taskNum + ".pdf", pdf);
            yield worker.release();
            console.log(taskNum + ":: RELEASED WORKER_" + worker.id);
        });
    }
    yield Promise.all([doGraph("sin", [-6, 6, -2, 2]), doGraph("cos", [-10, 10, -1, 1]), doGraph("tan", [-3, 3, -4, 4])]);
    const t3 = new Date();
    console.log("Plotting Time ", t3.getTime() - t2.getTime(), " ms");
    yield pool.release();
}))();
//# sourceMappingURL=sample.js.map