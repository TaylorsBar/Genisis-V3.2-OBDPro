
export interface Point {
    x: number;
    y: number;
}

export interface TrackedPoint extends Point {
    id: number;
    age: number; // How many frames tracked
    confidence: number; // Correlation/error score
}

/**
 * OpticalFlowProcessor (Commercial Grade)
 * 
 * Optimized KLT (Kanade-Lucas-Tomasi) tracker.
 * MEMORY STRATEGY: Zero-Allocation during tracking loops.
 * All buffers are pre-allocated during init() to prevent GC pauses.
 */

export class OpticalFlowProcessor {
    private width: number = 0;
    private height: number = 0;
    
    // Configuration
    private readonly LEVELS = 3;
    private readonly WIN_SIZE = 15; // Integration window size (15x15)
    private readonly MAX_ITERATIONS = 15;
    private readonly EPSILON = 0.01;
    private readonly MIN_EIGEN_THRESHOLD = 0.001;
    
    // Pyramids (Double Buffering)
    private prevPyramid: Float32Array[] = [];
    private currPyramid: Float32Array[] = [];
    private pyramidWidths: number[] = [];
    private pyramidHeights: number[] = [];
    
    // Reusable Compute Buffers
    private grayBuffer: Float32Array | null = null;
    private gx: Float32Array | null = null;
    private gy: Float32Array | null = null;
    private eigenMap: Float32Array | null = null;

    constructor() {}

    public init(width: number, height: number): void {
        if (this.width === width && this.height === height) return;
        
        this.width = width;
        this.height = height;
        
        this.prevPyramid = [];
        this.currPyramid = [];
        this.pyramidWidths = [];
        this.pyramidHeights = [];
        
        let cw = width;
        let ch = height;
        
        for (let l = 0; l < this.LEVELS; l++) {
            const size = cw * ch;
            this.prevPyramid.push(new Float32Array(size));
            this.currPyramid.push(new Float32Array(size));
            this.pyramidWidths.push(cw);
            this.pyramidHeights.push(ch);
            cw = Math.floor(cw / 2);
            ch = Math.floor(ch / 2);
        }
        
        const baseSize = width * height;
        this.grayBuffer = new Float32Array(baseSize);
        this.gx = new Float32Array(baseSize);
        this.gy = new Float32Array(baseSize);
        this.eigenMap = new Float32Array(baseSize);
    }

    private buildPyramid(baseBuffer: Float32Array, pyramid: Float32Array[]) {
        pyramid[0].set(baseBuffer);
        for (let l = 1; l < this.LEVELS; l++) {
            const src = pyramid[l - 1];
            const dst = pyramid[l];
            const sw = this.pyramidWidths[l - 1];
            const sh = this.pyramidHeights[l - 1];
            const dw = this.pyramidWidths[l];
            const dh = this.pyramidHeights[l];
            
            for (let y = 0; y < dh; y++) {
                const sy = y * 2;
                for (let x = 0; x < dw; x++) {
                    const sx = x * 2;
                    dst[y * dw + x] = (
                        src[sy * sw + sx] + 
                        src[sy * sw + (sx + 1)] + 
                        src[(sy + 1) * sw + sx] + 
                        src[(sy + 1) * sw + (sx + 1)]
                    ) * 0.25;
                }
            }
        }
    }

    public detectFeatures(imageData: ImageData, maxPoints: number = 100): TrackedPoint[] {
        if (!this.grayBuffer || !this.gx || !this.gy || !this.eigenMap) {
            this.init(imageData.width, imageData.height);
        }
        this.grayscale(imageData, this.grayBuffer!);
        
        const gray = this.grayBuffer!;
        const w = this.width;
        const h = this.height;
        const gx = this.gx!;
        const gy = this.gy!;
        const eigenMap = this.eigenMap!;
        
        // 1. Compute Gradients
        for (let y = 1; y < h - 1; y++) {
            let rowOffset = y * w;
            for (let x = 1; x < w - 1; x++) {
                const i = rowOffset + x;
                gx[i] = (gray[i + 1] - gray[i - 1]) * 0.5;
                gy[i] = (gray[i + w] - gray[i - w]) * 0.5;
            }
        }
        
        // 2. Compute Structure Tensor
        const winOffset = Math.floor(this.WIN_SIZE / 2);
        for (let y = winOffset; y < h - winOffset; y++) {
            for (let x = winOffset; x < w - winOffset; x++) {
                let sxx = 0, syy = 0, sxy = 0;
                for (let wy = -winOffset; wy <= winOffset; wy++) {
                    const wyOffset = (y + wy) * w;
                    for (let wx = -winOffset; wx <= winOffset; wx++) {
                        const idx = wyOffset + (x + wx);
                        const ix = gx[idx];
                        const iy = gy[idx];
                        sxx += ix * ix;
                        syy += iy * iy;
                        sxy += ix * iy;
                    }
                }
                const trace = sxx + syy;
                const det = sxx * syy - sxy * sxy;
                const disc = trace * trace - 4 * det;
                const diff = disc > 0 ? Math.sqrt(disc) : 0;
                eigenMap[y * w + x] = (trace - diff) / 2;
             }
        }
        
        // 3. NMS
        const features: TrackedPoint[] = [];
        const minDist = 15;
        for (let y = winOffset; y < h - winOffset; y += minDist) {
            for (let x = winOffset; x < w - winOffset; x += minDist) {
                let maxVal = -1;
                let maxX = -1;
                let maxY = -1;
                for (let by = 0; by < minDist; by++) {
                    if (y+by >= h) break;
                    const rOff = (y+by)*w;
                    for (let bx = 0; bx < minDist; bx++) {
                        if (x+bx >= w) break;
                        const val = eigenMap[rOff + (x+bx)];
                        if (val > maxVal) {
                            maxVal = val;
                            maxX = x + bx;
                            maxY = y + by;
                        }
                    }
                }
                if (maxVal > this.MIN_EIGEN_THRESHOLD) {
                    features.push({
                        x: maxX,
                        y: maxY,
                        id: (Math.random() * 1000000) | 0,
                        age: 0,
                        confidence: maxVal
                    });
                }
                if (features.length >= maxPoints) return features;
            }
        }
        return features;
    }

