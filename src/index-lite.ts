/**
 * RAD-Parser (dictionary-free bundle)
 *
 * This entry point mirrors `src/index.ts` but omits the dictionary helpers to keep
 * the bundle size small when only core parsing utilities are needed.
 */

export { DicomParseError, createParseError } from './errors';
export {
  canParse,
  extractTransferSyntax,
  parseWithMetadata,
  parseWithRadParser,
  type ParseResult,
} from './parser';
export { extractPixelData, isCompressedTransferSyntax, type PixelDataResult } from './pixelData';
export { SafeDataView } from './SafeDataView';
export { parseSequence } from './sequenceParser';
export {
  StreamingParser,
  parseFromAsyncIterator,
  parseFromStream,
  type ElementCallback,
  type StreamingOptions,
} from './streaming';
export { formatTagWithComma, normalizeTag } from './tagUtils';
export type { DicomDataSet, DicomElement } from './types';
export {
  parseAgeString,
  parseDate,
  parseDateTime,
  parsePersonName,
  parseTime,
  parseValueByVR,
} from './valueParsers';
export { detectVR, detectVRForPrivateTag, requiresExplicitLength } from './vrDetection';
