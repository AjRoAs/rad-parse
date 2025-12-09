/**
 * JPEG 2000 Decoder Plugin (Adapter)
 * Transfer Syntaxes: 1.2.840.10008.1.2.4.90 (Lossless), 1.2.840.10008.1.2.4.91 (Lossy)
 */

import { PixelDataDecoder } from './codecs';

export class Jpeg2000Decoder implements PixelDataDecoder {
    name = 'jpeg2000-adapter';
    priority = 20;

    // Optional: Allow injecting an external function (e.g. from openjpegwasm)
    constructor(private externalDecoder?: (buffer: Uint8Array) => Promise<Uint8Array>) {}

    isSupported(): boolean {
        // Supported if external decoder provided
        return !!this.externalDecoder;
    }

    canDecode(transferSyntax: string): boolean {
        return [
            '1.2.840.10008.1.2.4.90', // JPEG 2000 Image Compression (Lossless Only)
            '1.2.840.10008.1.2.4.91', // JPEG 2000 Image Compression
            '1.2.840.10008.1.2.4.92', // JPEG 2000 Part 2 Multicomponent Compression (Lossless Only)
            '1.2.840.10008.1.2.4.93'  // JPEG 2000 Part 2 Multicomponent Compression
        ].includes(transferSyntax);
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        if (!this.externalDecoder) {
            throw new Error("JPEG 2000 decoder not configured. Please inject a decoder (e.g. OpenJPEG).");
        }
        
        // JPEG 2000 is typically one fragment (codestream) per frame or concatenated?
        // Usually J2K codestream is self-contained.
        const totalSize = encodedBuffer.reduce((a,b)=>a+b.length, 0);
        const combined = new Uint8Array(totalSize);
        let off = 0;
        for(const b of encodedBuffer){
            combined.set(b, off);
            off += b.length;
        }

        return this.externalDecoder(combined);
    }
}
