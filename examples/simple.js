const GGBPlotter = require("../dist/GGBPlotter").GGBPlotter;
const fs = require("fs");

const plotter = new GGBPlotter();

(async () => {
    const t0 = new Date();
    // Not necessary, only of testing time required
    await plotter.ready();
    const t1 = new Date();
    
    console.log("> Startup time", t1.getTime()-t0.getTime());
  
    const t2 = new Date();
    async function doFunGraph(task, axisScales, dimensions, ext) { 
        // This is the desired image size in pixels
        const w = dimensions[0];
        const h = dimensions[1];  
        
        const xA = Math.random()*Math.PI;
        const ggbScript = [
            "f="+task+"(x)", 
            "A=("+xA+",f("+xA+"))",             
            "t=Tangent(f, A)",
            "SetColor(f, blue)",            
            "SetLineStyle(t, 1)",
            "ZoomIn("+ axisScales.join(",")+")"];

        await plotter.evalGGBScript(w, h, ggbScript);
        console.log(task + ":: has been evaluated in plotter id=" + plotter.id);
        const fileContents = await plotter.export(ext);
        console.log(task + ":: pdf has been exported in plotter id= " + plotter.id);
        fs.writeFileSync("simple-ggb-" + task + "." + ext, fileContents);         
        await plotter.reset();
        console.log(task + ":: plotter "+ plotter.id + " has been erased.");
    }
  
    /*
     * In this example we are using a single plotter, so calls must be
     * in series otherwise plot commands interfere in the same file. 
     * If you need parallel plotting look at pooled.js example
     */
    await doFunGraph("sin", [-6,-2,6,2], [300,200], "pdf");
    await doFunGraph("cos", [-10,-1,10,1], [400,300], "png")
    await doFunGraph("tan", [-3,-4,3,4], [800, 600], "svg");
    await doFunGraph("arctan", [-10,-3,10,3], [500, 500], "ggb");
    const t3 = new Date();
  
    console.log("Plotting Time ", t3.getTime()-t2.getTime(), " ms")
  
    /*
     * Node process would not finish unless you release the plotter 
     */
    await plotter.release();
    console.log("plotter "+ plotter.id + " has been released.");
  })()
