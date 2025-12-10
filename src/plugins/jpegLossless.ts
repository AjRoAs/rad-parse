/**
 * JPEG Lossless Decoder Plugin (Adapter)
 * Transfer Syntaxes: 1.2.840.10008.1.2.4.57 (Process 14), 1.2.840.10008.1.2.4.70 (Process 14 SV1)
 */

import { PixelDataCodec } from './codecs';

export class JpegLosslessDecoder implements PixelDataCodec {
    name = 'jpeglossless-adapter';
    priority = 10; // Fallback

    constructor(
        private externalDecoder?: (buffer: Uint8Array) => Promise<Uint8Array>,
        private externalEncoder?: (pixelData: Uint8Array, ts: string, w: number, h: number, s: number, b: number) => Promise<Uint8Array[]>
    ) {}

    canEncode(transferSyntax: string): boolean {
        return !!this.externalEncoder && this.canDecode(transferSyntax);
    }

    async encode(pixelData: Uint8Array, transferSyntax: string, width: number, height: number, samples: number, bits: number): Promise<Uint8Array[]> {
        if (!this.externalEncoder) throw new Error("JPEG Lossless encoder not configured.");
        return this.externalEncoder(pixelData, transferSyntax, width, height, samples, bits);
    }


    isSupported(): boolean {
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
