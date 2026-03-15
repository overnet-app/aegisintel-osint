/**
 * Utility for repairing malformed JSON from LLM responses
 */
export class JsonRepairUtil {
  /**
   * Normalize special Unicode characters to ASCII equivalents
   * This MUST be done before any parsing or extraction
   */
  private static normalizeUnicode(str: string): string {
    let result = str;
    
    // Remove control characters (but keep newlines and tabs for structure)
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
    
    // Normalize ALL types of dashes to regular hyphen
    // U+2010 HYPHEN, U+2011 NON-BREAKING HYPHEN, U+2012 FIGURE DASH
    // U+2013 EN DASH, U+2014 EM DASH, U+2015 HORIZONTAL BAR
    // U+2212 MINUS SIGN, U+FE58 SMALL EM DASH, U+FE63 SMALL HYPHEN-MINUS
    result = result.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63]/g, '-');
    
    // Normalize special quotes to regular quotes
    // Left/right single quotes, single low-9, single high-reversed-9
    result = result.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
    // Left/right double quotes, double low-9, double high-reversed-9
    result = result.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
    
    // Normalize ellipsis
    result = result.replace(/\u2026/g, '...');
    
    // Normalize spaces (non-breaking space, thin space, etc.)
    result = result.replace(/[\u00A0\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F]/g, ' ');
    
    // Normalize mathematical symbols to ASCII equivalents
    result = result.replace(/\u2265/g, '>=');  // ≥ GREATER-THAN OR EQUAL TO
    result = result.replace(/\u2264/g, '<=');  // ≤ LESS-THAN OR EQUAL TO
    result = result.replace(/\u00D7/g, 'x');   // × MULTIPLICATION SIGN
    result = result.replace(/\u00F7/g, '/');   // ÷ DIVISION SIGN
    result = result.replace(/\u2260/g, '!=');  // ≠ NOT EQUAL TO
    result = result.replace(/\u2248/g, '~');   // ≈ ALMOST EQUAL TO
    result = result.replace(/\u00B1/g, '+/-'); // ± PLUS-MINUS SIGN
    result = result.replace(/\u00B2/g, '^2');  // ² SUPERSCRIPT TWO
    result = result.replace(/\u00B3/g, '^3');  // ³ SUPERSCRIPT THREE
    result = result.replace(/\u221A/g, 'sqrt'); // √ SQUARE ROOT
    result = result.replace(/\u221E/g, 'inf'); // ∞ INFINITY
    result = result.replace(/\u03C0/g, 'pi');  // π PI
    
    // Remove zero-width characters
    result = result.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    
    return result;
  }

  /**
   * Extract balanced JSON from a string using brace matching
   */
  private static extractBalancedJSON(str: string, isArray: boolean = false): string | null {
    const openBrace = isArray ? '[' : '{';
    const closeBrace = isArray ? ']' : '}';
    
    const startIdx = str.indexOf(openBrace);
    if (startIdx === -1) return null;
    
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = startIdx; i < str.length; i++) {
      const char = str[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === openBrace) {
          depth++;
        } else if (char === closeBrace) {
          depth--;
          if (depth === 0) {
            return str.substring(startIdx, i + 1);
          }
        }
      }
    }
    
    // If we didn't find a balanced structure, try to fix it
    // Return what we have up to the last closing brace
    const lastClose = str.lastIndexOf(closeBrace);
    if (lastClose > startIdx) {
      return str.substring(startIdx, lastClose + 1);
    }
    
    return null;
  }

  /**
   * Repair and parse JSON string with multiple recovery strategies
   */
  static repairAndParse<T>(jsonStr: string, logger?: any): T {

    // Step 0: Normalize Unicode FIRST (before any other processing)
    let repaired = this.normalizeUnicode(jsonStr.trim());
    

    // Step 1: Remove markdown code blocks
    if (repaired.startsWith('```')) {
      repaired = repaired.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    // Also handle code blocks that might be in the middle
    repaired = repaired.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Step 2: Extract JSON using balanced brace matching
    // Try array first (for follow-up questions, etc.)
    let extracted = this.extractBalancedJSON(repaired, true);
    if (!extracted) {
      // Try object
      extracted = this.extractBalancedJSON(repaired, false);
    }
    

    if (extracted) {
      repaired = extracted;
    }

    // Step 3: Fix common issues
    repaired = this.fixCommonIssues(repaired);

    // Step 4: Try parsing
    try {
      return JSON.parse(repaired) as T;
    } catch (error: any) {
      if (logger) {
        logger.warn(`JSON parse failed, attempting advanced repair: ${error.message}`);
      }

      // Advanced repair: try to fix structural issues
      try {
        repaired = this.advancedRepair(repaired);
        return JSON.parse(repaired) as T;
      } catch (secondError: any) {
        if (logger) {
          logger.warn(`Advanced repair failed, trying last resort: ${secondError.message}`);
        }

        // Last resort: try to build valid JSON from fragments
        try {
          const result = this.lastResortRepair(repaired, jsonStr);
          return JSON.parse(result) as T;
        } catch (finalError: any) {
          if (logger) {
            logger.error(`All JSON repair attempts failed: ${finalError.message}`);
            logger.error(`Original JSON (first 500 chars): ${jsonStr.substring(0, 500)}`);
          }
          throw new Error(`JSON repair failed after all attempts: ${finalError.message}`);
        }
      }
    }
  }

  /**
   * Fix common JSON issues
   */
  private static fixCommonIssues(jsonStr: string): string {
    let repaired = jsonStr;

    // Fix unescaped quotes inside string values
    repaired = this.fixUnescapedQuotes(repaired);
    
    // Fix unclosed strings in property values (e.g., "severity": "major)
    // Pattern: "key": "value that's not closed before comma/brace
    repaired = this.fixUnclosedStrings(repaired);

    // Fix missing commas in arrays - this is critical for "Expected ',' or ']' after array element"
    repaired = this.fixMissingArrayCommas(repaired);

    // Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Fix property names without quotes
    repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes for property values
    repaired = repaired.replace(/(:\s*)'([^']*)'(?=\s*[,}\]])/g, '$1"$2"');

    // Fix missing commas between properties
    repaired = repaired.replace(/"(\s*)\n(\s*)"/g, '",\n$2"');
    
    // Fix missing commas after closing braces/brackets
    repaired = repaired.replace(/}(\s*)\n(\s*)"/g, '},\n$2"');
    repaired = repaired.replace(/](\s*)\n(\s*)"/g, '],\n$2"');

    return repaired;
  }

  /**
   * Fix missing commas between array elements
   * Handles cases like: [{...}{...}] or [{...}  {...}]
   */
  private static fixMissingArrayCommas(jsonStr: string): string {
    let result = jsonStr;
    
    // Use regex patterns to find missing commas in arrays
    // Pattern 1: } followed by whitespace then { (missing comma between objects)
    result = result.replace(/(\})\s+(\{)/g, '$1, $2');
    
    // Pattern 2: ] followed by whitespace then [ (missing comma between arrays)
    result = result.replace(/(\])\s+(\[)/g, '$1, $2');
    
    // Pattern 3: } followed by whitespace then [ (object followed by array)
    result = result.replace(/(\})\s+(\[)/g, '$1, $2');
    
    // Pattern 4: ] followed by whitespace then { (array followed by object)
    result = result.replace(/(\])\s+(\{)/g, '$1, $2');
    
    // Pattern 5: " followed by whitespace then { or [ (string value followed by object/array)
    // Only add comma if the quote closes a value (has colon before it)
    // Use a more sophisticated approach: look for the pattern with context
    const lines = result.split('\n');
    const fixedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // Check if line ends with " and next line starts with { or [
      if (line.trim().endsWith('"') && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('{') || nextLine.startsWith('[')) {
          // Check if this quote is a value (has colon before it in the same line or previous context)
          const lineContext = line;
          if (lineContext.includes(':')) {
            // This is likely a value, add comma
            line = line.trimEnd() + ',';
          }
        }
      }
      fixedLines.push(line);
    }
    result = fixedLines.join('\n');
    
    // Also handle inline cases: "value" { or "value" [
    result = result.replace(/(")\s+(\{|\[)/g, '$1, $2');
    
    // Pattern 6: Number/true/false/null followed by { or [
    result = result.replace(/(\d+|true|false|null)\s+(\{|\[)/g, '$1, $2');
    
    // Pattern 7: } or ] at end of line followed by { or [ on next line (multiline arrays)
    result = result.replace(/(\}|\])\s*\n\s*(\{|\[)/g, '$1,\n$2');
    
    return result;
  }

  /**
   * Fix unclosed string values in JSON
   * Detects patterns like "key": "value that's not closed
   */
  private static fixUnclosedStrings(jsonStr: string): string {
    // Pattern: "key": "value followed by comma/brace without closing quote
    // Use regex to find and fix these patterns
    let repaired = jsonStr;
    
    // Find patterns like: "key": "value, or "key": "value}
    // This regex looks for: "key": "value (without closing quote) followed by comma or brace
    const unclosedPattern = /("(?:[^"\\]|\\.)*"\s*:\s*")([^"]*?)(\s*[,}])/g;
    
    repaired = repaired.replace(unclosedPattern, (match, prefix, value, suffix) => {
      // If the value doesn't end with a quote and is followed by comma/brace, close it
      if (value && !value.endsWith('"') && !value.endsWith('\\"')) {
        // Check if we're actually inside a string (count quotes before this)
        const beforeMatch = jsonStr.substring(0, jsonStr.indexOf(match));
        const quoteCount = (beforeMatch.match(/"/g) || []).length;
        
        // If odd number of quotes, we're inside a string - close it
        if (quoteCount % 2 === 1) {
          return prefix + value + '"' + suffix;
        }
      }
      return match;
    });
    
    // Also handle cases where string value ends at newline or end of string
    // Pattern: "key": "value\n or "key": "value at end
    const unclosedAtEndPattern = /("(?:[^"\\]|\\.)*"\s*:\s*")([^"]*?)(\s*\n\s*[",}])/g;
    repaired = repaired.replace(unclosedAtEndPattern, (match, prefix, value, suffix) => {
      if (value && !value.endsWith('"')) {
        return prefix + value + '"' + suffix;
      }
      return match;
    });
    
    // Manual scan for unclosed strings before structural characters
    const lines = repaired.split('\n');
    const fixedLines: string[] = [];
    let inString = false;
    let escapeNext = false;
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      let line = lines[lineIdx];
      let fixedLine = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (escapeNext) {
          fixedLine += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          fixedLine += char;
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          fixedLine += char;
        } else if (inString && (char === ',' || char === '}' || char === ']')) {
          // We're inside a string but found a structural character - close the string first
          fixedLine += '"';
          inString = false;
          fixedLine += char;
        } else {
          fixedLine += char;
        }
      }
      
      // If still in string at end of line and next line starts with structural char, close it
      if (inString && lineIdx < lines.length - 1) {
        const nextLine = lines[lineIdx + 1];
        if (nextLine.trim().startsWith(',') || nextLine.trim().startsWith('}') || nextLine.trim().startsWith(']')) {
          fixedLine += '"';
          inString = false;
        }
      }
      
      fixedLines.push(fixedLine);
    }
    
    // If still in string at the very end, close it
    if (inString) {
      fixedLines[fixedLines.length - 1] += '"';
    }
    
    return fixedLines.join('\n');
  }

  /**
   * Advanced repair for structural issues
   */
  private static advancedRepair(jsonStr: string): string {
    let repaired = jsonStr;

    // Fix unclosed strings by looking for patterns
    // Pattern: text followed by comma/brace without closing quote
    const lines = repaired.split('\n');
    const fixedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check if line has an unclosed string
      // Count quotes (excluding escaped ones)
      const quoteMatches = line.match(/(?<!\\)"/g) || [];
      if (quoteMatches.length % 2 === 1) {
        // Odd number of quotes - try to close the string
        // Look for where to insert the closing quote
        if (line.trimEnd().endsWith(',') || line.trimEnd().endsWith('}') || line.trimEnd().endsWith(']')) {
          // Insert quote before the comma/brace
          const trimmed = line.trimEnd();
          const lastChar = trimmed[trimmed.length - 1];
          line = trimmed.substring(0, trimmed.length - 1) + '"' + lastChar;
        } else if (i < lines.length - 1) {
          // Add closing quote at end and comma
          line = line.trimEnd() + '",';
        }
      }
      
      fixedLines.push(line);
    }
    
    repaired = fixedLines.join('\n');

    // Fix trailing content after last property
    repaired = repaired.replace(/,(\s*)$/g, '$1');

    return repaired;
  }

  /**
   * Last resort repair - try to extract valid fragments or build minimal valid JSON
   */
  private static lastResortRepair(repaired: string, original: string): string {
    // First, re-normalize the original
    const normalized = this.normalizeUnicode(original.trim());
    
    // Try balanced extraction again on normalized string
    let extracted = this.extractBalancedJSON(normalized, false);
    if (extracted) {
      const fixed = this.fixCommonIssues(extracted);
      try {
        JSON.parse(fixed);
        return fixed;
      } catch {
        // Continue
      }
    }

    // Try array extraction
    extracted = this.extractBalancedJSON(normalized, true);
    if (extracted) {
      const fixed = this.fixCommonIssues(extracted);
      try {
        JSON.parse(fixed);
        return fixed;
      } catch {
        // Continue
      }
    }

    // At this point, the JSON is likely truncated
    // Try to salvage by finding the last complete object/array element
    let attempt = this.fixTruncatedJson(normalized);
    
    // Apply common fixes
    attempt = this.fixCommonIssues(attempt);
    
    // Now close any unclosed structures
    attempt = this.closeUnclosedStructures(attempt);
    
    // Try parsing
    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      // Still failing - try more aggressive truncation
    }
    
    // More aggressive: find the last complete object and stop there
    const completeElement = this.findLastCompleteElement(normalized);
    if (completeElement) {
      try {
        JSON.parse(completeElement);
        return completeElement;
      } catch {
        // Continue
      }
    }
    
    // Ultimate fallback: try to build minimal valid JSON from what we have
    return this.buildMinimalValidJson(normalized);
  }

  /**
   * Close any unclosed structures in the JSON string
   */
  private static closeUnclosedStructures(jsonStr: string): string {
    let result = jsonStr;
    
    // First, detect and handle truncated strings
    let inString = false;
    let escapeNext = false;
    let lastStringStart = -1;
    let structureStack: Array<'{' | '['> = [];
    
    for (let i = 0; i < result.length; i++) {
      const char = result[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        if (!inString) {
          lastStringStart = i;
        }
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{' || char === '[') {
          structureStack.push(char);
        } else if (char === '}') {
          if (structureStack.length > 0 && structureStack[structureStack.length - 1] === '{') {
            structureStack.pop();
          }
        } else if (char === ']') {
          if (structureStack.length > 0 && structureStack[structureStack.length - 1] === '[') {
            structureStack.pop();
          }
        }
      }
    }
    
    // If we're still in a string, we need to close it
    if (inString) {
      // Check if the unclosed string looks like a value or a truncated property
      const afterLastStringStart = result.substring(lastStringStart);
      
      // Check if there's a colon before this string (it's a value)
      const beforeString = result.substring(0, lastStringStart).trimEnd();
      const isValue = beforeString.endsWith(':');
      
      if (isValue) {
        // This is a truncated value - close with a placeholder
        result = result.trimEnd() + '..."';
      } else {
        // This might be a truncated property name - remove it
        const lastComma = result.lastIndexOf(',', lastStringStart);
        const lastBrace = Math.max(result.lastIndexOf('{', lastStringStart), result.lastIndexOf('[', lastStringStart));
        const truncatePos = Math.max(lastComma, lastBrace);
        
        if (truncatePos > 0 && truncatePos < result.length - 1) {
          result = result.substring(0, truncatePos + 1);
          // Recount the structure stack
          structureStack = [];
          for (const char of result) {
            if (char === '{' || char === '[') {
              structureStack.push(char);
            } else if (char === '}' && structureStack[structureStack.length - 1] === '{') {
              structureStack.pop();
            } else if (char === ']' && structureStack[structureStack.length - 1] === '[') {
              structureStack.pop();
            }
          }
        } else {
          // Just close the string
          result += '"';
        }
      }
    }
    
    // Remove trailing commas
    result = result.replace(/,\s*$/, '');
    
    // Remove trailing colons (incomplete property)
    result = result.replace(/:\s*$/, ': null');
    
    // Close unclosed structures in reverse order
    while (structureStack.length > 0) {
      const open = structureStack.pop();
      result += open === '{' ? '}' : ']';
    }
    
    // Clean up any trailing commas before closures
    result = result.replace(/,(\s*[}\]])/g, '$1');
    
    return result;
  }

  /**
   * Find the last complete JSON element (object or value)
   */
  private static findLastCompleteElement(jsonStr: string): string | null {
    // Find all positions where we have a complete value followed by , or } or ]
    const completePositions: number[] = [];
    let inString = false;
    let escapeNext = false;
    let depth = 0;
    
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        if (!inString) {
          // End of string - check if followed by structural char
          let j = i + 1;
          while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
          const nextChar = jsonStr[j];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']') {
            completePositions.push(j);
          }
        }
        continue;
      }
      if (!inString) {
        if (char === '{' || char === '[') {
          depth++;
        } else if (char === '}' || char === ']') {
          depth--;
          if (depth >= 0) {
            completePositions.push(i + 1);
          }
        }
      }
    }
    
    // Try positions from last to first
    for (let i = completePositions.length - 1; i >= 0; i--) {
      const pos = completePositions[i];
      let attempt = jsonStr.substring(0, pos);
      attempt = this.closeUnclosedStructures(attempt);
      try {
        JSON.parse(attempt);
        return attempt;
      } catch {
        // Try next position
      }
    }
    
    return null;
  }

  /**
   * Build minimal valid JSON by extracting key-value pairs
   * Tries to extract as much valid structure as possible
   */
  private static buildMinimalValidJson(jsonStr: string): string {
    // Try to extract complete objects from an array
    // This is useful for cases like truncated hypothesis arrays or follow-up questions
    const arrayPatterns = [
      { key: 'hypotheses', returnKey: 'hypotheses' },
      { key: 'questions', returnKey: 'questions' },
      { key: 'followUpQuestions', returnKey: 'followUpQuestions' },
      { key: 'followUps', returnKey: 'followUps' },
    ];
    
    for (const pattern of arrayPatterns) {
      const arrayMatch = jsonStr.match(new RegExp(`"${pattern.key}"\\s*:\\s*\\[([^]*?)`, 'i'));
      if (arrayMatch) {
        // Try to find complete objects within the array
        const arrayContent = arrayMatch[1];
        const completeObjects: string[] = [];
        
        let depth = 0;
        let objectStart = -1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < arrayContent.length; i++) {
          const char = arrayContent[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\' && inString) {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') {
              if (depth === 0) objectStart = i;
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0 && objectStart !== -1) {
                completeObjects.push(arrayContent.substring(objectStart, i + 1));
                objectStart = -1;
              }
            }
          }
        }
        
        if (completeObjects.length > 0) {
          if (pattern.key === 'hypotheses') {
            return `{"hypotheses": [${completeObjects.join(',')}], "researchQuestions": [], "searchQueries": [], "priority": 5}`;
          } else {
            // For follow-up questions, return just the array
            return `[${completeObjects.join(',')}]`;
          }
        }
      }
    }
    
    // Try to extract individual question objects directly from array
    const questionMatches = jsonStr.matchAll(/\{\s*"question"\s*:\s*"([^"]+)"[^}]*\}/g);
    const extractedQuestions: string[] = [];
    for (const match of questionMatches) {
      try {
        // Try to parse the object to ensure it's valid
        JSON.parse(match[0]);
        extractedQuestions.push(match[0]);
      } catch {
        // Try to build a minimal valid object from the match
        const questionText = match[1];
        if (questionText) {
          extractedQuestions.push(`{"question": "${questionText.replace(/"/g, '\\"')}", "category": "related", "priority": 5}`);
        }
      }
    }
    
    if (extractedQuestions.length > 0) {
      return `[${extractedQuestions.join(',')}]`;
    }
    
    // Try similar extraction for other known structures
    const overallMatch = jsonStr.match(/"overallAssessment"\s*:\s*(\{[^}]+\})/);
    if (overallMatch) {
      try {
        JSON.parse(overallMatch[1]);
        return `{"overallAssessment": ${overallMatch[1]}, "weakEvidence": [], "missingInformation": [], "contradictions": [], "recommendations": [], "shouldContinue": true, "nextSteps": []}`;
      } catch {
        // Continue
      }
    }
    
    // Try to extract quality scores
    const qualityMatch = jsonStr.match(/"qualityScore"\s*:\s*(\d+)/);
    const completenessMatch = jsonStr.match(/"completenessScore"\s*:\s*(\d+)/);
    if (qualityMatch || completenessMatch) {
      const quality = qualityMatch ? parseInt(qualityMatch[1], 10) : 50;
      const completeness = completenessMatch ? parseInt(completenessMatch[1], 10) : 50;
      return `{"overallAssessment": {"qualityScore": ${quality}, "completenessScore": ${completeness}, "confidenceLevel": "medium"}, "weakEvidence": [], "missingInformation": [], "contradictions": [], "recommendations": [], "shouldContinue": true, "nextSteps": []}`;
    }
    
    // Extract the first key-value pair pattern and build a minimal object
    const kvMatch = jsonStr.match(/"([^"]+)"\s*:\s*("[^"]*"|[\d.]+|true|false|null)/);
    
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2];
      
      // If value is truncated, provide a placeholder
      if (value.startsWith('"') && !value.endsWith('"')) {
        value = value + '..."';
      }
      
      return `{"${key}": ${value}}`;
    }
    
    // Absolute fallback - return empty object
    return '{}';
  }

  /**
   * Fix unescaped quotes inside string values
   */
  private static fixUnescapedQuotes(jsonStr: string): string {
    const result: string[] = [];
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        result.push(char);
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        result.push(char);
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        if (!inString) {
          // Opening quote - start of a string
          inString = true;
          result.push(char);
        } else {
          // We're inside a string, check if this is closing quote or unescaped quote
          // Look ahead to see what comes after this quote (skip whitespace)
          let j = i + 1;
          while (j < jsonStr.length && /[\s\r\n]/.test(jsonStr[j])) {
            j++;
          }
          
          const nextChar = j < jsonStr.length ? jsonStr[j] : '';
          
          // If next non-whitespace char indicates end of value, this is a closing quote
          if (nextChar === '' || nextChar === ':' || nextChar === ',' || 
              nextChar === '}' || nextChar === ']') {
            // This is likely a closing quote
            inString = false;
            result.push(char);
          } else {
            // This is likely an unescaped quote inside a string value - escape it
            result.push('\\"');
          }
        }
      } else {
        result.push(char);
      }
    }

    return result.join('');
  }

  /**
   * Fix truncated JSON by finding the last valid JSON structure point
   * This handles cases where LLM response was cut off mid-sentence
   */
  private static fixTruncatedJson(jsonStr: string): string {
    let result = jsonStr.trim();
    
    // Remove any text before the first { or [
    const firstBrace = result.indexOf('{');
    const firstBracket = result.indexOf('[');
    
    if (firstBrace === -1 && firstBracket === -1) {
      return result;
    }
    
    const startIdx = firstBrace === -1 ? firstBracket :
                     firstBracket === -1 ? firstBrace :
                     Math.min(firstBrace, firstBracket);
    
    result = result.substring(startIdx);
    
    // Find the last position where we have a complete JSON value
    // This means finding the last }, ], or complete "string"
    let inString = false;
    let escapeNext = false;
    let lastCompleteValueEnd = 0;
    
    for (let i = 0; i < result.length; i++) {
      const char = result[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        if (!inString) {
          // Closed a string - check what comes next
          let j = i + 1;
          while (j < result.length && /\s/.test(result[j])) j++;
          
          const nextChar = result[j];
          // If followed by structural char, this is a valid end point
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            lastCompleteValueEnd = j;
          }
        }
        continue;
      }
      
      if (!inString) {
        if (char === '}' || char === ']') {
          lastCompleteValueEnd = i + 1;
        }
      }
    }
    
    // If we ended inside a string, truncate to last complete value
    if (inString) {
      if (lastCompleteValueEnd > 0) {
        result = result.substring(0, lastCompleteValueEnd);
      } else {
        // No complete value found - try to close the current string
        result += '"';
      }
    }
    
    // Remove trailing commas
    result = result.replace(/,\s*$/, '');
    
    // Remove incomplete property names (pattern: , "incomple at end)
    result = result.replace(/,\s*"[^"]*$/, '');
    
    // Remove incomplete property values (pattern: : "incomple at end) 
    // But be careful not to remove complete empty strings
    if (/:\s*"[^"]*$/.test(result) && !result.endsWith('""')) {
      // Find the last complete property before the incomplete one
      const lastCompleteComma = result.lastIndexOf('",');
      const lastCompleteBrace = Math.max(
        result.lastIndexOf('"}'),
        result.lastIndexOf('"]'),
        result.lastIndexOf('": '),
      );
      const lastCompleteStructure = Math.max(
        result.lastIndexOf('},'),
        result.lastIndexOf('],'),
        result.lastIndexOf('}}'),
        result.lastIndexOf(']]'),
      );
      
      let truncatePos = Math.max(lastCompleteComma, lastCompleteBrace, lastCompleteStructure);
      
      if (truncatePos > 0) {
        // Find the actual end of the complete element
        if (result[truncatePos] === '"' || result[truncatePos] === '}' || result[truncatePos] === ']') {
          truncatePos++; // Include the closing character
        }
        result = result.substring(0, truncatePos);
      }
    }
    
    // Remove any trailing colon (incomplete property)
    result = result.replace(/,?\s*"[^"]+"\s*:\s*$/, '');
    
    return result;
  }

  /**
   * Safely parse JSON with fallback
   */
  static safeParse<T>(
    jsonStr: string,
    fallback: T,
    logger?: any,
  ): T {
    try {
      return this.repairAndParse<T>(jsonStr, logger);
    } catch (error: any) {
      if (logger) {
        logger.warn(`JSON parsing failed, using fallback: ${error.message}`);
      }
      return fallback;
    }
  }
}
