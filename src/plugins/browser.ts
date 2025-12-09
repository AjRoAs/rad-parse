/**
 * Browser ImageDecoder Plugin (WebCodecs)
 * Supports JPEG (1.2.840.10008.1.2.4.50, .4.51, etc)
 */

import { PixelDataDecoder } from './codecs';

export class BrowserImageDecoder implements PixelDataDecoder {
    name = 'browser-image-decoder';
    priority = 50; // Better than JS, worse than specialized WASM/WebGPU if they exist

    isSupported(): boolean {
        return typeof window !== 'undefined' && 'ImageDecoder' in window;
    }

    canDecode(transferSyntax: string): boolean {
        return [
            '1.2.840.10008.1.2.4.50', // JPEG Baseline (Process 1)
            '1.2.840.10008.1.2.4.51', // JPEG Extended (Process 2 & 4) - Browser might support 8-bit?
            // Browser usually supports 8-bit JPEG. 12-bit is iffy.
        ].includes(transferSyntax);
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
         // Concat fragments for JPEG stream
         const blob = new Blob(encodedBuffer, { type: 'image/jpeg' });
         
         // Use ImageDecoder
         const decoder = new (window as any).ImageDecoder({ data: blob.stream(), type: 'image/jpeg' });
         const image = await decoder.decode();
         
         // Get pixel data
         const frame = image.image; // VideoFrame
         const size = frame.allocationSize();
         const buffer = new Uint8Array(size);
         await frame.copyTo(buffer);
         
         frame.close(); // Release GPU resource
         
         return buffer;
    }
}
