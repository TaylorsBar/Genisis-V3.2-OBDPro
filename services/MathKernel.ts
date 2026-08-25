
/**
 * Genesis Math Kernel (v2.2)
 * 
 * Tier-1 high-performance linear algebra engine and cryptographic primitives.
 * Optimized for real-time map optimization and ECU binary integrity.
 */

export class MathKernel {
    private static instance: MathKernel | null = null;
    private device: GPUDevice | null = null;
    private matMulPipeline: GPUComputePipeline | null = null;
    private kinematicsPipeline: GPUComputePipeline | null = null;
    private static readonly ROWS = 16;
    private static readonly COLS = 16;
    private static crcTable: Uint32Array | null = null;

    private constructor() {
        this.initWebGPU();
    }

    public static getInstance(): MathKernel {
        if (!this.instance) this.instance = new MathKernel();
        return this.instance;
    }

    private async initWebGPU() {
        if (typeof navigator === 'undefined' || !navigator.gpu) return;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) return;
            this.device = await adapter.requestDevice();

            this.matMulPipeline = this.device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: this.device.createShaderModule({
                        code: `
                            struct MatrixDims { rows: u32, cols: u32, common: u32, pad: u32 };
                            @group(0) @binding(0) var<uniform> dims: MatrixDims;
                            @group(0) @binding(1) var<storage, read> A: array<f32>;
                            @group(0) @binding(2) var<storage, read> B: array<f32>;
                            @group(0) @binding(3) var<storage, read_write> C: array<f32>;

                            @compute @workgroup_size(8, 8)
                            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                                if (id.x >= dims.cols || id.y >= dims.rows) { return; }
                                var sum = 0.0;
                                for (var k = 0u; k < dims.common; k = k + 1u) {
                                    sum = sum + A[id.y * dims.common + k] * B[k * dims.cols + id.x];
                                }
                                C[id.y * dims.cols + id.x] = sum;
                            }
                        `
                    }),
                    entryPoint: 'main',
                },
            });

            this.kinematicsPipeline = this.device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: this.device.createShaderModule({
                        code: `
                            struct ImuSample {
                                accel: vec3<f32>,
                                dt: f32,
                                gyro: vec3<f32>,
                                pad: f32,
                            };

                            struct KinematicParams {
                                gravity: f32,
                                batchSize: f32,
                                pad1: f32,
                                pad2: f32,
                            };

                            @group(0) @binding(0) var<uniform> params: KinematicParams;
                            @group(0) @binding(1) var<storage, read_write> x: array<f32>;
                            @group(0) @binding(2) var<storage, read_write> P: array<f32>;
                            @group(0) @binding(3) var<storage, read> Q: array<f32>;
                            @group(0) @binding(4) var<storage, read> samples: array<ImuSample>;

                            fn multMat13(A: array<f32, 169>, B: array<f32, 169>) -> array<f32, 169> {
                                var C: array<f32, 169>;
                                for (var r = 0u; r < 13u; r = r + 1u) {
                                    for (var c = 0u; c < 13u; c = c + 1u) {
                                        var sum = 0.0;
                                        for (var k = 0u; k < 13u; k = k + 1u) {
                                            sum = sum + A[r * 13u + k] * B[k * 13u + c];
                                        }
                                        C[r * 13u + c] = sum;
                                    }
                                }
                                return C;
                            }

                            fn transposeMat13(A: array<f32, 169>) -> array<f32, 169> {
                                var T: array<f32, 169>;
                                for (var r = 0u; r < 13u; r = r + 1u) {
                                    for (var c = 0u; c < 13u; c = c + 1u) {
                                        T[c * 13u + r] = A[r * 13u + c];
                                    }
                                }
                                return T;
                            }

                            @compute @workgroup_size(1)
                            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                                if (id.x != 0u) { return; }

                                var local_x: array<f32, 13>;
                                for (var i = 0u; i < 13u; i = i + 1u) {
                                    local_x[i] = x[i];
                                }

                                var local_P: array<f32, 169>;
                                for (var i = 0u; i < 169u; i = i + 1u) {
                                    local_P[i] = P[i];
                                }

                                var F: array<f32, 169>;

                                let N = u32(params.batchSize);
                                for (var b = 0u; b < N; b = b + 1u) {
                                    let sample = samples[b];
                                    let dt = sample.dt;
                                    if (dt <= 0.0) { continue; }

                                    let px = local_x[0];
                                    let py = local_x[1];
                                    let pz = local_x[2];
                                    let vx = local_x[3];
                                    let vy = local_x[4];
                                    let vz = local_x[5];
                                    let bx = local_x[6];
                                    let by = local_x[7];
                                    let bz = local_x[8];
                                    let yaw = local_x[9];
                                    let pitch = local_x[11];
                                    let roll = local_x[12];

                                    let cy = cos(yaw);
                                    let sy = sin(yaw);
                                    let cp = cos(pitch);
                                    let sp = sin(pitch);
                                    let cr = cos(roll);
                                    let sr = sin(roll);

                                    let abx = sample.accel.x - bx;
                                    let aby = sample.accel.y - by;
                                    let abz = sample.accel.z - bz;

                                    let R00 = cy * cp;
                                    let R01 = cy * sp * sr - sy * cr;
                                    let R02 = cy * sp * cr + sy * sr;
                                    let R10 = sy * cp;
                                    let R11 = sy * sp * sr + cy * cr;
                                    let R12 = sy * sp * cr - cy * sr;
                                    let R20 = -sp;
                                    let R21 = cp * sr;
                                    let R22 = cp * cr;

                                    let ax_w = abx * R00 + aby * R01 + abz * R02;
                                    let ay_w = abx * R10 + aby * R11 + abz * R12;
                                    let az_w = abx * R20 + aby * R21 + abz * R22 + params.gravity;

                                    local_x[0] = px + vx * dt + 0.5 * ax_w * dt * dt;
                                    local_x[1] = py + vy * dt + 0.5 * ay_w * dt * dt;
                                    local_x[2] = pz + vz * dt + 0.5 * az_w * dt * dt;
                                    local_x[3] = vx + ax_w * dt;
                                    local_x[4] = vy + ay_w * dt;
                                    local_x[5] = vz + az_w * dt;
                                    
                                    local_x[9] = yaw + (sample.gyro.z * (cr / cp) + sample.gyro.y * (sr / cp)) * dt;
                                    local_x[10] = sample.gyro.z; 
                                    local_x[11] = pitch + (sample.gyro.y * cr - sample.gyro.z * sr) * dt;
                                    local_x[12] = roll + (sample.gyro.x + sample.gyro.y * sr * (sp / cp) + sample.gyro.z * cr * (sp / cp)) * dt;

                                    for (var i = 0u; i < 169u; i = i + 1u) {
                                        F[i] = 0.0;
                                    }
                                    for (var i = 0u; i < 13u; i = i + 1u) {
                                        F[i * 13u + i] = 1.0;
                                    }
                                    F[0u * 13u + 3u] = dt;
                                    F[1u * 13u + 4u] = dt;
                                    F[2u * 13u + 5u] = dt;
                                    F[3u * 13u + 6u] = -dt;
                                    F[4u * 13u + 7u] = -dt;
                                    F[5u * 13u + 8u] = -dt;
                                    F[9u * 13u + 10u] = dt;

                                    let FP = multMat13(F, local_P);
                                    let F_T = transposeMat13(F);
                                    local_P = multMat13(FP, F_T);

                                    for (var i = 0u; i < 169u; i = i + 1u) {
                                        local_P[i] = local_P[i] + Q[i];
                                    }
                                }

                                for (var i = 0u; i < 13u; i = i + 1u) {
                                    x[i] = local_x[i];
                                }
                                for (var i = 0u; i < 169u; i = i + 1u) {
                                    P[i] = local_P[i];
                                }
                            }
                        `
                    }),
                    entryPoint: 'main',
                },
            });
        } catch (e) {
            console.warn("WebGPU support unavailable.");
        }
    }

    public isWebGPUEnabled(): boolean {
        return !!(this.device && this.matMulPipeline && this.kinematicsPipeline);
    }

    /**
     * Executes a hardware-accelerated matrix multiplication on WebGPU.
     */
    public async gpuMultMat(A: Float32Array, B: Float32Array, rowsA: number, colsA: number, colsB: number): Promise<Float32Array> {
        if (!this.device || !this.matMulPipeline) {
            return this.cpuMultMat(A, B, rowsA, colsA, colsB);
        }

        const sizeC = rowsA * colsB * 4;
        const dimsBuffer = this.device.createBuffer({ 
            size: 16, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST 
        });
        
        // Use standard Uint32Array for dimensions
        this.device.queue.writeBuffer(dimsBuffer, 0, new Uint32Array([rowsA, colsB, colsA, 0]));

        const bufferA = this.device.createBuffer({ size: A.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const bufferB = this.device.createBuffer({ size: B.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const bufferC = this.device.createBuffer({ size: sizeC, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        const stagingBuffer = this.device.createBuffer({ size: sizeC, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

        // Fix type assignments for WebGPU buffers
        this.device.queue.writeBuffer(bufferA, 0, A.buffer, A.byteOffset, A.byteLength);
        this.device.queue.writeBuffer(bufferB, 0, B.buffer, B.byteOffset, B.byteLength);

        const bindGroup = this.device.createBindGroup({
            layout: this.matMulPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: dimsBuffer } },
                { binding: 1, resource: { buffer: bufferA } },
                { binding: 2, resource: { buffer: bufferB } },
                { binding: 3, resource: { buffer: bufferC } },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.matMulPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(colsB / 8), Math.ceil(rowsA / 8));
        pass.end();

        commandEncoder.copyBufferToBuffer(bufferC, 0, stagingBuffer, 0, sizeC);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();
        
        return result;
    }

    public async gpuPropagateKinematics(
        stateX: Float32Array,
        covarianceP: Float32Array,
        processNoiseQ: Float32Array,
        samples: { accel: [number, number, number], gyro: [number, number, number], dt: number }[]
    ): Promise<{ x: Float32Array, P: Float32Array }> {
        if (!this.device || !this.kinematicsPipeline) {
            return this.cpuPropagateKinematics(stateX, covarianceP, processNoiseQ, samples);
        }

        const batchSize = samples.length;
        if (batchSize === 0) {
            return { x: stateX, P: covarianceP };
        }

        const paramsBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const paramsArray = new Float32Array(4);
        paramsArray[0] = 9.80665;
        paramsArray[1] = batchSize;
        this.device.queue.writeBuffer(paramsBuffer, 0, paramsArray as any);

        const xBuffer = this.device.createBuffer({
            size: 13 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(xBuffer, 0, stateX as any);

        const PBuffer = this.device.createBuffer({
            size: 169 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(PBuffer, 0, covarianceP as any);

        const QBuffer = this.device.createBuffer({
            size: 169 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(QBuffer, 0, processNoiseQ as any);

        const mappedSamples = new Float32Array(batchSize * 8);
        for (let i = 0; i < batchSize; i++) {
            const s = samples[i];
            const offset = i * 8;
            mappedSamples[offset + 0] = s.accel[0];
            mappedSamples[offset + 1] = s.accel[1];
            mappedSamples[offset + 2] = s.accel[2];
            mappedSamples[offset + 3] = s.dt;
            mappedSamples[offset + 4] = s.gyro[0];
            mappedSamples[offset + 5] = s.gyro[1];
            mappedSamples[offset + 6] = s.gyro[2];
            mappedSamples[offset + 7] = 0;
        }

        const samplesBuffer = this.device.createBuffer({
            size: mappedSamples.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(samplesBuffer, 0, mappedSamples as any);

        const xStaging = this.device.createBuffer({
            size: 13 * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        const PStaging = this.device.createBuffer({
            size: 169 * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = this.device.createBindGroup({
            layout: this.kinematicsPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: paramsBuffer } },
                { binding: 1, resource: { buffer: xBuffer } },
                { binding: 2, resource: { buffer: PBuffer } },
                { binding: 3, resource: { buffer: QBuffer } },
                { binding: 4, resource: { buffer: samplesBuffer } },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.kinematicsPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();

        commandEncoder.copyBufferToBuffer(xBuffer, 0, xStaging, 0, 13 * 4);
        commandEncoder.copyBufferToBuffer(PBuffer, 0, PStaging, 0, 169 * 4);

        this.device.queue.submit([commandEncoder.finish()]);

        await Promise.all([
            xStaging.mapAsync(GPUMapMode.READ),
            PStaging.mapAsync(GPUMapMode.READ)
        ]);

        const outX = new Float32Array(xStaging.getMappedRange().slice(0));
        const outP = new Float32Array(PStaging.getMappedRange().slice(0));

        xStaging.unmap();
        PStaging.unmap();

        return { x: outX, P: outP };
    }

    public cpuPropagateKinematics(
        stateX: Float32Array,
        covarianceP: Float32Array,
        processNoiseQ: Float32Array,
        samples: { accel: [number, number, number], gyro: [number, number, number], dt: number }[]
    ): { x: Float32Array, P: Float32Array } {
        const x = new Float32Array(stateX);
        const P = new Float32Array(covarianceP);
        const Q = processNoiseQ;
        const GRAVITY = 9.80665;

        for (let b = 0; b < samples.length; b++) {
            const sample = samples[b];
            const dt = sample.dt;
            if (dt <= 0) continue;

            const px = x[0], py = x[1], pz = x[2];
            const vx = x[3], vy = x[4], vz = x[5];
            const bx = x[6], by = x[7], bz = x[8];
            const yaw = x[9], pitch = x[11], roll = x[12];

            const cy = Math.cos(yaw), sy = Math.sin(yaw);
            const cp = Math.cos(pitch), sp = Math.sin(pitch);
            const cr = Math.cos(roll), sr = Math.sin(roll);

            const abx = sample.accel[0] - bx;
            const aby = sample.accel[1] - by;
            const abz = sample.accel[2] - bz;

            const R00 = cy * cp;
            const R01 = cy * sp * sr - sy * cr;
            const R02 = cy * sp * cr + sy * sr;
            const R10 = sy * cp;
            const R11 = sy * sp * sr + cy * cr;
            const R12 = sy * sp * cr - cy * sr;
            const R20 = -sp;
            const R21 = cp * sr;
            const R22 = cp * cr;

            const ax_w = abx * R00 + aby * R01 + abz * R02;
            const ay_w = abx * R10 + aby * R11 + abz * R12;
            const az_w = abx * R20 + aby * R21 + abz * R22 + GRAVITY;

            x[0] = px + vx * dt + 0.5 * ax_w * dt * dt;
            x[1] = py + vy * dt + 0.5 * ay_w * dt * dt;
            x[2] = pz + vz * dt + 0.5 * az_w * dt * dt;
            x[3] = vx + ax_w * dt;
            x[4] = vy + ay_w * dt;
            x[5] = vz + az_w * dt;
            x[9] = yaw + (sample.gyro[2] * (cr / cp) + sample.gyro[1] * (sr / cp)) * dt;
            x[10] = sample.gyro[2];
            x[11] = pitch + (sample.gyro[1] * cr - sample.gyro[2] * sr) * dt;
            x[12] = roll + (sample.gyro[0] + sample.gyro[1] * sr * (sp / cp) + sample.gyro[2] * cr * (sp / cp)) * dt;

            const F = new Float32Array(169);
            for (let i = 0; i < 13; i++) F[i * 13 + i] = 1;
            F[0 * 13 + 3] = dt; F[1 * 13 + 4] = dt; F[2 * 13 + 5] = dt;
            F[3 * 13 + 6] = -dt; F[4 * 13 + 7] = -dt; F[5 * 13 + 8] = -dt;
            F[9 * 13 + 10] = dt;

            const FP = new Float32Array(169);
            for (let r = 0; r < 13; r++) {
                for (let c = 0; c < 13; c++) {
                    let sum = 0;
                    for (let k = 0; k < 13; k++) {
                        sum += F[r * 13 + k] * P[k * 13 + c];
                    }
                    FP[r * 13 + c] = sum;
                }
            }

            for (let r = 0; r < 13; r++) {
                for (let c = 0; c < 13; c++) {
                    let sum = 0;
                    for (let k = 0; k < 13; k++) {
                        sum += FP[r * 13 + k] * F[c * 13 + k];
                    }
                    P[r * 13 + c] = sum + Q[r * 13 + c];
                }
            }
        }

        return { x, P };
    }

    public cpuMultMat(A: Float32Array, B: Float32Array, rowsA: number, colsA: number, colsB: number): Float32Array {
        const C = new Float32Array(rowsA * colsB);
        for (let r = 0; r < rowsA; r++) {
            for (let c = 0; c < colsB; c++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) sum += A[r * colsA + k] * B[k * colsB + c];
                C[r * colsB + c] = sum;
            }
        }
        return C;
    }

    /**
     * Delta-Sigma Bit-Packing
     * Compresses a sequence of numbers by storing only bit-packed deltas.
     */
    public packTelemetryDelta(data: number[]): Uint8Array {
        if (data.length < 2) return new Uint8Array(data.map(v => v & 0xFF));
        const first = data[0];
        const deltas = [];
        for (let i = 1; i < data.length; i++) {
            deltas.push(data[i] - data[i - 1]);
        }
        const output = new Float32Array([first, ...deltas]);
        return new Uint8Array(output.buffer);
    }

    private static makeCrcTable(): Uint32Array {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            table[n] = c;
        }
        return table;
    }

    /**
     * Calculates CRC32 Checksum for a byte array.
     * Critical for ECU flashing integrity verification (UDS Service 0x37).
     */
    public static crc32(data: Uint8Array): number {
        if (!this.crcTable) this.crcTable = this.makeCrcTable();
        let crc = 0 ^ (-1);
        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ this.crcTable[(crc ^ data[i]) & 0xFF];
        }
        return (crc ^ (-1)) >>> 0;
    }

    /**
     * Compares local checksum against remote ECU signature.
     */
    public static validateBinaryIntegrity(data: Uint8Array, expectedCrc: number): boolean {
        const actual = this.crc32(data);
        return (actual >>> 0) === (expectedCrc >>> 0);
    }

    /**
     * Generates a SHA-256 hash for calibration data.
     * Used for DLT/Blockchain provenance and integrity.
     */
    public static async sha256(data: Uint8Array): Promise<string> {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Unsupervised Learning: Simple Autoencoder for Data Quality Monitoring
     * Detects anomalous sensor drift by compressing and reconstructing the signal.
     */
    public static calculateReconstructionError(input: number[], weights1: number[][], weights2: number[][]): number {
        // Simple 1-hidden-layer autoencoder simulation
        // input -> hidden -> output
        const hidden = new Array(weights1[0].length).fill(0);
        for (let i = 0; i < input.length; i++) {
            for (let j = 0; j < hidden.length; j++) {
                hidden[j] += input[i] * weights1[i][j];
            }
        }
        // ReLU activation
        for (let j = 0; j < hidden.length; j++) hidden[j] = Math.max(0, hidden[j]);

        const output = new Array(input.length).fill(0);
        for (let j = 0; j < hidden.length; j++) {
            for (let k = 0; k < output.length; k++) {
                output[k] += hidden[j] * weights2[j][k];
            }
        }

        // Calculate MSE (Mean Squared Error)
        let mse = 0;
        for (let i = 0; i < input.length; i++) {
            mse += Math.pow(input[i] - output[i], 2);
        }
        return mse / input.length;
    }

    /**
     * High-Precision 2D Bilinear Interpolation.
     * Used to estimate values between 16x16 map cells for smooth DASH rendering.
     */
    public static bilinearInterpolate(
        valX: number, 
        valY: number, 
        xAxis: number[], 
        yAxis: number[], 
        zMatrix: number[][]
    ): number {
        // Find bounding indices
        let ix = xAxis.findIndex((v, i) => v <= valX && (xAxis[i+1] === undefined || xAxis[i+1] > valX));
        let iy = yAxis.findIndex((v, i) => v <= valY && (yAxis[i+1] === undefined || yAxis[i+1] > valY));

        ix = Math.max(0, Math.min(xAxis.length - 2, ix));
        iy = Math.max(0, Math.min(yAxis.length - 2, iy));

        const x0 = xAxis[ix], x1 = xAxis[ix+1];
        const y0 = yAxis[iy], y1 = yAxis[iy+1];

        const z00 = zMatrix[iy][ix];
        const z10 = zMatrix[iy][ix+1];
        const z01 = zMatrix[iy+1][ix];
        const z11 = zMatrix[iy+1][ix+1];

        const fractX = (valX - x0) / (x1 - x0);
        const fractY = (valY - y0) / (y1 - y0);

        const interpX0 = z00 * (1 - fractX) + z10 * fractX;
        const interpX1 = z01 * (1 - fractX) + z11 * fractX;

        return interpX0 * (1 - fractY) + interpX1 * fractY;
    }

    /**
     * Converts a 2D array to a flat Float64Array for high-performance processing.
     */
    public static toBuffer(map: number[][]): Float64Array {
        return new Float64Array(map.flat());
    }

    /**
     * Reconstructs 2D array from buffer.
     */
    public static fromBuffer(buffer: Float64Array, rows: number = 16, cols: number = 16): number[][] {
        const result: number[][] = [];
        for (let i = 0; i < rows; i++) {
            result.push(Array.from(buffer.slice(i * cols, (i + 1) * cols)));
        }
        return result;
    }

    public static applyRegionModifier(
        buffer: Float64Array, 
        modifier: number, 
        mode: 'multiply' | 'add' | 'set',
        roi: { rMin: number, rMax: number, cMin: number, cMax: number }
    ): Float64Array {
        const result = new Float64Array(buffer);
        // Assuming 16x16 default for legacy compatibility if called without dims, 
        // but roi implies indices.
        // We use static ROWS/COLS constants for fallback in region logic if strictly 16x16.
        const cols = this.COLS;
        const rows = this.ROWS;

        for (let r = roi.rMin; r <= roi.rMax; r++) {
            if (r < 0 || r >= rows) continue;
            const rowOffset = r * cols;
            for (let c = roi.cMin; c <= roi.cMax; c++) {
                if (c < 0 || c >= cols) continue;
                const idx = rowOffset + c;
                if (mode === 'multiply') result[idx] *= modifier;
                else if (mode === 'add') result[idx] += modifier;
                else if (mode === 'set') result[idx] = modifier;
            }
        }
        return result;
    }

    /**
     * 3x3 Gaussian Blur Convolution
     * Treats the tuning map as a 2D signal to remove spatial noise.
     */
    public static gaussianSmooth(buffer: Float64Array, rows: number = 16, cols: number = 16, factor: number = 0.3): Float64Array {
        const out = new Float64Array(buffer.length);
        const kernel = [
            [1, 2, 1],
            [2, 4, 2],
            [1, 2, 1]
        ].map(row => row.map(v => v / 16));

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let sum = 0;
                // Apply 3x3 kernel
                for (let kr = -1; kr <= 1; kr++) {
                    for (let kc = -1; kc <= 1; kc++) {
                        const rowIdx = Math.min(Math.max(r + kr, 0), rows - 1);
                        const colIdx = Math.min(Math.max(c + kc, 0), cols - 1);
                        sum += buffer[rowIdx * cols + colIdx] * kernel[kr + 1][kc + 1];
                    }
                }
                // Blend original with smoothed based on factor
                out[r * cols + c] = (buffer[r * cols + c] * (1 - factor)) + (sum * factor);
            }
        }
        return out;
    }
}
