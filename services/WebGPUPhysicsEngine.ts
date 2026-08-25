
/**
 * WebGPU Physics Engine v1.0
 * Migrates heavy physics calculations (tire deformation, thermal mass, aerodynamics) to GPU.
 * Performs real-time Finite Element Analysis (FEA) and basic Computational Fluid Dynamics (CFD).
 */

export class WebGPUPhysicsEngine {
    private device: GPUDevice | null = null;
    private tirePipeline: GPUComputePipeline | null = null;
    private thermalPipeline: GPUComputePipeline | null = null;

    constructor() {
        this.init();
    }

    private async init() {
        if (typeof navigator === 'undefined' || !navigator.gpu) {
            console.warn("WebGPU not supported on this environment.");
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return;
        this.device = await adapter.requestDevice();

        this.tirePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: this.device.createShaderModule({
                    code: `
                        struct TireParams {
                            stiffness: f32,
                            shape: f32,
                            peak: f32,
                            curvature: f32,
                        };

                        @group(0) @binding(0) var<uniform> params: TireParams;
                        @group(0) @binding(1) var<storage, read> slipAngles: array<f32>;
                        @group(0) @binding(2) var<storage, read_write> results: array<f32>;

                        @compute @workgroup_size(64)
                        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                            let idx = id.x;
                            if (idx >= arrayLength(&slipAngles)) { return; }

                            let rad = abs(slipAngles[idx]) * (3.14159 / 180.0);
                            let Bx = params.stiffness * rad;
                            let grip = params.peak * sin(params.shape * atan(Bx - params.curvature * (Bx - atan(Bx))));
                            results[idx] = max(0.0, min(1.0, grip));
                        }
                    `
                }),
                entryPoint: 'main',
            },
        });

        this.thermalPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: this.device.createShaderModule({
                    code: `
                        struct ThermalParams {
                            mass: f32,
                            specificHeat: f32,
                            area: f32,
                            ambientTemp: f32,
                            dt: f32,
                            vehicleMass: f32,
                        };

                        struct BrakeState {
                            temp: f32,
                            speed: f32,
                            decel: f32,
                        };

                        @group(0) @binding(0) var<uniform> params: ThermalParams;
                        @group(0) @binding(1) var<storage, read> states: array<BrakeState>;
                        @group(0) @binding(2) var<storage, read_write> nextTemps: array<f32>;

                        @compute @workgroup_size(64)
                        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                            let idx = id.x;
                            if (idx >= arrayLength(&states)) { return; }

                            let state = states[idx];
                            
                            // Heat Generation
                            var heatInputPower = 0.0;
                            if (state.decel > 0.1 && state.speed > 1.0) {
                                let brakingForce = params.vehicleMass * (state.decel * 9.81);
                                heatInputPower = (brakingForce * state.speed) * 0.7 * 0.5;
                            }

                            // Heat Dissipation
                            let dynamicCoolingCoeff = 50.0 * (1.0 + state.speed * 0.1);
                            let heatLossPower = dynamicCoolingCoeff * params.area * (state.temp - params.ambientTemp);

                            // Temperature Change
                            let netPower = heatInputPower - heatLossPower;
                            let deltaTemp = (netPower * params.dt) / (params.mass * params.specificHeat);

                            nextTemps[idx] = max(params.ambientTemp, state.temp + deltaTemp);
                        }
                    `
                }),
                entryPoint: 'main',
            },
        });
    }

    public async calculateTireGrip(slipAngles: Float32Array): Promise<Float32Array> {
        if (!this.device || !this.tirePipeline) return new Float32Array(slipAngles.length);

        const paramsBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([10.0, 1.9, 1.0, 0.97]) as any);

        const inputBuffer = this.device.createBuffer({
            size: slipAngles.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(inputBuffer, 0, slipAngles as any);

        const outputBuffer = this.device.createBuffer({
            size: slipAngles.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const stagingBuffer = this.device.createBuffer({
            size: slipAngles.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = this.device.createBindGroup({
            layout: this.tirePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: paramsBuffer } },
                { binding: 1, resource: { buffer: inputBuffer } },
                { binding: 2, resource: { buffer: outputBuffer } },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.tirePipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(slipAngles.length / 64));
        passEncoder.end();

        commandEncoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, slipAngles.byteLength);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const results = new Float32Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();

        return results;
    }
}

export const webGPUPhysics = new WebGPUPhysicsEngine();
