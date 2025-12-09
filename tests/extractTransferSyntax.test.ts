import { describe, expect, it } from 'vitest';
import { extractTransferSyntax } from '../src/index';

const encoder = new TextEncoder();

// Helper to create basic Part 10 file structure
function createPart10Dicom(transferSyntaxUID: string): Uint8Array {
  const tsBytes = encoder.encode(transferSyntaxUID);
  // Pad if odd length
  const tsValue = new Uint8Array(tsBytes.length + (tsBytes.length % 2));
  tsValue.set(tsBytes);

  // Group 0002, Element 0010 (Transfer Syntax UID)
  // VR = UI (Unlimited Character String) in Explicit VR Little Endian (Meta header is always Explicit VR LE)
  const elementHeader = new Uint8Array(8);
  const view = new DataView(elementHeader.buffer);
  view.setUint16(0, 0x0002, true); // Group
  view.setUint16(2, 0x0010, true); // Element
  elementHeader[4] = 'U'.charCodeAt(0); // VR0
  elementHeader[5] = 'I'.charCodeAt(0); // VR1
  view.setUint16(6, tsValue.length, true); // Length

  // Meta Group Length (0002,0000) - Required for valid meta header usually, 
  // but our parser might be lenient. Let's include it for correctness if possible, 
  // but simplicity first. Our parser skips scanning for finding TS in Part 10?
  // No, `extractTransferSyntax` iterates tags in 0002 group.
  
  // Let's make a simple sequence of bytes:
  // Preamble (128) + DICM + (0002,0010) + Value
  
  const preamble = new Uint8Array(128); // All zeros
  const dicm = encoder.encode('DICM');
  
  // Construct the file
  const buffer = new Uint8Array(128 + 4 + 8 + tsValue.length);
  buffer.set(preamble, 0);
  buffer.set(dicm, 128);
  buffer.set(elementHeader, 132);
  buffer.set(tsValue, 132 + 8);
  
  return buffer;
}

// Helper to create "Raw" DICOM (no Preamble/DICM) but with the tag present
function createRawDicomWithTS(transferSyntaxUID: string): Uint8Array {
  const tsBytes = encoder.encode(transferSyntaxUID);
  const tsValue = new Uint8Array(tsBytes.length + (tsBytes.length % 2));
  tsValue.set(tsBytes);

  // Element (0002,0010) - Transfer Syntax UID
  const elementHeader = new Uint8Array(8);
  const view = new DataView(elementHeader.buffer);
  view.setUint16(0, 0x0002, true);
  view.setUint16(2, 0x0010, true);
  elementHeader[4] = 'U'.charCodeAt(0);
  elementHeader[5] = 'I'.charCodeAt(0);
  view.setUint16(6, tsValue.length, true);

  // Just return the tag + value
  const buffer = new Uint8Array(8 + tsValue.length);
  buffer.set(elementHeader, 0);
  buffer.set(tsValue, 8);
  
  return buffer;
}

describe('extractTransferSyntax', () => {
  it('returns null for empty buffer', () => {
    expect(extractTransferSyntax(new Uint8Array(0))).toBeNull();
  });

  it('returns null for buffer too small to be DICOM', () => {
    expect(extractTransferSyntax(new Uint8Array(100))).toBeNull();
  });

  it('extracts Transfer Syntax from Part 10 file (Little Endian)', () => {
    const ts = '1.2.840.10008.1.2.1'; // Explicit VR Little Endian
    const data = createPart10Dicom(ts);
    expect(extractTransferSyntax(data)).toBe(ts);
  });

  it('extracts Transfer Syntax from Part 10 file (JPEG Baseline)', () => {
    const ts = '1.2.840.10008.1.2.4.50'; // JPEG Baseline
    const data = createPart10Dicom(ts);
    expect(extractTransferSyntax(data)).toBe(ts);
  });

  it('extracts Transfer Syntax from Raw DICOM (missing preamble)', () => {
    const ts = '1.2.840.10008.1.2.5'; // RLE Lossless
    const data = createRawDicomWithTS(ts);
    expect(extractTransferSyntax(data)).toBe(ts);
  });

  it('returns null if Transfer Syntax tag is missing in Part 10', () => {
    // Valid header but wrong tag (e.g. 0002,0002 Media Storage SOP Class UID)
    const preamble = new Uint8Array(128);
    const dicm = encoder.encode('DICM');
    
    // Create random tag (0002,0002) instead of (0002,0010)
    const elementHeader = new Uint8Array(8);
    const view = new DataView(elementHeader.buffer);
    view.setUint16(0, 0x0002, true); 
    view.setUint16(2, 0x0002, true); // Not TS
    elementHeader[4] = 'U'.charCodeAt(0);
    elementHeader[5] = 'I'.charCodeAt(0);
    view.setUint16(6, 2, true);
    
    const buffer = new Uint8Array(128 + 4 + 8 + 2);
    buffer.set(preamble, 0);
    buffer.set(dicm, 128);
    buffer.set(elementHeader, 132);
    
    // It should stop scanning group 0002 eventually. 
    // Since we only have one tag and it's not TS, it should hit end of buffer and return null.
    expect(extractTransferSyntax(buffer)).toBeNull();
  });
  
  it('handles padded Transfer Syntax UID correctly', () => {
    // UID with null terminator or space padding
    const ts = '1.2.840.10008.1.2';
    // Manually create buffer with null padding
    const tsBytes = encoder.encode(ts + '\0');
    // Ensure even length
    const tsValue = new Uint8Array(tsBytes.length + (tsBytes.length % 2));
    tsValue.set(tsBytes);
    
    const elementHeader = new Uint8Array(8);
    const view = new DataView(elementHeader.buffer);
    view.setUint16(0, 0x0002, true);
    view.setUint16(2, 0x0010, true);
    elementHeader[4] = 'U'.charCodeAt(0);
    elementHeader[5] = 'I'.charCodeAt(0);
    view.setUint16(6, tsValue.length, true);

    const buffer = new Uint8Array(8 + tsValue.length);
    buffer.set(elementHeader, 0);
    buffer.set(tsValue, 8);
    
    // Should strip nulls
    expect(extractTransferSyntax(buffer)).toBe(ts);
  });
});
