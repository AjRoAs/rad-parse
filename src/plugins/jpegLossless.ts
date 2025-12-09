/**
 * JPEG Lossless Decoder Plugin (Adapter)
 * Transfer Syntaxes: 1.2.840.10008.1.2.4.57 (Process 14), 1.2.840.10008.1.2.4.70 (Process 14 SV1)
 */

import { PixelDataDecoder } from './codecs';

export class JpegLosslessDecoder implements PixelDataDecoder {
    name = 'jpeglossless-adapter';
    priority = 10; // Fallback

    constructor(private externalDecoder?: (buffer: Uint8Array) => Promise<Uint8Array>) {}

    isSupported(): boolean {
        // Supported if external decoder provided or (future) pure JS implementation added
        return !!this.externalDecoder;
    }

    canDecode(transferSyntax: string): boolean {
        return [
            '1.2.840.10008.1.2.4.57', // JPEG Lossless, Non-Hierarchical (Process 14)
            '1.2.840.10008.1.2.4.70'  // JPEG Lossless, Non-Hierarchical, First-Order Prediction (Process 14 [Selection Value 1])
        ].includes(transferSyntax);
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        if (!this.externalDecoder) {
             throw new Error("JPEG Lossless decoder not configured.");
        }
        
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
