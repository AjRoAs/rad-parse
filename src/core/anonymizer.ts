/**
 * DICOM Anonymizer (Basic Attribute Confidentiality Profile)
 *
 * Provides functionality to anonymize DICOM datasets by replacing or removing sensitive tags
 * according to DICOM PS3.15 Annex E (Basic Attribute Confidentiality Profile).
 */

import { DicomDataSet, DicomElement } from './types';
import { BASIC_PROFILE_RULES, AnonymizationAction } from './anonymizationRules';

export interface AnonymizationOptions {
  /**
   * Custom replacement values for tags.
   * Key: Tag format 'xGGGGEEEE'.
   * Value: New value (string) or null to remove.
   */
  replacements?: Record<string, string | null>;
  
  /**
   * Prefix for dummy values (PatientID, PatientName, etc.)
   * Default: 'ANON'
   */
  patientIdPrefix?: string;
  
  /**
   * If true, keep private tags. Default: false (remove private tags).
   */
  keepPrivateTags?: boolean;

  /**
   * UID Map to maintain consistency across a dataset series.
   * If provided, new UIDs will be stored/retrieved here.
   */
   uidMap?: Record<string, string>;
}

const DEFAULT_PREFIX = 'ANON';

/**
 * Anonymize a DICOM dataset.
 * Returns a NEW dataset (shallow copy of structure, deep copy of modified elements).
 * Does not mutate the original dataset.
 *
 * @param dataset - The original dataset
 * @param options - Anonymization options
 * @returns Anonymized DicomDataSet
 */
export function anonymize(dataset: DicomDataSet, options: AnonymizationOptions = {}): DicomDataSet {
  // Create shallow copy of the dataset structure
  const newDict: Record<string, DicomElement> = { ...dataset.dict };
  
  const customReplacements = options.replacements || {};
  const prefix = options.patientIdPrefix || DEFAULT_PREFIX;
  const uidMap = options.uidMap || {};

  // 1. Process Basic Profile Rules
  Object.keys(BASIC_PROFILE_RULES).forEach(tag => {
      const rule = BASIC_PROFILE_RULES[tag];
      const element = newDict[tag];
      
      // Custom replacement overrides profile rules
      if (customReplacements[tag] !== undefined) {
          return; 
      }

      // Even if element is not present, some rules might require creation? 
      // Typically we only scrub existing tags.
      if (element) {
          applyRule(newDict, tag, rule.action, prefix, uidMap);
      }
  });

  // 2. Process Custom Replacements
  for (const tag of Object.keys(customReplacements)) {
      const replacement = customReplacements[tag];
      if (replacement === null) {
          delete newDict[tag];
      } else {
           const original = newDict[tag] || { vr: 'UN', Value: '' };
           newDict[tag] = {
              ...original,
              Value: replacement === '' ? '' : replacement, // Empty string for Z
              value: replacement === '' ? '' : replacement,
              length: replacement.length
           };
      }
  }

  // 3. Private Tags Removal
  if (!options.keepPrivateTags) {
      for (const tag of Object.keys(newDict)) {
          // Check if it's a private tag (odd group number)
          // Private Creator tags (GGGG,00xx) usually also removed unless safe.
          // Format usually xGGGGEEEE.
          if (tag.startsWith('x') && tag.length === 9) {
              const group = parseInt(tag.substring(1, 5), 16);
              if (!isNaN(group) && group % 2 !== 0) {
                  delete newDict[tag];
              }
          }
      }
  }
  
  return {
    dict: newDict,
    elements: newDict,
    string: (t) => { const e = newDict[t]; return e ? String(e.Value) : undefined; },
    uint16: dataset.uint16,
    int16: dataset.int16,
    floatString: dataset.floatString
  };
}

function applyRule(
    dict: Record<string, DicomElement>, 
    tag: string, 
    action: AnonymizationAction, 
    prefix: string,
    uidMap: Record<string, string>
) {
    switch (action) {
        case 'X': // Remove
            delete dict[tag];
            break;
            
        case 'Z': // Zero Length (Empty)
             if (dict[tag]) {
                 dict[tag] = { ...dict[tag], Value: '', value: '', length: 0 };
             }
             break;
             
        case 'D': // Dummy Value
             if (dict[tag]) {
                 dict[tag] = { ...dict[tag], Value: prefix, value: prefix, length: prefix.length };
             }
             break;
             
        case 'U': // Replace UID
             if (dict[tag]) {
                 const originalUID = String(dict[tag].Value);
                 // Normalize UID (strip padding)
                 const cleanUID = originalUID.replace(/\0/g, '');
                 
                 let newUID = uidMap[cleanUID];
                 if (!newUID) {
                     // Generate new UID
                     // Simple random UID: 2.25.<random>
                     // Real implementation should use UUID
                     newUID = '2.25.' + Math.floor(Math.random() * 1e14) + '.' + Date.now();
                     uidMap[cleanUID] = newUID;
                 }
                 dict[tag] = { ...dict[tag], Value: newUID, value: newUID, length: newUID.length };
             }
             break;
             
        case 'K': // Keep
             break;
    }
}
