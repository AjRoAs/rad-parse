/**
 * RLE Codec Plugin
 * Supports RLE Lossless (1.2.840.10008.1.2.5) decoding and encoding.
 */
import { PixelDataCodec } from './codecs';

export class RleCodec implements PixelDataCodec {
    name = 'rle-typescript';
    priority = 10; // Fallback

    isSupported(): boolean {
        return true;
    }

    canDecode(ts: string): boolean {
        return ts === '1.2.840.10008.1.2.5';
    }

    canEncode(ts: string): boolean {
        return ts === '1.2.840.10008.1.2.5';
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        if (encodedBuffer.length === 0) return new Uint8Array(0);

        for (const frag of encodedBuffer) {
           if (frag.byteLength < 64) continue;
           const view = new DataView(frag.buffer, frag.byteOffset, frag.byteLength);
           const numSegments = view.getUint32(0, true);
           if (numSegments > 0 && numSegments <= 15) {
               return this.processFrame(frag);
           }
        }
        
        const valid = encodedBuffer.find(f => f.length > 0);
        if (valid) return this.processFrame(valid);
        
        return new Uint8Array(0);
    }
    
    private processFrame(buffer: Uint8Array): Uint8Array {
         const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
         const numSegments = view.getUint32(0, true);
         const offsets: number[] = [];
         for(let i=0; i<15; i++) {
             offsets.push(view.getUint32(4 + i*4, true));
         }
         
         const segments: Uint8Array[] = [];
         for(let i=0; i<numSegments; i++) {
             const start = offsets[i];
             const end = (i < numSegments - 1) ? offsets[i+1] : buffer.byteLength;
             if (start > 0 && start < buffer.byteLength) {
                 segments.push(buffer.subarray(start, end));
             } else {
                 segments.push(new Uint8Array(0)); // Handle invalid offset
             }
         }
         
         const decodedSegments = segments.map(s => this.decompressRle(s));
         
         if (decodedSegments.length === 0) return new Uint8Array(0);
         if (decodedSegments.length === 1) return decodedSegments[0];
         
         // Interleave (Planar -> Interleaved)
         const pixelCount = decodedSegments[0].length;
         // Safety check: all segments same length?
         const total = pixelCount * decodedSegments.length;
         const result = new Uint8Array(total);
         
         // If 16-bit (2 segments, high/low or low/high? DICOM RLE is usually Little Endian High Byte is 2nd segment?)
         // DICOM RLE: "The order of segments... is the same as the order of the components"
         // For US/SS (16-bit), components are Bytes?
         // "The first segment contains the most significant byte of each pixel, and the second segment contains the least significant byte."
         // WAIT! DICOM Standard PS3.5 Annex G:
         // "For 16-bit data... header... Segment 1: MSB... Segment 2: LSB" (Big Endian order of bytes in stream?)
         // BUT Output should be Little Endian for Javascript/WASM usually.
         // Let's check `processFrame` of existing code or assume output is Little Endian from Parser.
         // If Parser returns Little Endian 16-bit, then byte[0] is LSB, byte[1] is MSB.
         // If standard says Seg 1 is MSB, Seg 2 is LSB.
         // Then result[p*2] = Seg2[p] (LSB), result[p*2+1] = Seg1[p] (MSB).
         // IF we have 2 segments.
         
         // Let's implement generic interleaving.
         // If samples=1, bits=16 -> 2 segments.
         // If samples=3, bits=8 -> 3 segments.
         // We don't have `info` here easily (unless passed).
         // But we can infer from `decodedSegments.length`.
         
         const numSeg = decodedSegments.length;
         
         if (numSeg === 2) {
             // Likely 16-bit.
             // Assume Seg 0 is MSB, Seg 1 is LSB ?? Or vice versa?
             // Standard says: "The first segment contains the most significant byte... The second contains the least..."
             // So Seg 0 = MSB, Seg 1 = LSB.
             // We want Little Endian output (LSB at addr 0).
             // So result[i*2] = Seg 1[i] (LSB).
             // result[i*2+1] = Seg 0[i] (MSB).
             
             // UNLESS! The `processFrame` previously assumed something else?
             // I'll stick to Standard.
             
             for(let p=0; p<pixelCount; p++) {
                 // Little Endian: LSB first
                 result[p*2] = decodedSegments[1][p];     // LSB from Seg 1
                 result[p*2+1] = decodedSegments[0][p];   // MSB from Seg 0
             }
         } else if (numSeg === 3) {
             // Likely RGB 8-bit.
             // Seg 0=R, Seg 1=G, Seg 2=B.
             for(let p=0; p<pixelCount; p++) {
                 result[p*3] = decodedSegments[0][p];
                 result[p*3+1] = decodedSegments[1][p];
                 result[p*3+2] = decodedSegments[2][p];
             }
         } else {
             // Fallback: simple interleave
              for(let p=0; p<pixelCount; p++) {
                 for(let s=0; s<numSeg; s++) {
                     result[p*numSeg + s] = decodedSegments[s][p];
                 }
              }
         }

         return result;
    }
    
