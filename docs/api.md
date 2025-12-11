# rad-parser API Reference

Welcome to the `rad-parser` API documentation. This guide provides an extensive overview of the library's functions, classes, and types, complete with practical examples to get you started.

## Philosophy

`rad-parser` is a lightweight, performant, and self-contained DICOM parser for JavaScript and TypeScript environments. It's designed with two core principles:

1.  **Zero Dependencies:** The core parsing logic has no external dependencies, making it robust and suitable for a wide range of environments, from Node.js servers to web browsers.
2.  **Modular & Extensible:** Complex features like compressed pixel data decoding are handled through a clean, extensible codec system. The library provides adapters for common formats, and you can easily inject your own decoders (e.g., from a WebAssembly library).

## Installation

```bash
npm install rad-parser
```

---

## Core API

These are the primary functions you'll use for most DICOM parsing tasks.

### `parse()`

The main entry point for parsing a DICOM file buffer. It's a versatile function that can be configured for different parsing depths.

```typescript
parse(byteArray: Uint8Array, options?: UnifiedParseOptions): DicomDataSet | ShallowDicomDataSet
```

**Parameters:**

*   `byteArray`: A `Uint8Array` containing the raw bytes of the DICOM file.
*   `options` (optional): An object to control the parsing strategy.
    *   `type`:
        *   `'full'` (default): Parses the entire dataset, including pixel data. This provides a `DicomDataSet` with all values populated.
        *   `'light'`: Parses all tags and decodes their values, but **skips** the bulky pixel data value (`7FE0,0010`). This is useful when you only need metadata.
        *   `'shallow'`: Performs the fastest parse. It reads only the tag information (group, element, VR, length, data offset) but does **not** read the values. The returned `ShallowDicomDataSet` is a map of tags to their metadata, without the `Value` property.

### `parseAndDecode()`

A convenience function that fully parses a DICOM file and automatically decodes the pixel data if a compatible codec is available.

```typescript
async parseAndDecode(byteArray: Uint8Array, options?: UnifiedParseOptions): Promise<DicomDataSet>
```

This function is equivalent to calling `parse()`, checking for compressed pixel data, and then calling a decoder. It returns a `DicomDataSet` where the `(7FE0,0010)` element's `Value` is the uncompressed pixel data buffer.

#### **Example: Basic Parsing and Decoding**

```typescript
import * as fs from 'fs';
import { parseAndDecode } from 'rad-parser';

// This example assumes you have a compressed DICOM file (e.g., RLE)
// and the necessary codecs are available.
try {
    const dicomBuffer = fs.readFileSync('compressed.dcm');
    const dicomBytes = new Uint8Array(dicomBuffer);

    // Parse the file and automatically decode pixel data
    const dataset = await parseAndDecode(dicomBytes);

    const patientName = dataset.string('x00100010');
    const pixelDataElement = dataset.elements['x7fe00010'];
    const rawPixelData = pixelDataElement.Value as Uint8Array;

    console.log(`Patient Name: ${patientName}`);
    console.log(`Decoded Pixel Data size: ${rawPixelData.length} bytes`);

} catch (err) {
    console.error(`Failed to parse and decode DICOM file: ${err.message}`);
}
```

---

## Streaming

For large files or network streams, the `StreamingParser` allows you to process DICOM data incrementally.

### `StreamingParser`

A class that consumes chunks of a DICOM file and emits events as it parses elements.

#### **Example: Streaming from a File (Node.js)**

```typescript
import * as fs from 'fs';
import { StreamingParser } from 'rad-parser';

// Path to your DICOM file
const filePath = 'large_dicom_file.dcm';

const streamParser = new StreamingParser();

// Listen for parsed elements
streamParser.on('element', (element) => {
    // Access tag, VR, length, and value (if parsed)
    console.log(`Parsed Element: ${element.tag}, VR: ${element.vr}, Length: ${element.length}`);
});

streamParser.on('error', (err) => {
    console.error('Streaming error:', err);
});

streamParser.on('end', () => {
    console.log('Finished parsing stream.');
    // The full dataset is available here if needed
    const finalDataset = streamParser.getDataset();
    console.log(`Final Patient Name: ${finalDataset.string('x00100010')}`);
});

// Create a read stream and pipe it to the parser
const readStream = fs.createReadStream(filePath);
readStream.on('data', (chunk) => {
    streamParser.processChunk(new Uint8Array(chunk));
});
readStream.on('end', () => {
    streamParser.finalize();
});
```

