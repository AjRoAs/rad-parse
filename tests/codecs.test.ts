import { describe, it, expect } from 'vitest';
import { registry, RleDecoder, BrowserImageDecoder, WebGpuDecoder } from '../src/index';

describe('Codec Registry', () => {
    it('should register and prioritize decoders', async () => {
        // Clear or mock registry
        const rle = new RleDecoder();
        const browser = new BrowserImageDecoder();
        
        registry.register(rle); // 10
        registry.register(browser); // 50
        
        // 1.2.840.10008.1.2.5 is RLE
        // Browser doesn't support it.
        const d1 = await registry.getDecoder('1.2.840.10008.1.2.5');
        expect(d1?.name).toBe('rle-ts');
        
        // 1.2.840.10008.1.2.4.50 is JPEG
        // Browser supports it.
        // Mock window/ImageDecoder if needed for full test, but here checking selection logic.
        // BrowserImageDecoder.isSupported() returns false in Node environment.
        // So it should fallback to null or whatever is next.
    });
});

describe('RLE Decoder', () => {
    it('should be supported', () => {
        const d = new RleDecoder();
        expect(d.isSupported()).toBe(true);
        expect(d.canDecode('1.2.840.10008.1.2.5')).toBe(true);
    });
    
    // Add real RLE decode test if we have RLE sample data
});