    private decompressRle(src: Uint8Array): Uint8Array {
        // Implement PackBits decompression
        const out: number[] = [];
        let i = 0;
        
        while (i < src.length) {
            const n = src[i++];
            if (n >= 0 && n <= 127) {
                // Literal run
                const count = n + 1;
                if (i + count > src.length) {
                    // console.warn("RLE Literal run out of bounds");
                    // Copy what's left
                    for(let k=0; k < (src.length - i); k++) out.push(src[i++]);
                    break;
                }
                for(let k=0; k<count; k++) out.push(src[i++]);
            } else if (n >= 129 && n <= 255) { 
                 // Repeat run (-1 to -127)
                 const count = 257 - n;
                 if (i >= src.length) break; // formatting error
                 const byte = src[i++];
                 for(let k=0; k<count; k++) out.push(byte);
            }
            // n == 128 is No-op
        }
        
        return new Uint8Array(out);
    }
    
    // --- ENCODER ---

    async encode(pixelData: Uint8Array, transferSyntax: string, width: number, height: number, samples: number, bits: number): Promise<Uint8Array[]> {
        // Split into segments
        // Inverse of processFrame.
        // If 8-bit Gray: 1 segment.
        // If 8-bit RGB: 3 segments.
        // If 16-bit Gray: 2 segments (MSB, LSB).
        
        const segments: Uint8Array[] = [];
        const numPixels = width * height;
        
        if (bits === 8) {
            if (samples === 1) {
                segments.push(pixelData);
            } else if (samples === 3) {
                // De-interleave: RRR... GGG... BBB...
                const r = new Uint8Array(numPixels);
                const g = new Uint8Array(numPixels);
                const b = new Uint8Array(numPixels);
                for(let i=0; i<numPixels; i++) {
                    r[i] = pixelData[i*3];
                    g[i] = pixelData[i*3+1];
                    b[i] = pixelData[i*3+2];
                }
                segments.push(r, g, b);
            }
        } else if (bits === 16 && samples === 1) {
             // De-interleave MSB/LSB. Input is Little Endian (LSB MSB).
             // Output Seg 0 = MSB, Seg 1 = LSB.
             const msb = new Uint8Array(numPixels);
             const lsb = new Uint8Array(numPixels);
             for(let i=0; i<numPixels; i++) {
                 lsb[i] = pixelData[i*2];     // LSB
                 msb[i] = pixelData[i*2+1];   // MSB
             }
             segments.push(msb, lsb);
        } else {
             // Fallback: 1 segment (raw dump? RLE requires deinterleaving usually)
             // Default to raw copy
             segments.push(pixelData);
        }
        
        // Compress segments
        const encodedSegments = segments.map(s => this.packBits(s));
        
        // Build Header
        // 16 offsets (64 bytes).
        const header = new Uint8Array(64);
        const view = new DataView(header.buffer);
        const numSeg = encodedSegments.length;
        view.setUint32(0, numSeg, true);
        
        let currentOffset = 64;
        for(let i=0; i<numSeg; i++) {
            view.setUint32(4 + i*4, currentOffset, true);
            currentOffset += encodedSegments[i].length;
        }
        
        // Concatenate everything
        const totalSize = 64 + encodedSegments.reduce((a, b) => a + b.length, 0);
        const frame = new Uint8Array(totalSize);
        frame.set(header, 0);
        let pos = 64;
        for(const s of encodedSegments) {
            frame.set(s, pos);
            pos += s.length;
        }
        
        return [frame];
    }
    
    private packBits(src: Uint8Array): Uint8Array {
         const out: number[] = [];
         let i = 0;
         while(i < src.length) {
             // Look for run
             if (i + 1 < src.length && src[i] === src[i+1]) {
                 // Repeat run
                 let runLen = 1;
                 while(i + runLen < src.length && src[i] === src[i+runLen] && runLen < 128) {
                     runLen++;
                 }
                 if (runLen > 1) {
                     // Output repeat
                     // n = 257 - count.
                     out.push(257 - runLen);
                     out.push(src[i]);
                     i += runLen;
                 } else {
                     // Should not happen unless end of buffer with 2 same bytes
                     // Technically repeat 1 is inefficient (2 bytes output).
                     // Better treated as literal. But logic above `i+runLen` handles it.
                     // If loop terminated because runLen hit 128.
                     // If runLen=2, output 2 bytes: (255, val). Cost 2 bytes. Literal cost 2 bytes (0, val). 
                     // Same.
                     // But usually PackBits prefers literals for short runs.
                     // I'll stick to simple logic for now.
                 }
                 continue;
             }
             
             // Literal run
             let runLen = 0;
             while(i + runLen < src.length && runLen < 128) {
                 if (i + runLen + 1 < src.length && src[i+runLen] === src[i+runLen+1]) {
                     // Found start of a repeat run. Break literal run.
                     break;
                 }
                 runLen++;
             }
             
             if (runLen > 0) {
                 out.push(runLen - 1); // 0-based
                 for(let k=0; k<runLen; k++) out.push(src[i++]);
             }
         }
         return new Uint8Array(out);
    }
}
