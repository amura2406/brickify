const { performance } = require('perf_hooks');

// Mock data (1920x1080 resolution, 4 channels)
const numPixels = 1920 * 1080;
const d1 = new Uint8ClampedArray(numPixels * 4);
const d2 = new Uint8ClampedArray(numPixels * 4);

// Fill with some random data
for (let i = 0; i < d1.length; i++) {
    d1[i] = Math.floor(Math.random() * 256);
    d2[i] = d1[i];
}

// Params
const p = {
    gamma: 2.2,
    black_point: 10,
    white_point: 240,
    contrast_boost: 1.1,
    saturation: 20,
    temperature: 5
};

const invGamma = 1.0 / p.gamma;
const bp = p.black_point;
const wp = p.white_point;
const range = (wp - bp) === 0 ? 1 : (wp - bp);
const contrast = p.contrast_boost;
const satFactor = 1.0 + (p.saturation / 100);
const tempVal = p.temperature;

function unoptimized() {
    const d = d1;
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];

        // Black/White Point + Gamma
        r = 255 * Math.pow(Math.max(0, Math.min(1, (r - bp) / range)), invGamma);
        g = 255 * Math.pow(Math.max(0, Math.min(1, (g - bp) / range)), invGamma);
        b = 255 * Math.pow(Math.max(0, Math.min(1, (b - bp) / range)), invGamma);

        // Contrast
        r = contrast * (r - 128) + 128;
        g = contrast * (g - 128) + 128;
        b = contrast * (b - 128) + 128;

        // Temperature (approx)
        r += tempVal;
        b -= tempVal;

        // Saturation
        const lum = 0.299*r + 0.587*g + 0.114*b;
        r = lum + satFactor * (r - lum);
        g = lum + satFactor * (g - lum);
        b = lum + satFactor * (b - lum);

        d[i] = Math.max(0, Math.min(255, r));
        d[i+1] = Math.max(0, Math.min(255, g));
        d[i+2] = Math.max(0, Math.min(255, b));
    }
}

function optimized() {
    const d = d2;

    // LUT generation
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
        lut[i] = 255 * Math.pow(Math.max(0, Math.min(1, (i - bp) / range)), invGamma);
    }

    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];

        // Black/White Point + Gamma from LUT
        r = lut[r];
        g = lut[g];
        b = lut[b];

        // Contrast
        r = contrast * (r - 128) + 128;
        g = contrast * (g - 128) + 128;
        b = contrast * (b - 128) + 128;

        // Temperature (approx)
        r += tempVal;
        b -= tempVal;

        // Saturation
        const lum = 0.299*r + 0.587*g + 0.114*b;
        r = lum + satFactor * (r - lum);
        g = lum + satFactor * (g - lum);
        b = lum + satFactor * (b - lum);

        d[i] = Math.max(0, Math.min(255, r));
        d[i+1] = Math.max(0, Math.min(255, g));
        d[i+2] = Math.max(0, Math.min(255, b));
    }
}

const RUNS = 50;

// Warmup
unoptimized();
optimized();

let unoptTime = 0;
let optTime = 0;

for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    unoptimized();
    const t1 = performance.now();
    unoptTime += (t1 - t0);
}

for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    optimized();
    const t1 = performance.now();
    optTime += (t1 - t0);
}

const avgUnopt = unoptTime / RUNS;
const avgOpt = optTime / RUNS;

console.log(`Unoptimized (Math.pow): ${avgUnopt.toFixed(2)} ms / frame`);
console.log(`Optimized (LUT): ${avgOpt.toFixed(2)} ms / frame`);
console.log(`Speedup: ${(avgUnopt / avgOpt).toFixed(2)}x faster`);
