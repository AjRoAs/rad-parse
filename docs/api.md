# RAD-Parser API Reference

This guide documents every public export from `rad-parser`. The package is organized into several conceptual layers: parser entry points, streaming helpers, pixel-data plugins, and utility helpers.

## 1. Parser Entry Points

| Export                                                        | Description                                                                                                                             |
| :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(byteArray: Uint8Array, options?: UnifiedParseOptions)` | **Unified Entry Point (Recommended).** Supports all parsing modes (`type`: 'shallow'\|'full'\|'light'\|'lazy'). Returns `DicomDataSet`. |
| `parseWithMetadata(byteArray: Uint8Array): ParseResult`       | Returns `{ dataset, transferSyntax, characterSet }`. Useful for early extraction of TS.                                                 |
| `extractTransferSyntax(byteArray: Uint8Array)`                | Quickly read the Transfer Syntax UID without full parsing.                                                                              |
| `canParse(byteArray: Uint8Array): boolean`                    | Lightweight check to assert potential DICOM validity.                                                                                   |

## 2. Plugin Ecosystem & Codecs (New in v2.0)

| Export            | Description                                                                                 |
| :---------------- | :------------------------------------------------------------------------------------------ |
| `registry`        | The Global Codec Registry singleton. Use `registry.register(new MyCodec())`.                |
| `AutoDetectCodec` | Smart Delegator codec (Priority 1000). Sniffs content/TS and routes to appropriate decoder. |
| `RleCodec`        | **Native** TypeScript RLE decoder/encoder. Supports PackBits/Planar Configuration.          |
| `NodePngEncoder`  | **Native** Node.js PNG encoder. Uses built-in `zlib` to export PNGs without external dep.   |
| `Jpeg2000Decoder` | Adapter class. Requires injecting an external decoder (e.g. OpenJPEG WASM).                 |
| `JpegLsDecoder`   | Adapter class. Requires injecting an external decoder (e.g. CharLS).                        |
| `VideoDecoder`    | Adapter class for MPEG-2/H.264.                                                             |
| `WebGlDecoder`    | Browser-based fallback using WebGL/Canvas context.                                          |
| `WebGpuDecoder`   | Experimental WebGPU decoder.                                                                |

### Usage

```typescript
import { registry, AutoDetectCodec, RleCodec } from "rad-parser";
registry.register(new AutoDetectCodec());
registry.register(new RleCodec());
```

## 3. Pixel Data Utilities

| Export                                     | Description                                                                        |
| :----------------------------------------- | :--------------------------------------------------------------------------------- |
| `extractPixelData(dataset): PixelDataInfo` | Extracts Pixel Data element, Fragments, and Transfer Syntax from a parsed dataset. |
| `isCompressedTransferSyntax(ts: string)`   | Returns `true` for encapsulated syntaxes (RLE, JPEG, etc).                         |

## 4. Writer & Anonymizer

| Export                                       | Description                                                                          |
| :------------------------------------------- | :----------------------------------------------------------------------------------- |
| `write(dataset: DicomDataSet): Uint8Array`   | Serializes a dataset into a DICOM Part 10 binary buffer (Explicit VR Little Endian). |
| `anonymize(dataset, options?): DicomDataSet` | Returns a deep copy of the dataset with PII tags replaced/removed.                   |

## 5. Streaming & Helpers

| Export            | Description                                                  |
| :---------------- | :----------------------------------------------------------- |
| `StreamingParser` | Class for incremental parsing (Node Streams / Fetch result). |
| `SafeDataView`    | Internal safe view for bounds-checked reading.               |
| `dicomDictionary` | Full Tag Dictionary (in standard bundles).                   |

## Types

-   `DicomDataSet`: Main interface (dict access + optimized methods).
-   `PixelDataCodec`: Interface for implementing custom plugins.
