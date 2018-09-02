/// <reference types="node" />
import * as puppeteer from 'puppeteer';
import { EventEmitter } from 'events';
import { GGBPlotter } from './GGBPlotter';
import { PriorityQueue } from './PriorityQueue';
import { GGBOptions } from './GGBOptions';
export declare class GGBPool {
    browser: puppeteer.Browser;
    availableWorkers: GGBPlotter[];
    usedWorkers: GGBPlotter[];
    releasedEmitter: EventEmitter;
    priorityCue: PriorityQueue;
    isCreated: boolean;
    availablePages: puppeteer.Page[];
    opts: GGBOptions;
    constructor(options?: GGBOptions);
    ready(): Promise<GGBPool>;
    private pickaWorker;
    getGGBPlotter(): Promise<GGBPlotter>;
    release(): Promise<void>;
}
