
/**
 * PNG Encoder Plugin (Node.js Native)
 * Uses Node's 'zlib' module for DEFLATE compression.
 * No external dependencies (uses built-ins).
 */
import { PixelDataCodec } from './codecs';
// Use require to avoid build-time issues if bundled for browser (though this is a Node plugin)
import * as zlib from 'zlib'; 

export class NodePngEncoder implements PixelDataCodec {
    name = 'png-node';
    priority = 20;

    isSupported(): boolean {
        return typeof process !== 'undefined' && !!zlib;
    }

    canDecode(ts: string): boolean {
        return false; // Encoder only for now
    }

    canEncode(ts: string): boolean {
        // Map PNG to a TS? Or just general capability?
        // Usually secondary capture or explicit export.
        // We'll map it to "1.2.840.10008.1.2.4.50" (JPG Baseline) as a proxy for "Compressed Image"?
        // Or better, just expose it and let the script pick it manually.
        // But to fit the 'process_examples.ts' flow, we need a TS.
        // Let's assume we want to encode *any* syntax to PNG if requested.
        // Be strict: this doesn't replace DICOM TS. It's an export format.
        // But for the tool, I'll allow encoding '1.2.840.10008.1.2.4.50' (as "Generic Compressed").
        return ts === 'png' || ts === '1.2.840.10008.1.2.4.50'; 
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        throw new Error("PNG Decoding not implemented");
    }

    async encode(pixelData: Uint8Array, transferSyntax: string, width: number, height: number, samples: number, bits: number): Promise<Uint8Array[]> {
        if (typeof zlib === 'undefined') throw new Error("zlib missing");

        // 1. Prepare Scanlines (Filter 0: None)
        // PNG format: [FilterByte, R, G, B, ...] per row
        // Input: RGB or Grayscale
        const bytesPerPixel = (bits / 8) * samples;
        const rowSize = width * bytesPerPixel;
        const rawBuffer = new Uint8Array(height * (rowSize + 1));
        
        for (let y = 0; y < height; y++) {
            const destOffset = y * (rowSize + 1);
            rawBuffer[destOffset] = 0; // Filter Type 0 (None)
            // Copy row
            const srcOffset = y * rowSize;
            rawBuffer.set(pixelData.subarray(srcOffset, srcOffset + rowSize), destOffset + 1);
        }

        // 2. Compress (Deflate)
        const compressed = zlib.deflateSync(rawBuffer);

        // 3. Construct PNG
        const chunks: Uint8Array[] = [];
        
        // Header
        chunks.push(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

        // IHDR
        const ihdr = new Uint8Array(13);
        const view = new DataView(ihdr.buffer);
        view.setUint32(0, width);
        view.setUint32(4, height);
        view.setUint8(8, bits); // Bit depth
        view.setUint8(9, samples === 3 ? 2 : 0); // ColorType: 2=RGB, 0=Gray
        view.setUint8(10, 0); // Compression
        view.setUint8(11, 0); // Filter
        view.setUint8(12, 0); // Interlace
        chunks.push(this.createChunk('IHDR', ihdr));

        // IDAT
        chunks.push(this.createChunk('IDAT', compressed));

        // IEND
        chunks.push(this.createChunk('IEND', new Uint8Array(0)));

        // Concat
        const totalLen = chunks.reduce((a, b) => a + b.length, 0);
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const c of chunks) {
            result.set(c, pos);
            pos += c.length;
        }

        return [result];
    }

    private createChunk(type: string, data: Uint8Array): Uint8Array {
        const len = data.length;
        const chunk = new Uint8Array(4 + 4 + len + 4);
        const view = new DataView(chunk.buffer);
        
        view.setUint32(0, len);
        // Type
        for(let i=0; i<4; i++) chunk[4+i] = type.charCodeAt(i);
        // Data
        chunk.set(data, 8);
        
        // CRC (Type + Data)
        const crcInput = chunk.subarray(4, 8 + len);
        const crc = this.crc32(crcInput);
        view.setUint32(8 + len, crc);
        
        return chunk;
    }

    private crc32(buf: Uint8Array): number {
        const table = this.getCrcTable();
        let crc = 0 ^ (-1);
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
        }
        return (crc ^ (-1)) >>> 0;
    }

    private crcTable: Int32Array | null = null;
    private getCrcTable(): Int32Array {
        if (this.crcTable) return this.crcTable;
        let c;
        const table = new Int32Array(256);
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            table[n] = c;
        }
        this.crcTable = table;
        return table;
    }
}
