/**
 * Codec Registry and Plugin Interface
 *
 * Manages pixel data decoders with priority support.
 */

export interface PixelDataDecoder {
  /**
   * Unique name of the decoder [e.g. 'rle-ts', 'jpeg-webgpu']
   */
  name: string;
  
  /**
   * Priority of the decoder. Higher is better.
   * e.g. WebGPU = 100, WASM = 50, JS = 10
   */
  priority: number;
  
  /**
   * Check if this decoder is supported in the current environment.
   */
  isSupported(): Promise<boolean> | boolean;
  
  /**
   * Check if this decoder can handle the given Transfer Syntax.
   */
  canDecode(transferSyntax: string): boolean;
  
  /**
   * Decode pixel data.
   * @param encodedBuffer - The compressed pixel data (fragments)
   * @param length - Total expected length (optional)
   * @param info - Image info (rows, cols, etc) needed for decoding
   */
  decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array>;
}

class CodecRegistry {
    private decoders: PixelDataDecoder[] = [];

    register(decoder: PixelDataDecoder) {
        this.decoders.push(decoder);
        // Sort by priority desc
        this.decoders.sort((a, b) => b.priority - a.priority);
    }

    async getDecoder(transferSyntax: string): Promise<PixelDataDecoder | null> {
        for (const decoder of this.decoders) {
            if (decoder.canDecode(transferSyntax)) {
                if (await decoder.isSupported()) {
                    return decoder;
                }
            }
        }
        return null;
    }
    
    getRegisteredDecoders(): string[] {
        return this.decoders.map(d => d.name);
    }
}

export const registry = new CodecRegistry();
