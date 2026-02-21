/**
 * node-geogebra
 *
 * Copyright (c) 2026 Josep Mulet
 *
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Configuration options shared by both {@link GGBPlotter} and {@link GGBPool}.
 */
export interface GGBOptions {
    /**
     * Whether to load the GeoGebra Classic app from the bundled local copy
     * (`"local"`) or from https://www.geogebra.org/classic (`"remote"`).
     *
     * > **Note:** the `"remote"` option requires an active internet connection.
     * > Due to upstream API changes, `"remote"` may not produce correct exports.
     *
     * @default "local"
     */
    ggb?: "local" | "remote";

    /**
     * Number of {@link GGBPlotter} workers to create inside a {@link GGBPool}.
     * Ignored when constructing a standalone `GGBPlotter`.
     *
     * @default 3
     */
    plotters?: number;

    /**
     * Initial GeoGebra perspective to activate on every plotter/worker.
     *
     * | Value | View |
     * |-------|------|
     * | `"G"` | Graphing (default) |
     * | `"A"` | Algebra |
     * | `"S"` | Spreadsheet |
     * | `"T"` / `"3"` / `"3D"` | 3D Graphics |
     * | `"D"` | CAS |
     * | `"B"` | Probability Calculator |
     * | `"5"` | 3D with axes |
     *
     * @default "G"
     */
    perspective?: "G" | "A" | "S" | "T" | "D" | "B" | "3" | "3D" | "5";
}