---

## Pixel Data & Codecs

`rad-parser` uses a powerful codec system to handle compressed pixel data. This system is centered around the global `registry`.

### Codec Registration and Usage

*   **Automatic Loading:** For common transfer syntaxes (like RLE, JPEG, JPEG 2000), `rad-parser` automatically attempts to load the correct decoder on demand. For most use cases, you don't need to do anything.
*   **Adapter Pattern:** For formats requiring large external libraries (e.g., JPEG 2000), `rad-parser` provides "adapter" classes. You can manually register a configured instance of these adapters to use your own decoder.
*   **Functional Registration:** For maximum flexibility, you can register a codec directly from a configuration object without creating a class.

For detailed examples of integrating third-party libraries like `openjpeg-js` and `charls-js`, see the **[Codec Integration Guide](./codec-examples.md)**.

For examples of how to encode raw pixel data, see the **[Encoding Examples Guide](./encoding-examples.md)**.

### `registry.registerFunctional()`

This method allows you to register a custom codec without defining a full class.

```typescript
registry.registerFunctional(config: FunctionalCodecConfig)
```

**`FunctionalCodecConfig`:**

*   `name` (string): A unique name for your codec.
*   `transferSyntaxes` (string[]): An array of Transfer Syntax UIDs this codec can handle.
*   `priority` (number): A number indicating the codec's priority. Higher numbers are tried first.
*   `decode` (function): `async (fragments: Uint8Array[], info: any) => Promise<Uint8Array>` - The function that performs decoding.
*   `encode?` (function): An optional function for encoding.
*   `isSupported?` (function): An optional function that returns `true` if the codec can be used in the current environment.

#### **Example: Registering a Functional Codec**
```typescript
import { registry, concatFragments } from 'rad-parser';

// A simple (and incorrect) "decoder" that just concatenates fragments
const dummyDecoder = async (fragments: Uint8Array[], info: any): Promise<Uint8Array> => {
    console.log('Functional codec is running!');
    return concatFragments(fragments);
};

registry.registerFunctional({
    name: 'my-functional-codec',
    transferSyntaxes: ['1.2.840.10008.1.2.4.91'], // Claim JPEG 2000
    priority: 200, // High priority
    decode: dummyDecoder
});

// Now, when a JPEG 2000 file is parsed, this functional codec will be used.
```

### Available Codecs

The following table provides a summary of the codecs included with `rad-parser`.

| Codec Class                 | Implementation Type      | Fragment Handling         | Supported Transfer Syntax(es)                                                              | Notes                                                                                       |
| :-------------------------- | :----------------------- | :------------------------ | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **`RleCodec`**              | Native TypeScript        | `multiFrame: true`        | `1.2.840.10008.1.2.5` (RLE Lossless)                                                       | Decodes each frame individually.                                                            |
| **`JpegLosslessNative`**    | Native TypeScript (Stub) | `multiFrame: false`       | `1.2.840.10008.1.2.4.70` (JPEG Lossless SV1)                                               | A skeleton implementation; throws an error but shows how a native JS codec can be built.    |
| **`BrowserImageCodec`**     | Browser API              | `multiFrame: false`       | `...4.50`, `...4.51` (JPEG Baseline)                                                       | Uses the browser's built-in `ImageDecoder` API. Not available in Node.js.                   |
| **`Jpeg2000Decoder`**       | Adapter                  | `multiFrame: false`       | `...4.90`, `...4.91` (JPEG 2000)                                                           | Requires injecting an external decoder, e.g., from `openjpeg-js`.                           |
| **`JpegLsDecoder`**         | Adapter                  | `multiFrame: false`       | `...4.80`, `...4.81` (JPEG-LS)                                                             | Requires injecting an external decoder, e.g., from `charls-js`.                             |
| **`JpegLosslessDecoder`**   | Adapter                  | `multiFrame: false`       | `...4.57`, `...4.70` (JPEG Lossless)                                                       | Requires injecting an external decoder.                                                     |
| **`VideoDecoder`**          | Adapter                  | `multiFrame: false`       | `...4.100` to `...4.106` (MPEG2, H.264)                                                     | Requires injecting an external video decoder.                                               |
| **`WebGpuDecoder`**         | GPU                      | `multiFrame: false`       | Claims all (high priority)                                                                 | Experimental; uses WebGPU compute shaders. A stub implementation for future development.    |
| **`WebGlDecoder`**          | GPU                      | `multiFrame: false`       | Claims all (fallback)                                                                      | Experimental; uses WebGL as a fallback. A stub implementation.                              |
| **`NodePngEncoder`**        | Native (Node.js)         | `multiFrame: false`       | N/A (Encoder only)                                                                         | An **encoder** for creating PNG images from raw pixel data in a Node.js environment.        |
| **`AutoDetectCodec`**       | Delegator                | `multiFrame: true`        | Claims all (highest priority)                                                              | Not a real codec; it inspects the data and delegates to the appropriate registered codec.   |

