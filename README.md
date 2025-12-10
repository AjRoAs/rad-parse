# RAD-Parser

**RAD-Parser** is a lightweight, performant, self-contained DICOM parser implementation with **zero external dependencies**. It is designed for safety, efficiency, and reliability in medical imaging applications or cloud-based pipelines where dependency bloat is a liability.

[![npm version](https://img.shields.io/npm/v/rad-parser.svg)](https://www.npmjs.com/package/rad-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

-   ✅ **Zero Dependencies**: Pure TypeScript/JavaScript implementation using only native APIs.
-   ✅ **Plugin System**: Extensible architecture for Pixel Data Codecs.
-   ✅ **Native Codecs**:
    -   **RLE Lossless**: Full Decode & Encode (PackBits) in pure TS.
    -   **PNG Export**: Native Node.js encoder (via `zlib`) and Browser encoder (via `<canvas>`).
    -   **JPEG Lossless (Shell)**: Native bitstream parser/sniffer.
-   ✅ **AutoDetect**: Smart codec routing and content sniffing.
-   ✅ **Serialization**: Write/Convert DICOM files (Explicit VR Little Endian).
-   ✅ **Anonymization**: Built-in anonymization utilities.
-   ✅ **Safe & Performant**: Efficient binary parsing with strict bounds checking.

## Installation

```bash
npm install rad-parser
```

## Usage

### 1. Basic Parsing (Metadata Only)

```typescript
import { parse } from "rad-parser";

const dataset = parse(byteArray);

// string access
const name = dataset.string("x00100010"); // PatientName
console.log(`Patient: ${name}`);

// direct element access
const element = dataset.dict["x00100010"];
console.log(element.Value);
```

### 2. Pixel Data & Plugins (The "Full Power" Mode)

To handle compressed pixel data (RLE, JPEG, etc.), you must register the desired codecs. This modular approach keeps the core lightweight.

```typescript
import {
    parse,
    registry,
    AutoDetectCodec,
    RleCodec,
    NodePngEncoder
} from "rad-parser";

// 1. Register Plugins (Mix & Match)
// AutoDetect uses Priority 1000 to intercept and route calls
registry.register(new AutoDetectCodec());
registry.register(new RleCodec());
registry.register(new NodePngEncoder());

// 2. Parse & Extract
const dataset = parse(u8Buffer);
const pixels = await dataset.extractPixelData(); // Helper or manual usage check

if (pixels.isEncapsulated) {
    // 3. Decode via Registry (AutoDetect will handle routing)
    const decoder = await registry.getDecoder(dataset.transferSyntax);
    if (decoder) {
        const decodedFrame = await decoder.decode(pixels.fragments, 0, {
            transferSyntax: dataset.transferSyntax,
            rows: dataset.rows,
            columns: dataset.columns
        });

        // 4. Export to PNG (Zero-Dep Node.js native export)
        const pngEncoder = await registry.getEncoder('png');
        if (pngEncoder) {
            const pngData = await pngEncoder.encode(decodedFrame, 'png', ...);
            // fs.writeFileSync('output.png', pngData[0]);
        }
    }
}
```

## Plugin Architecture

RAD-Parser uses a **Registry-based Plugin System**. Codecs are registered at runtime, allowing you to choose between Native (Pure JS) implementations or Adapters (External Libs).

### Supported Codecs

| Codec             | Implementation       | Decode Status         | Encode Status         | Notes                                       |
| ----------------- | -------------------- | --------------------- | --------------------- | ------------------------------------------- |
| **RLE**           | Pure TypeScript      | ✅ **Native**         | ✅ **Native**         | Full support (PackBits).                    |
| **PNG**           | Node `zlib` / Canvas | N/A                   | ✅ **Native**         | Export format.                              |
| **AutoDetect**    | Smart Router         | ✅ **Active**         | N/A                   | Sniffs content / Magic Bytes.               |
| **JPEG 2000**     | Adapter              | ⚠️ Requires Injection | ⚠️ Requires Injection | Use `jpeg2000-js` or OpenJPEG.              |
| **JPEG-LS**       | Adapter              | ⚠️ Requires Injection | ⚠️ Requires Injection | Use `charls-js`.                            |
| **JPEG Lossless** | Native Shell         | ✅ Sniffs Headers     | ❌                    | Parses structure, needs decoder for pixels. |

### Output Formats

-   **Node.js**: BMP, PNG (Native), RLE, RAW.
-   **Browser**: BMP, PNG/JPG (Native Canvas), RLE, RAW.

## Library Comparison

| Feature                | **rad-parser**  |   dcmjs   | dicom-parser |
| :--------------------- | :-------------: | :-------: | :----------: |
| **Zero Dependencies**  |   ✅ **Yes**    |   ❌ No   |    ✅ Yes    |
| **Parsing Speed**      |   🚀 **Fast**   | 🐢 Slower |   🚀 Fast    |
| **Writing / Creation** |   ✅ **Yes**    |  ✅ Yes   |    ❌ No     |
| **Plugin System**      |   ✅ **Yes**    |   ❌ No   |    ❌ No     |
| **Native Codecs**      | ✅ **RLE, PNG** |  ❌ None  |   ❌ None    |
| **Type Safety**        |  ✅ **Strict**  | ⚠️ Loose  |   ⚠️ Loose   |

## Performance Benchmark

Results from parsing 50 DICOM files (Avg Time per File):

| Parser                   | Type              | Avg Time    | vs dicom-parser | vs dcmjs    |
| ------------------------ | ----------------- | ----------- | --------------- | ----------- |
| **rad-parser (Shallow)** | Parsing Only      | **1.01 ms** | **1.2x Faster** | 3.0x Faster |
| **dicom-parser**         | Parsing Only      | 1.21 ms     | 1.0x            | 2.5x Faster |
| **rad-parser (Full)**    | Validation + Dict | 3.54 ms     | 0.3x            | 0.8x        |
| **dcmjs**                | Full Object       | 3.06 ms     | 0.4x            | 1.0x        |

_Benchmark run on typical medical imaging dataset (50 files)._

## CLI Usage

rad-parser comes with a built-in CLI for common operations:

```bash
# Dump tags
npx rad-parser dump file.dcm

# Anonymize file
npx rad-parser anonymize input.dcm output_anon.dcm
```

## Architecture (v2.0.0)

-   `src/core`: Main logic (parser, writer, anonymizer).
-   `src/plugins`: The Plugin Ecosystem.
-   `src/utils`: Helpers (dictionary, validation).

## Security & Dependencies

RAD-Parser is strictly **Zero Dependency** for its core functionalities.

-   **Node.js**: Uses `zlib`, `fs` for native capabilities.
-   **Browser**: Uses `TextDecoder`, `ImageDecoder` (WebCodecs), `Canvas`.
-   **External Codecs**: You must explicitly "bring your own library" for J2K/J-LS if needed. The Adapter classes (`Jpeg2000Decoder` etc.) provide the standard interface to plug them in.

## Contributing

1. Keep Core dependency-free.
2. Extensions go in `src/plugins`.
3. Verify with `npm test`.
