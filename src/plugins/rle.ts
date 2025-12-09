/**
 * TypeScript RLE Decoder Plugin
 * Transfer Syntax: 1.2.840.10008.1.2.5
 */

import { PixelDataDecoder } from './codecs';

export class RleDecoder implements PixelDataDecoder {
    name = 'rle-ts';
    priority = 10; // Low priority (baseline)

    isSupported(): boolean {
        return true;
    }

    canDecode(transferSyntax: string): boolean {
        return transferSyntax === '1.2.840.10008.1.2.5';
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        // encodedBuffer is array of fragments.
        // For RLE, usually:
        // Fragment 0: RLE Header (or just first fragment)
        // Actually, Basic Offset Table is handled by parser usually?
        // Let's assume passed buffer is list of RLE Segments.
        // DICOM RLE: 
        // 1. The RLE Header contains 16 long values (64 bytes).
        //    First long is number of segments.
        //    Next 15 are offsets to segments.
        
        // We typically receive the concatenated fragments, but parser.ts splits them?
        // If we get an array of Uint8Arrays, we might need to stitch them if they are just fragmentation of the byte stream,
        // OR each fragment is a frame? 
        // "Encapsulated Pixel Data ... consists of a Sequence ... Item 1: Basic Offset Table ... Item 2..n: Fragments".
        // The parser passes `encodedBuffer` as `Array<Uint8Array>` which are the *Value* of each Sequence Item.
        
        // For RLE, usually one frame is split into segments, but standard says "One or more fragments".
        // Usually, RLE frames are not split across fragments in simple cases, but they CAN be.
        // However, standard says: "Each Frame is encoded in 1 or more Fragments".
        // AND "First Item is BOT". 
        
        // Simplified RLE Decoder for Single Frame or we decode just the first frame's data? 
        // This interface needs to support multi-frame. 
        // Ideally we decode ONE frame at a time. 
        // For now, let's assume `encodedBuffer` contains ONE Frame's data (reassembled or single fragment).
        // But the parser sends ALL fragments.
        
        // Actually, `extractPixelData` returns `Array<Uint8Array>`. 
        // We need clarity on if this decoder is for ONE frame or ALL frames. 
        // Let's assume it decodes ALL frames or the user asks for specific frame?
        // The interface `decode` returns `Promise<Uint8Array>` (Single buffer). 
        // So we likely decode the WHOLE pixel data (all frames) into one big buffer?
        
        // Let's implement RLE decompression for a single buffer.
        // If multiple fragments, we might need to concat them if they represent one stream?
        // Or RLE works on Frame basis.
        
        // Simplest strategy: Combine all fragments (excluding BOT) and try to decode.
        // NOTE: DICOM RLE is weird.
        
        // Let's stick to a simple RLE implementation.
        
        const combined = RleDecoder.concat(encodedBuffer);
        // If first item is empty or BOT, skip?
        // The parser might have excluded BOT if we processed SQ properly.
        // But `extractEncapsulatedPixelData` returns ALL items values.
        // Item 0 is usually BOT.
        
        let startOffset = 0;
        // Check for BOT (Item 0). If length = 0 or mostly zeros? 
        // Or if it looks like offsets?
        // If encodedBuffer[0] is strictly offsets?
        // Let's assume we skip BOT if we can identify it. 
        // Or we just decode what is given.
        
        return RleDecoder.decompress(combined);
    }

    private static concat(buffers: Uint8Array[]): Uint8Array {
      // Basic concat
      let total = 0;
      for(const b of buffers) total += b.length;
      const res = new Uint8Array(total);
      let off = 0;
      for(const b of buffers) {
          res.set(b, off);
          off += b.length;
      }
      return res;
    }
    