---

## Codec Helpers

For cases where you need to perform decoding or encoding outside of the main `parse` workflow, these helper functions provide direct access to the codec registry.

### `decodePixelData()`

Decodes a compressed pixel data buffer using the best available registered codec.

```typescript
async decodePixelData(
    transferSyntax: string,
    fragments: Uint8Array[],
    decodeOptions?: any
): Promise<Uint8Array>
```

### `encodePixelData()`

Encodes a raw pixel data buffer using a registered encoder.

```typescript
async encodePixelData(
    transferSyntax: string,
    pixelData: Uint8Array,
    encodeOptions: { width: number, height: number, ... }
): Promise<Uint8Array[]>
```

---

## DICOM Manipulation

### `anonymize()` & `write()`

These functions allow you to modify a dataset and serialize it back into a DICOM file.

`anonymize()`: Removes or blanks patient-identifying information according to the DICOM Basic Application Level Confidentiality Profile.
`write()`: Takes a `DicomDataSet` and returns a `Uint8Array` representing a valid DICOM file, encoded in Explicit VR Little Endian.

#### **Example: Anonymize and Write a File**

```typescript
import { parse, anonymize, write } from 'rad-parser';
import * as fs from 'fs';

const inputFile = 'original.dcm';
const outputFile = 'anonymized.dcm';

try {
    // 1. Parse the original file
    const originalBytes = new Uint8Array(fs.readFileSync(inputFile));
    const originalDataset = parse(originalBytes, { type: 'full' });

    // 2. Anonymize the dataset
    console.log(`Anonymizing patient name: ${originalDataset.string('x00100010')}`);
    const anonymizedDataset = anonymize(originalDataset);
    console.log(`New patient name: ${anonymizedDataset.string('x00100010')}`);

    // 3. Write the new dataset to a buffer
    const outputBytes = write(anonymizedDataset);

    // 4. Save the buffer to a file
    fs.writeFileSync(outputFile, outputBytes);
    console.log(`Successfully wrote anonymized file to ${outputFile}`);

} catch (err) {
    console.error(`An error occurred: ${err.message}`);
}
```

---

## Handling Encapsulated Data

DICOM files can act as wrappers for other file formats, such as PDFs or structured ECG waveform data. `rad-parser` provides direct access to this encapsulated data.

For detailed guides and examples, see the **[Encapsulated Data Guide](./encapsulated-data.md)**.

---

## Low-Level APIs & Types

The library also exports several lower-level utilities and all core TypeScript types for advanced use cases. These functions are useful for custom DICOM processing, formatting, and value manipulation.

For detailed documentation and code examples on these helper functions, please see the **[Utility Functions API Reference](./utilities.md)**.

Key utilities include:
*   **Tag Utilities:** `getTagName`, `formatTagWithComma`, `isPrivateTag`
*   **Value Parsers:** `parseDate`, `parsePersonName`, `parseAgeString`, etc.
*   **Core Types:** `DicomDataSet`, `DicomElement`, `PixelDataCodec`, `ShallowDicomDataSet`.

It is recommended to explore the types via your IDE's auto-complete and type-checking features.