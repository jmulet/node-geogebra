/**
 * node-geogebra
 * 
 * Copyright (c) 2026 Josep Mulet
 * 
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface GGBOptions {
    ggb?: "local" | "remote",
    plotters?: number,
    perspective?: string
}