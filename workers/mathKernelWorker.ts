/**
 * Math Kernel & Kinematics Offscreen Canvas Rendering Worker
 * Runs heavy canvas drawing and history buffering on a background thread.
 */

type TraceSeries = {
    key: string;
    color: string;
    scale: number;
};

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let telemetryHistory: { [key: string]: Float32Array } = {};
let head = 0;
let historyLength = 150;
let min = 0;
let max = 100;
let showGrid = true;
let seriesList: TraceSeries[] = [];
let rafId: any = null;

function loop() {
    if (!ctx || !canvas) {
        if (typeof self !== 'undefined' && 'requestAnimationFrame' in self) {
            rafId = self.requestAnimationFrame(loop);
        } else {
            rafId = setTimeout(loop, 16.67);
        }
        return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const range = max - min || 1;

    // Fast clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);

    // Draw background grid
    if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < w; i += w / 10) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
        }
        for (let j = 0; j < h; j += h / 4) {
            ctx.moveTo(0, j);
            ctx.lineTo(w, j);
        }
        ctx.stroke();
    }

    // Render each telemetry trace
    seriesList.forEach(s => {
        const data = telemetryHistory[s.key];
        if (!data) return;

        ctx!.beginPath();
        ctx!.strokeStyle = s.color;
        ctx!.lineWidth = 2.0;
        ctx!.lineCap = 'round';
        ctx!.lineJoin = 'round';

        const scale = s.scale || 1;

        for (let i = 0; i < historyLength; i++) {
            const idx = (head + i) % historyLength;
            const val = data[idx] * scale;
            const x = (i / (historyLength - 1)) * w;
            const y = h - ((val - min) / range) * h;
            if (i === 0) ctx!.moveTo(x, y);
            else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
    });

    if (typeof self !== 'undefined' && 'requestAnimationFrame' in self) {
        rafId = self.requestAnimationFrame(loop);
    } else {
        rafId = setTimeout(loop, 16.67);
    }
}

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            canvas = payload.canvas;
            ctx = canvas!.getContext('2d');
            
            if (payload.width && payload.height) {
                canvas!.width = payload.width;
                canvas!.height = payload.height;
            }
            
            if (payload.historyLength) historyLength = payload.historyLength;
            if (payload.min !== undefined) min = payload.min;
            if (payload.max !== undefined) max = payload.max;
            if (payload.showGrid !== undefined) showGrid = payload.showGrid;
            if (payload.series) {
                seriesList = payload.series;
                seriesList.forEach(s => {
                    telemetryHistory[s.key] = new Float32Array(historyLength);
                });
            }

            if (!rafId) {
                loop();
            }
            break;

        case 'resize':
            if (canvas) {
                canvas.width = payload.width;
                canvas.height = payload.height;
            }
            break;

        case 'update_config':
            if (payload.min !== undefined) min = payload.min;
            if (payload.max !== undefined) max = payload.max;
            if (payload.showGrid !== undefined) showGrid = payload.showGrid;
            if (payload.historyLength && payload.historyLength !== historyLength) {
                const oldLen = historyLength;
                historyLength = payload.historyLength;
                seriesList.forEach(s => {
                    const newArr = new Float32Array(historyLength);
                    if (telemetryHistory[s.key]) {
                        newArr.set(telemetryHistory[s.key].subarray(0, Math.min(oldLen, historyLength)));
                    }
                    telemetryHistory[s.key] = newArr;
                });
                head = head % historyLength;
            }
            break;

        case 'data':
            const { d } = payload;
            seriesList.forEach(s => {
                if (!telemetryHistory[s.key]) {
                    telemetryHistory[s.key] = new Float32Array(historyLength);
                }
                telemetryHistory[s.key][head] = d[s.key] || 0;
            });
            head = (head + 1) % historyLength;
            break;
    }
};
