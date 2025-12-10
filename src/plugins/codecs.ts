export interface PixelDataCodec {
    name: string;
    priority: number;
    isSupported(): Promise<boolean> | boolean;
    canDecode(transferSyntax: string): boolean;
    decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array>;
    
    // Encoding Support
    canEncode?(transferSyntax: string): boolean;
    encode?(pixelData: Uint8Array, transferSyntax: string, width: number, height: number, samples: number, bits: number): Promise<Uint8Array[]>;
}

export class CodecRegistry {
    private codecs: PixelDataCodec[] = [];

    register(codec: PixelDataCodec) {
        this.codecs.push(codec);
        this.codecs.sort((a, b) => b.priority - a.priority);
    }

    async getDecoder(transferSyntax: string): Promise<PixelDataCodec | null> {
        for (const codec of this.codecs) {
            if (codec.canDecode(transferSyntax)) {
                if (await codec.isSupported()) {
                    return codec;
                }
            }
        }
        return null;
    }

    async getEncoder(transferSyntax: string): Promise<PixelDataCodec | null> {
        for (const codec of this.codecs) {
            if (codec.canEncode && codec.canEncode(transferSyntax)) {
                 if (await codec.isSupported()) {
                    return codec;
                }
            }
        }
        return null;
    }
}

export const registry = new CodecRegistry();
