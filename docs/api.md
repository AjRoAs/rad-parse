# RAD-Parser API Reference

This guide documents every public export from `@smallvis/rad-parser`. The package is organized into several conceptual layers: parser entry points, streaming helpers, pixel-data utilities, compression utilities, dictionary/tag helpers, value parsers, and VR detection. Each section below lists the function signature, purpose, and usage notes.

## Parser Entry Points

| Export | Description |
| --- | --- |
| `parseWithRadParser(byteArray: Uint8Array): DicomDataSet` | Parses a DICOM file and returns a fully populated dataset with helper accessors (`string`, `uint16`, `int16`, `floatString`). Throws if the file is invalid. |
| `parseWithMetadata(byteArray: Uint8Array): ParseResult` | Same output as `parseWithRadParser` but includes metadata such as `transferSyntax` and `characterSet`. Useful when you need the detected transfer syntax for downstream logic. |
| `extractTransferSyntax(byteArray: Uint8Array): string  undefined` | Quickly read the Transfer Syntax UID (e.g., `1.2.840.10008.1.2.1`) without fully parsing the dataset. Returns `undefined` when the file is missing or invalid. |
| `canParse(byteArray: Uint8Array): boolean` | Lightweight check to assert whether the bytes look like a DICOM file (either Part 10 or non-Part 10). |

## Streaming Helpers

| Export | Description |
| --- | --- |
| `StreamingParser` | Class that consumes chunks of data from large files. Emits callbacks for each element, enabling incremental processing in browsers or Node streams. |
| `parseFromAsyncIterator(iterator, options)` | Helper that feeds async iterators (e.g., `ReadableStream`) into `StreamingParser`. |
| `parseFromStream(stream, options)` | Convenience wrapper that accepts a browser/Node stream and parses it incrementally. |
| `ElementCallback`, `StreamingOptions` | Types that define callbacks/options for streaming use cases. |

## Pixel Data & Compression Utilities

| Export | Description |
| --- | --- |
| `extractPixelData(dataset: DicomDataSet, element: DicomElement)` | Normalizes pixel data across encapsulated and native formats and returns `PixelDataResult`. |
| `isCompressedTransferSyntax(transferSyntax: string): boolean` | Returns `true` for common compression UIDs (RLE, JPEG variants). |
| `decompressPixelData(pixelData: PixelDataResult): Uint8Array \| null` | Performs RLE decompression when required. |
| `supportsImageDecoder(): boolean` | Detects whether the browser `ImageDecoder` API is available. |
| `decompressJPEG(pixelData: PixelDataResult, mimeType?: string): Promise<Uint8Array \| null>` | Uses the browser `ImageDecoder` API to decode JPEG frames into raw pixel bytes. |

## Utility Modules

| Export | Description |
| --- | --- |
| `dicomDictionary`, `getTagName(tag: string)`, `isPrivateTag(tag: string)` | Tag dictionary helpers for looking up tag names and identifying private tags. |
| `formatTagWithComma(tag: string)`, `normalizeTag(tag: string)` | Tag formatting helpers for conversion between `xGGGGEHHHH` and `GGGG,EEEE` forms. |
| `SafeDataView` | Bounds-checked `DataView` wrapper used internally and exported for tight buffer manipulation. |
| `parsePersonName`, `parseAgeString`, `parseDate`, `parseTime`, `parseDateTime`, `parseValueByVR` | Value parser helpers that parse PN/AS/DA/TM/DT strings while honoring separators and trimming rules. |
| `detectVR`, `detectVRForPrivateTag`, `requiresExplicitLength` | VR-detection helpers that support implicit VR datasets and heuristics for private tags. |
| `StreamingParser`, `parseFromAsyncIterator`, `parseFromStream`, `ElementCallback`, `StreamingOptions` | Streaming exports (described above). |

## Types

| Export | Description |
| --- | --- |
| `DicomElement`, `DicomDataSet`, `ParseResult`, `PixelDataResult`, `StreamingOptions`, `ElementCallback` | Core types describing DICOM elements, datasets, parse results, and streaming configuration. |

## Best Practices

- Prefer `parseWithMetadata` when you need metadata (transfer syntax, character set) as part of parsing.
- Use `StreamingParser` for large files where loading the entire dataset into memory is impractical.
- When working with pixel data, feed the resulting `PixelDataResult` into `decompressPixelData` or `decompressJPEG` as needed.

## Bundle Variants

- `dist/rad-parser.js` / `dist/rad-parser.min.js`: Standard bundles with the full dictionary included.
- `dist/rad-parser-nodict.js` / `dist/rad-parser-nodict.min.js`: Dictionary-free bundles that omit `dicomDictionary`, `getTagName`, and `isPrivateTag` for smaller payloads. Use this variant when you resolve tags another way or only care about core parsing utilities.
*** End Patch