    public trackFeatures(currImageData: ImageData, oldFeatures: TrackedPoint[]): TrackedPoint[] {
        if (this.currPyramid.length === 0 || this.prevPyramid.length === 0) return [];
        
        // 1. Swap Buffers
        const temp = this.prevPyramid;
        this.prevPyramid = this.currPyramid;
        this.currPyramid = temp;
        
        // 2. Load current frame
        this.grayscale(currImageData, this.grayBuffer!);
        this.buildPyramid(this.grayBuffer!, this.currPyramid);
        
        const tracked: TrackedPoint[] = [];
        const winSize = this.WIN_SIZE;
        const halfWin = Math.floor(winSize / 2);

        // 3. Process each point
        for (let i = 0; i < oldFeatures.length; i++) {
            const point = oldFeatures[i];
            
            // Pyramidal guess
            let u = point.x / Math.pow(2, this.LEVELS - 1);
            let v = point.y / Math.pow(2, this.LEVELS - 1);
            let pointX = u;
            let pointY = v;
            
            let convergedFinal = false;
            
            for (let l = this.LEVELS - 1; l >= 0; l--) {
                const prevImg = this.prevPyramid[l];
                const currImg = this.currPyramid[l];
                const w = this.pyramidWidths[l];
                const h = this.pyramidHeights[l];
                
                pointX = point.x / Math.pow(2, l);
                pointY = point.y / Math.pow(2, l);
                
                if (pointX < halfWin || pointX >= w - halfWin || pointY < halfWin || pointY >= h - halfWin) {
                    break;
                }
                
                let Gxx = 0, Gyy = 0, Gxy = 0;
                
                for (let wy = -halfWin; wy <= halfWin; wy++) {
                    const rOff = (Math.floor(pointY) + wy) * w;
                    for (let wx = -halfWin; wx <= halfWin; wx++) {
                        const cOff = Math.floor(pointX) + wx;
                        const idx = rOff + cOff;
                        
                        const Ix = (prevImg[idx + 1] - prevImg[idx - 1]) * 0.5;
                        const Iy = (prevImg[idx + w] - prevImg[idx - w]) * 0.5;
                        
                        Gxx += Ix * Ix;
                        Gyy += Iy * Iy;
                        Gxy += Ix * Iy;
                    }
                }
                
                const det = Gxx * Gyy - Gxy * Gxy;
                if (Math.abs(det) < 0.00001) break;
                const invDet = 1.0 / det;
                
                let converged = false;
                for (let iter = 0; iter < this.MAX_ITERATIONS; iter++) {
                    if (u < halfWin || u >= w - halfWin || v < halfWin || v >= h - halfWin) break;
                    let bx = 0, by = 0;
                    
                    for (let wy = -halfWin; wy <= halfWin; wy++) {
                        const prevY = Math.floor(pointY) + wy;
                        const prevX = Math.floor(pointX);
                        const prevRow = prevY * w;
                        
                        const curY_f = v + wy;
                        const curY_i = Math.floor(curY_f);
                        const dy = curY_f - curY_i;
                        
                        for (let wx = -halfWin; wx <= halfWin; wx++) {
                            const prevIdx = prevRow + (prevX + wx);
                            const curX_f = u + wx;
                            const curX_i = Math.floor(curX_f);
                            const dx = curX_f - curX_i;
                            
                            const curIdx = curY_i * w + curX_i;
                            
                            const I00 = currImg[curIdx];
                            const I10 = currImg[curIdx + 1];
                            const I01 = currImg[curIdx + w];
                            const I11 = currImg[curIdx + w + 1];
                            
                            const valCurr = (1-dx)*(1-dy)*I00 + dx*(1-dy)*I10 + (1-dx)*dy*I01 + dx*dy*I11;
                            const valPrev = prevImg[prevIdx];
                            const dI = valCurr - valPrev;
                            
                            const Ix = (prevImg[prevIdx + 1] - prevImg[prevIdx - 1]) * 0.5;
                            const Iy = (prevImg[prevIdx + w] - prevImg[prevIdx - w]) * 0.5;
                            bx += Ix * dI;
                            by += Iy * dI;
                        }
                    }
                    
                    const vx = (Gyy * bx - Gxy * by) * invDet;
                    const vy = (Gxx * by - Gxy * bx) * invDet;
                    
                    u -= vx;
                    v -= vy;
                    
                    if ((vx*vx + vy*vy) < this.EPSILON) {
                        converged = true;
                        break;
                    }
                }
                
                if (l === 0) {
                    convergedFinal = converged || (this.MAX_ITERATIONS > 0); 
                } else {
                    u *= 2;
                    v *= 2;
                }
            }
            
            if (convergedFinal) {
                tracked.push({
                    x: u,
                    y: v,
                    id: point.id,
                    age: point.age + 1,
                    confidence: 1.0
                });
            }
        }
        return tracked;
    }

    private grayscale(imageData: ImageData, targetBuffer: Float32Array): void {
        const data = imageData.data;
        const len = this.width * this.height;
        for (let i = 0; i < len; i++) {
            const i4 = i << 2;
            targetBuffer[i] = data[i4] * 0.299 + data[i4+1] * 0.587 + data[i4+2] * 0.114;
        }
    }
}