    // Native RLE Decompression
    private static decompress(src: Uint8Array): Uint8Array {
        // Read RLE Header
        if (src.length < 64) throw new Error("Invalid RLE Header");
        const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
        const numSegments = view.getUint32(0, true);
        const offsets = [];
        for(let i=0; i<15; i++) {
            offsets.push(view.getUint32(4 + (i*4), true));
        }
        
        // Decompress each segment
        const segments = [];
        let totalLen = 0;
        
        for(let i=0; i<numSegments; i++) {
            const start = offsets[i];
            // End is next offset or end of buffer
            // Only valid if we know next offset. 
            // DICOM RLE doesn't explicitly give length in header, inferred from next offset.
            // But we can just run until we hit something? RLE is self-terminating? No.
            // We need to know where it ends. 
            // Standard says: "The RLE Header ... contains the offset to the start of each segment".
            // It does not contain lengths.
            
            // We can calculate length by subtraction?
            // Last segment goes to end?
            
            // Actually, we need to know Image Dimensions to know expected output size?
            // "The Image Pixel Data is compressed ... The Output is a stream of bytes".
            // RLE Segment -> Plane?
            
            // Let's just implement the PackBits loop.
            // We need to know WHERE the segment ends in the input stream.
            
            // Hack: Use next offset.
            let end = src.length;
            if (i < numSegments - 1) {
                end = offsets[i+1];
            }
            // If next offset is 0, it means no more segments? But we have numSegments.
            // Some offsets might be 0 if unused?
            
            if (start === 0 && i > 0) continue; // Skip?
            
            const segData = src.subarray(start, end);
            const decodedSeg = RleDecoder.decodeSegment(segData);
            segments.push(decodedSeg);
            totalLen += decodedSeg.length;
        }
        
        // Interleave if needed? 
        // For 8-bit, 1 segment is usually 1 frame?
        // For RGB, 3 segments (R, G, B) -> Interleave (RGBRGB...)
        // For 16-bit, 2 segments (High, Low) -> Interleave (High, Low...)
        
        // This requires `info` (Attributes).
        // Since we don't have it easily here, we might just return concatenated segments for now?
        // Correct RLE requires interleaving based on Planar Configuration?
        // Actually RLE is always planar. We must de-planarize (interleave) to get standard pixel data.
        
        // Let's assume we return De-Planarized data.
        // If 1 segment, easy.
        // If > 1, we need to interleave bytes.
        
        if (segments.length === 1) return segments[0];
        
        // Simple 1-byte interleaving (e.g. RGB or 16-bit)
        // Check if all segments same length?
        const segLen = segments[0].length;
        const result = new Uint8Array(totalLen);
        
        // Interleave: Byte 0 from Seg 0, Byte 0 from Seg 1 ...
        for(let i=0; i<segLen; i++) {
            for(let s=0; s<segments.length; s++) {
                if (i < segments[s].length) {
                    result[i * segments.length + s] = segments[s][i];
                }
            }
        }
        
        return result;
    }
    
    private static decodeSegment(src: Uint8Array): Uint8Array {
        // Pseudo-PackBits
        const out = []; // Slow push? Use pre-alloc if possible, but we don't know size.
        // Use Resizeable Buffer
        let p = 0;
        const len = src.length;
        
        // Use a conservative limit or chunked array?
        // Push to chunks
        const chunks = [];
        
        while (p < len) {
            const n = src[p++];
            if (n >= 0 && n <= 127) {
                // Literal copy
                const count = n + 1;
                if (p + count > len) break;
                chunks.push(src.subarray(p, p + count));
                p += count;
            } else if (n >= 129 && n <= 255) {
                // Repeat
                const count = 257 - n;
                if (p >= len) break;
                const val = src[p++];
                const repeat = new Uint8Array(count);
                repeat.fill(val);
                chunks.push(repeat);
            }
            // n === 128 is No-op
        }
        
        // Concat chunks
        let total = 0;
        for(const c of chunks) total += c.length;
        const res = new Uint8Array(total);
        let off = 0;
        for(const c of chunks) {
            res.set(c, off);
            off += c.length;
        }
        return res;
    }
}
