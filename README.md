# ![logo](./docs/nodeggb.png) node-geogebra 

Run a [geogebra](https://www.geogebra.org) script from nodejs and export your work to the desired format: _pdf, svg, png_ and _ggb_.

## Under the hood

It runs [Geogebra Classic App](https://www.geogebra.org/classic) through a headless chromium browser using the [puppeteer](https://github.com/GoogleChrome/puppeteer) package. This package provides an interface to programmatically utilize Geogebra classic app from nodejs.


## Install

`npm i --save node-geogebra`

## Build

```
npm i -g typescript
tsc
```

## Classes

```javascript
const GGB = require('node-geogebra');
```

**GGBPool**

- constructor **GGBPool**(**options**?: GGBOptions)
  
  Options parameters:
    - **ggb** (default local): local or remote. Whether to load Geogebra classic app from the local copy or remotely from https://www.geogebra.org/classic 
    - **plotters** (default 3): number of plotters in the pool
  
  Methods:

    - async **ready()**: When resolved, the pool is ready to use
    - async **getGGBPlotter()**: Picks a plotter from the pool
    - async **release()**: Closes the pool. Please note that the nodejs process would not end unless you call this method.

```javascript
// Pool options
const poolOpts = {
    plotters: 3,    //Number of plotters in the pool
    ggb: 'local'    //local or remote: From where to load Geogebra app
};
const pool = new GGB.GGBPool(poolOpts);
await pool.ready();
// From now on, you can start taking plotters from the pool
```

**GGBPlotter**

- constructor **GGBPlotter**({ggb: "remote or local"})
- constructor **GGBPlotter**(id?: number, page?: puppeteer.Page, releasedEmitter?: EventEmitter)
  
  Optional parameters:
    - **id** (default is randomly generated): string identifier 
    - **page**: If not passed then is generated
    - **releasedEmitter**: Internally used by the GGBPool
  
  Methods:

    - async **ready()**: Promise<Page>. When resolved, the plotter is ready to use
    - async **reset()**. Erases the plotter.
    - async **release()**. Erases and returns the plotter to the pool
    - async **evalGGBScript(script: string[], width: number?, height?: number )**. Sets the dimensions of the graph. _script_ is an array that contains all the instructions required to generate your graph. The language used in these commands must be [GGBScript](https://wiki.geogebra.org/en/Scripting_Commands). Internally, this method passes the GGBScript to the window.ggbApplet.evalCommand function.
    - async **exec(property, args: string[])**: any. Executes the property on the window.ggbApplet object. For instance plotter.exec("reset") would do the same job as plotter.reset()
    - async **export(format: string)**: string or buffer. format can be: png, pdf, svg, ggb. It returns a buffer or a string depending on the format.
    - async **export64(format: string)**: string. format can be: png, pdf, svg, ggb. It returns a string containing a base64 representation of the buffer.
    - async exportPNG(alpha: boolean, dpi: number): Buffer
    - async exportPNG64(alpha: boolean, dpi: number): String
    - async exportPDF(): Buffer
    - async exportPDF64(): String
    - async exportSVG(): Buffer
    - async exportSVG64(): String
    - async exportGGB(): Buffer
    - async exportGGB64(): String

Example using a set of pooled plotters

```javascript
   const plotter = await pool.getGGBPlotter();
   const ggbScript = [
       "A=(2,5)", "f=cos(x)", "t=Tangent(f,A)"
   ];
   await plotter.evalGGBScript(ggbScript, 600, 400);
   const svg64 = await plotter.export64("svg");
   console.log(svg64)
   await plotter.release(); 
```

Example without using GGBPool

```javascript
   const GGBPlotter = require("node-geogebra").GGBPlotter;
   const plotter = new GGBPlotter({ggb: "local"});
   const ggbScript = [
       "A=(2,5)", "f=cos(x)", "t=Tangent(f,A)"
   ];
   await plotter.evalGGBScript(ggbScript);
   const svg64 = await plotter.export64("svg");
   console.log(svg64)
   await plotter.release(); 
```


## Examples

We provide two examples: one using a single GGBPlotter and a second one with a GGBPool.

```
cd examples
node simple.js
node pooled.js
```

Every example generates a number of files which can be opened.