/**
 * WebGPU Decoder Plugin
 * Infrastructure for Compute Shader based decoding.
 */

import { PixelDataDecoder } from './codecs';

export class WebGpuDecoder implements PixelDataDecoder {
    name = 'webgpu';
    priority = 100; // Best

    private device: GPUDevice | null = null;

    async isSupported(): Promise<boolean> {
        if (typeof navigator === 'undefined' || !navigator.gpu) return false;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) return false;
            this.device = await adapter.requestDevice();
            return true;
        } catch (e) {
            console.warn("WebGPU supported but failed to init:", e);
            return false;
        }
    }

    canDecode(transferSyntax: string): boolean {
        // Example: Only claim to support if we have a shader for it.
        // For demonstration, we claim to support a fictional "GPU Test Syntax" or RLE
        // Real WGSL RLE is complex, but we'll set up the pipeline for it.
        return transferSyntax === '1.2.840.10008.1.2.5'; 
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        if (!this.device) throw new Error("WebGPU device not initialized");

        // 1. Prepare Input Data
        // Concat fragments into one buffer
        const totalSize = encodedBuffer.reduce((acc, b) => acc + b.length, 0);
        const flattenedInput = new Uint8Array(totalSize);
        let offset = 0;
        for (const b of encodedBuffer) {
            flattenedInput.set(b, offset);
            offset += b.length;
        }

        // 2. Create GPU Buffers
        // Input Buffer (Read-only storage)
        const inputBuffer = this.device.createBuffer({
            size: flattenedInput.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint8Array(inputBuffer.getMappedRange()).set(flattenedInput);
        inputBuffer.unmap();

        // Output Buffer (Storage + CopySrc)
        // We need to know expected output size.
        // For now, let's assume worst case or same size (pass-through test).
        // In real RLE, we need 'length' param or metadata.
        const outputSize = length || totalSize * 3; // Estimate
        const outputBuffer = this.device.createBuffer({
            size: outputSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        // Staging Buffer (MapRead) for reading back results
        const stagingBuffer = this.device.createBuffer({
            size: outputSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        // 3. Create Compute Pipeline
        // Simple Pass-through / Invert shader for demo
        const shaderCode = `
            @group(0) @binding(0) var<storage, read> inputData : array<u32>; // packed u8
            @group(0) @binding(1) var<storage, read_write> outputData : array<u32>;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
                let index = global_id.x;
                if (index >= arrayLength(&inputData)) {
                    return;
                }
                // Simple pass-through (copy)
                outputData[index] = inputData[index];
            }
        `;

        const shaderModule = this.device.createShaderModule({ code: shaderCode });
        const computePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });

        // 4. Create Bind Group
        const bindGroup = this.device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } }
            ]
        });

        // 5. Dispatch
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, bindGroup);
        // Calculate workgroups (u32 view = bytes / 4)
        const numElements = Math.ceil(flattenedInput.byteLength / 4);
        passEncoder.dispatchWorkgroups(Math.ceil(numElements / 64));
        passEncoder.end();

        // 6. Copy to Staging
        commandEncoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, outputSize);
        this.device.queue.submit([commandEncoder.finish()]);

        // 7. Readback
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = stagingBuffer.getMappedRange();
        const result = new Uint8Array(copyArrayBuffer.slice(0));
        stagingBuffer.unmap();
        
        // Cleanup
        inputBuffer.destroy();
        outputBuffer.destroy();
        stagingBuffer.destroy();

        return result;
    }
}
