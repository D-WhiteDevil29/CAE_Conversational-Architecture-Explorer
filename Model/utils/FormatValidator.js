import jsyaml from 'js-yaml';
import { parseString, Builder } from 'xml2js';
import { parse as parseToml } from 'toml';
import papaparse from 'papaparse';

// Check if packages are available
let hasYaml = true, hasXml = true, hasToml = true, hasCsv = true;

try {
  // Test if imports work
} catch (e) {
  console.warn('Some formatting packages not installed. Install with: npm install js-yaml xml2js toml papaparse');
}

class FormatValidator {
  constructor(model = null) {
    this.model = model; // LLM for fixing complex issues
    this.formatters = {
      json: new JSONFormatter(),
      yaml: new YAMLFormatter(),
      xml: new XMLFormatter(),
      toml: new TOMLFormatter(),
      markdown: new MarkdownFormatter(),
      csv: new CSVFormatter(),
    };
  }

  /**
   * Convert data from one format to another
   */
  async convert(rawData, fromFormat, toFormat) {
    if (!rawData || rawData.trim().length === 0) {
      return {
        success: false,
        error: 'No data provided',
        converted: '',
        issues: [],
        explanation: 'Please provide data to convert',
      };
    }

    // Step 1: Parse the source format
    const sourceFormatter = this.formatters[fromFormat];
    if (!sourceFormatter) {
      return {
        success: false,
        error: `Source format '${fromFormat}' not supported`,
        converted: '',
        issues: [],
      };
    }

    const targetFormatter = this.formatters[toFormat];
    if (!targetFormatter) {
      return {
        success: false,
        error: `Target format '${toFormat}' not supported`,
        converted: '',
        issues: [],
      };
    }

    try {
      // Parse source data
      const parseResult = await sourceFormatter.parse(rawData);
      let parsedData;

      if (!parseResult.isValid && !parseResult.parsed) {
        // Try to extract parsed data from fix attempt
        if (fromFormat === 'json') {
          try {
            parsedData = JSON.parse(parseResult.formatted);
          } catch (e) {
            return {
              success: false,
              error: 'Could not parse source data',
              converted: '',
              issues: parseResult.errors,
            };
          }
        } else if (fromFormat === 'yaml') {
          try {
            parsedData = jsyaml.load(parseResult.formatted);
          } catch (e) {
            return {
              success: false,
              error: 'Could not parse source YAML',
              converted: '',
              issues: parseResult.errors,
            };
          }
        } else {
          return {
            success: false,
            error: `Cannot parse invalid ${fromFormat}`,
            converted: '',
            issues: parseResult.errors,
          };
        }
      } else {
        // Extract parsed data from the formatter
        if (fromFormat === 'json') {
          parsedData = JSON.parse(parseResult.formatted || rawData);
        } else if (fromFormat === 'yaml') {
          parsedData = jsyaml.load(parseResult.formatted || rawData);
        } else if (fromFormat === 'xml') {
          // For XML, we need special handling
          return await this.convertFromXml(rawData, toFormat);
        } else if (fromFormat === 'toml') {
          parsedData = parseToml(parseResult.formatted || rawData);
        } else if (fromFormat === 'csv') {
          parsedData = this.csvToJson(rawData);
        } else {
          return {
            success: false,
            error: `Cannot convert from ${fromFormat}`,
            converted: '',
            issues: [],
          };
        }
      }

      // Step 2: Convert to target format
      const converted = await this.convertToFormat(parsedData, toFormat);

      return {
        success: true,
        converted,
        issues: parseResult.errors || [],
        explanation: `✓ Successfully converted ${fromFormat.toUpperCase()} to ${toFormat.toUpperCase()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        converted: '',
        issues: [
          {
            line: 1,
            column: 1,
            message: error.message,
            type: 'conversion_error',
            severity: 'error',
          },
        ],
      };
    }
  }

  /**
   * Convert parsed data to target format
   */
  async convertToFormat(data, format) {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'yaml':
        return jsyaml.dump(data, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
        });
      case 'xml':
        return this.jsonToXml(data);
      case 'toml':
        return this.jsonTotoml(data);
      case 'csv':
        return this.jsonToCsv(data);
      default:
        throw new Error(`Cannot convert to ${format}`);
    }
  }

  /**
   * Convert XML to target format
   */
  async convertFromXml(xmlData, toFormat) {
    return new Promise((resolve) => {
      parseString(
        xmlData,
        { explicitArray: false, mergeAttrs: true, trim: true },
        (err, result) => {
          if (err) {
            resolve({
              success: false,
              error: 'Invalid XML: ' + err.message,
              converted: '',
              issues: [{ line: 1, column: 1, message: err.message }],
            });
          } else {
            this.convertToFormat(result, toFormat)
              .then((converted) => {
                resolve({
                  success: true,
                  converted,
                  issues: [],
                  explanation: `✓ Successfully converted XML to ${toFormat.toUpperCase()}`,
                });
              })
              .catch((error) => {
                resolve({
                  success: false,
                  error: error.message,
                  converted: '',
                  issues: [],
                });
              });
          }
        }
      );
    });
  }

  /**
   * JSON to XML conversion
   */
  jsonToXml(data) {
    const builder = new Builder({
      indent: '  ',
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      rootName: 'root',
    });
    return builder.buildObject(data);
  }

  /**
   * JSON to TOML conversion
   */
  jsonTotoml(data) {
    let result = '';
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        result += `\n[${key}]\n`;
        for (const [subKey, subValue] of Object.entries(value)) {
          result += `${subKey} = ${this.valueToToml(subValue)}\n`;
        }
      } else if (Array.isArray(value)) {
        result += `${key} = [${value
          .map((v) => this.valueToToml(v))
          .join(', ')}]\n`;
      } else {
        result += `${key} = ${this.valueToToml(value)}\n`;
      }
    }
    return result;
  }

  /**
   * JSON to CSV conversion
   */
  jsonToCsv(data) {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      let csv = headers.join(',') + '\n';
      
      for (const row of data) {
        const values = headers.map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csv += values.join(',') + '\n';
      }
      return csv;
    }
    // If not array, convert as single object
    return Object.entries(data)
      .map(([k, v]) => `${k},${v}`)
      .join('\n');
  }

  /**
   * CSV to JSON conversion
   */
  csvToJson(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const values = lines[i].split(',').map((v) => v.trim());
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j] || '';
      }
      result.push(obj);
    }
    return result;
  }

  /**
   * Convert value to TOML format
   */
  valueToToml(value) {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value === null) {
      return '""';
    }
    return String(value);
  }

  /**
   * Validate and format data - ALWAYS try to return formatted output
   */
  async validateAndFormat(rawData, formatType) {
    if (!rawData || rawData.trim().length === 0) {
      return {
        success: false,
        error: 'No data provided',
        formatted: '',
        issues: [],
        explanation: 'Please provide data to format',
      };
    }

    const formatter = this.formatters[formatType];
    if (!formatter) {
      return {
        success: false,
        error: `Format type '${formatType}' not supported`,
        formatted: '',
        issues: [],
        explanation: 'Supported formats: json, yaml, xml, toml, markdown, csv',
      };
    }

    try {
      // Step 1: Try parsing with library
      const parseResult = await formatter.parse(rawData);

      if (parseResult.isValid) {
        // Data is valid - return formatted
        return {
          success: true,
          formatted: parseResult.formatted,
          issues: [],
          explanation: `✓ Your ${formatType.toUpperCase()} is valid and properly formatted!`,
          demoMode: false,
        };
      }

      // Step 2: If parsing failed but we have a formatted version, return it WITH issues
      if (parseResult.formatted && parseResult.formatted.length > 0) {
        return {
          success: true, // Semi-success: formatted but with warnings
          formatted: parseResult.formatted,
          issues: parseResult.errors || [],
          explanation: this.generateExplanation(formatType, parseResult.errors),
          hasWarnings: true,
          demoMode: false,
        };
      }

      // Step 3: Try LLM fix (if model available)
      if (this.model && parseResult.errors.length > 0) {
        const llmResult = await this.fixWithLLM(
          rawData,
          formatType,
          parseResult.errors
        );
        return llmResult;
      }

      // Step 4: Return errors without formatted
      return {
        success: false,
        formatted: '',
        issues: parseResult.errors,
        explanation: this.generateExplanation(formatType, parseResult.errors),
        demoMode: !this.model,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        formatted: '',
        issues: [
          {
            line: 1,
            column: 1,
            message: error.message,
            type: 'syntax_error',
            severity: 'error',
          },
        ],
        explanation: `Error: ${error.message}`,
        demoMode: false,
      };
    }
  }

  /**
   * Use LLM to fix malformed data
   */
  async fixWithLLM(rawData, formatType, detectedErrors) {
    const errorList = detectedErrors
      .slice(0, 5)
      .map(
        (e) =>
          `• Line ${e.line}${e.column ? `, Col ${e.column}` : ''}: ${e.message}`
      )
      .join('\n');

    const prompt = `You are a ${formatType.toUpperCase()} expert formatter.

User provided malformed ${formatType.toUpperCase()} with these errors:
${errorList}

MALFORMED DATA:
\`\`\`${formatType}
${rawData}
\`\`\`

Your task:
1. Fix ALL formatting issues
2. Return ONLY the corrected ${formatType.toUpperCase()} code block
3. Do NOT add explanations or comments
4. Maintain ALL original user data
5. Use 2-space indentation
6. Wrap in triple backticks

Return format:
\`\`\`${formatType}
[CORRECTED DATA HERE]
\`\`\``;

    try {
      let llmResponse = '';

      if (this.model && this.model.prompt) {
        llmResponse = await this.model.prompt(prompt, {
          maxTokens: 3000,
          temperature: 0.1, // Very low for deterministic formatting
        });
      } else {
        // If no model, return error
        return {
          success: false,
          formatted: '',
          issues: detectedErrors,
          explanation:
            'Could not auto-fix: LLM model not available. Please correct the errors manually.',
          demoMode: true,
        };
      }

      // Extract formatted code from response
      const formatted = this.extractFormattedCode(llmResponse, formatType);

      if (!formatted) {
        throw new Error('LLM did not return properly formatted data');
      }

      // Validate the formatted output
      const validator = this.formatters[formatType];
      const validateResult = await validator.parse(formatted);

      return {
        success: validateResult.isValid,
        formatted: validateResult.isValid ? formatted : llmResponse,
        issues: detectedErrors,
        explanation: `✓ Fixed ${detectedErrors.length} formatting issue(s). Your data is now valid.`,
        demoMode: false,
      };
    } catch (error) {
      return {
        success: false,
        formatted: '',
        issues: detectedErrors,
        explanation: `Auto-fix failed: ${error.message}. Please correct the errors manually.`,
        demoMode: false,
      };
    }
  }

  /**
   * Extract formatted code from LLM response
   */
  extractFormattedCode(response, formatType) {
    // Look for code block
    const codeBlockRegex = /```[\w]*\n?([\s\S]*?)\n?```/;
    const match = response.match(codeBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // If no code block, return first substantial part
    const lines = response.split('\n').filter((l) => l.trim());
    if (lines.length > 0) {
      return lines.join('\n');
    }

    return response.trim();
  }

  /**
   * Generate user-friendly explanation
   */
  generateExplanation(formatType, errors) {
    if (errors.length === 0) {
      return `✓ Your ${formatType.toUpperCase()} is valid!`;
    }

    const uniqueIssues = [...new Set(errors.map((e) => e.type))];
    const summary = errors
      .slice(0, 3)
      .map((e) => `• Line ${e.line}: ${e.message}`)
      .join('\n');

    return `Found ${errors.length} formatting issue(s):\n${summary}${
      errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''
    }`;
  }
}

/**
 * JSON Formatter
 */
class JSONFormatter {
  async parse(data) {
    try {
      const parsed = JSON.parse(data);
      const formatted = JSON.stringify(parsed, null, 2);
      return { isValid: true, formatted };
    } catch (error) {
      // Try to fix common JSON errors and return partial formatted
      const line = this.getLineNumber(error.message, data);
      const formatted = this.attemptPartialFix(data);
      
      return {
        isValid: false,
        formatted, // Return attempted fix
        errors: [
          {
            line,
            column: 1,
            message: this.cleanErrorMessage(error.message),
            type: 'json_syntax_error',
            severity: 'error',
          },
        ],
      };
    }
  }

  /**
   * Attempt to fix common JSON issues
   */
  attemptPartialFix(data) {
    let fixed = data;

    // Fix: Single quotes to double quotes (single-quoted strings)
    fixed = fixed.replace(/'([^']*?)'/g, '"$1"');

    // Fix: Unquoted keys
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

    // Fix: Trailing commas before ] or }
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Try to parse and format
    try {
      const parsed = JSON.parse(fixed);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Try more aggressive fixes
      try {
        // Remove any remaining unquoted values that look like bare strings
        fixed = fixed.replace(/:\s*([a-zA-Z_]\w*)(?=[,}\]])/g, ': "$1"');
        
        const parsed = JSON.parse(fixed);
        return JSON.stringify(parsed, null, 2);
      } catch (e2) {
        // Return the best we could do
        return fixed;
      }
    }
  }

  getLineNumber(errorMsg, data) {
    const match = data.match(/Unexpected token .* in JSON at position (\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      return data.substring(0, position).split('\n').length;
    }
    return 1;
  }

  cleanErrorMessage(msg) {
    return msg
      .replace(/Unexpected token .* in JSON at position \d+/, 'Invalid JSON syntax')
      .replace('Unexpected character', 'Invalid character')
      .replace(/\(in |(\d+)\)/g, '');
  }
}

/**
 * YAML Formatter
 */
class YAMLFormatter {
  async parse(data) {
    try {
      const parsed = jsyaml.load(data);
      const formatted = jsyaml.dump(parsed, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });
      return { isValid: true, formatted };
    } catch (error) {
      // Try with lenient parsing
      const fixed = this.attemptPartialFix(data);
      try {
        const parsed = jsyaml.load(fixed);
        const formatted = jsyaml.dump(parsed, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
        });
        
        return {
          isValid: false,
          formatted,
          errors: [
            {
              line: error.mark?.line + 1 || 1,
              column: error.mark?.column + 1 || 1,
              message: error.reason || error.message,
              type: 'yaml_syntax_error',
              severity: 'warning',
            },
          ],
        };
      } catch (fixError) {
        // Even if parsing fixed version fails, return the fixed data as formatted
        return {
          isValid: false,
          formatted: fixed, // Return fixed attempt as formatted
          errors: [
            {
              line: error.mark?.line + 1 || 1,
              column: error.mark?.column + 1 || 1,
              message: error.reason || error.message,
              type: 'yaml_syntax_error',
              severity: 'warning',
            },
          ],
        };
      }
    }
  }

  /**
   * Attempt to fix common YAML issues
   */
  attemptPartialFix(data) {
    let fixed = data;

    // Convert tabs to spaces
    fixed = fixed.replace(/\t/g, '  ');

    // Fix inconsistent indentation in YAML lists
    const lines = fixed.split('\n');
    const result = [];
    let listIndent = null;
    let expectedIndent = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const leadingSpaces = line.search(/\S/);
      
      if (leadingSpaces === -1) {
        // Empty line
        result.push(line);
        continue;
      }

      // Check if this is a list item
      if (line.trim().startsWith('-')) {
        listIndent = leadingSpaces;
        result.push(line);
      } else if (listIndent !== null && leadingSpaces <= listIndent) {
        // New key at same or less level than list
        listIndent = null;
        result.push(line);
      } else if (listIndent !== null && leadingSpaces > listIndent) {
        // This is content under a list item
        if (expectedIndent === null) {
          expectedIndent = leadingSpaces;
        }
        // Normalize to expected indent (listIndent + 2)
        const targetIndent = listIndent + 2;
        if (leadingSpaces !== targetIndent) {
          const trimmedLine = line.trim();
          result.push(' '.repeat(targetIndent) + trimmedLine);
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }
}

/**
 * XML Formatter
 */
class XMLFormatter {
  async parse(data) {
    return new Promise((resolve) => {
      const options = {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      };

      parseString(data, options, (err, result) => {
        if (err) {
          // Attempt partial fix
          const fixed = this.attemptPartialFix(data);
          
          parseString(fixed, options, (fixErr, fixResult) => {
            try {
              const builder = new Builder({
                indent: '  ',
                xmldec: { version: '1.0', encoding: 'UTF-8' },
              });
              
              // Get formatted output from fixed parse result
              const formatted = !fixErr ? builder.buildObject(fixResult) : this.formatRawXML(fixed);
              
              resolve({
                isValid: false,
                formatted, // ALWAYS return formatted (fixed data)
                errors: [
                  {
                    line: this.extractLineNumber(err.message),
                    column: 1,
                    message: err.message.split('\n')[0],
                    type: 'xml_parse_error',
                    severity: 'warning',
                  },
                ],
              });
            } catch (buildErr) {
              // Even if building fails, return the fixed/formatted data
              resolve({
                isValid: false,
                formatted: this.formatRawXML(fixed), // Return fixed data as formatted
                errors: [
                  {
                    line: this.extractLineNumber(err.message),
                    column: 1,
                    message: err.message.split('\n')[0],
                    type: 'xml_parse_error',
                    severity: 'warning',
                  },
                ],
              });
            }
          });
        } else {
          try {
            const builder = new Builder({
              indent: '  ',
              xmldec: { version: '1.0', encoding: 'UTF-8' },
            });
            const formatted = builder.buildObject(result);
            resolve({ isValid: true, formatted });
          } catch (buildErr) {
            // If building fails on valid parse, still return raw with formatting
            resolve({
              isValid: false,
              formatted: this.formatRawXML(data),
              errors: [
                {
                  line: 1,
                  column: 1,
                  message: buildErr.message,
                  type: 'xml_format_error',
                  severity: 'warning',
                },
              ],
            });
          }
        }
      });
    });
  }

  attemptPartialFix(data) {
    let fixed = data;

    // Fix entity encoding - ensure all & are properly encoded
    fixed = fixed.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;');

    // Fix: Extract tag names and balance them
    const tagStack = [];
    const openTagRegex = /<(\w+)(?:\s[^>]*)?>|<\/(\w+)>|<\w+\s[^>]*\/>/g;
    let match;

    while ((match = openTagRegex.exec(fixed)) !== null) {
      if (match[1]) {
        // Opening tag
        tagStack.push(match[1]);
      } else if (match[2]) {
        // Closing tag
        const closingTag = match[2];
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === closingTag) {
          tagStack.pop();
        } else {
          // Unmatched closing tag - remove it
          fixed = fixed.replace(new RegExp(`</\\s*${closingTag}\\s*>`, 'g'), '');
        }
      }
    }

    // Close any remaining unclosed tags
    while (tagStack.length > 0) {
      const tag = tagStack.pop();
      fixed = fixed + `</${tag}>`;
    }

    return fixed;
  }

  formatRawXML(data) {
    // General XML beautification without full parsing
    let formatted = data;
    let indentLevel = 0;
    const indent = '  ';

    // Add line breaks after tags
    formatted = formatted.replace(/></g, '>\n<');
    formatted = formatted.replace(/>\s+</g, '>\n<');

    const lines = formatted.split('\n');
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if closing tag
      if (trimmed.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      result.push(indent.repeat(indentLevel) + trimmed);

      // Check if opening tag (and not self-closing)
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
        indentLevel++;
      }
    }

    return result.join('\n');
  }

  extractLineNumber(message) {
    const match = message.match(/Line (\d+)/);
    return match ? parseInt(match[1]) : 1;
  }
}

/**
 * TOML Formatter
 */
class TOMLFormatter {
  async parse(data) {
    try {
      const parsed = parseToml(data);
      const formatted = this.toTOML(parsed);
      return { isValid: true, formatted };
    } catch (error) {
      // Try to fix common TOML issues
      const fixed = this.attemptPartialFix(data);
      try {
        const parsed = parseToml(fixed);
        const formatted = this.toTOML(parsed);
        
        return {
          isValid: false,
          formatted, // Return fixed+formatted
          errors: [
            {
              line: 1,
              column: 1,
              message: error.message || 'Invalid TOML syntax',
              type: 'toml_syntax_error',
              severity: 'warning',
            },
          ],
        };
      } catch (fixError) {
        // Even if partial fix fails to parse, return formatted fixed data
        return {
          isValid: false,
          formatted: fixed, // Return the fixed attempt as formatted
          errors: [
            {
              line: 1,
              column: 1,
              message: error.message || 'Invalid TOML syntax',
              type: 'toml_syntax_error',
              severity: 'warning',
            },
          ],
        };
      }
    }
  }

  attemptPartialFix(data) {
    let fixed = data;
    // Add quotes to unquoted strings
    fixed = fixed.replace(/([^=\s])\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g, '$1 = "$2"');
    return fixed;
  }

  toTOML(obj, indent = '') {
    let result = '';
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        result += `\n${indent}[${key}]\n`;
        result += this.toTOML(value, indent + '  ');
      } else if (Array.isArray(value)) {
        result += `${key} = [${value
          .map((v) => (typeof v === 'string' ? `"${v}"` : v))
          .join(', ')}]\n`;
      } else if (typeof value === 'string') {
        result += `${key} = "${value}"\n`;
      } else {
        result += `${key} = ${value}\n`;
      }
    }
    return result;
  }
}

/**
 * Markdown Formatter
 */
class MarkdownFormatter {
  async parse(data) {
    // Basic markdown validation
    const issues = this.validateMarkdown(data);

    // Always format the markdown
    const formatted = this.formatMarkdown(data);

    return {
      isValid: issues.length === 0,
      formatted, // Always return formatted
      errors: issues,
    };
  }

  validateMarkdown(data) {
    const issues = [];
    const lines = data.split('\n');

    // Check for unclosed code blocks
    const codeBlocks = data.match(/```/g) || [];
    if (codeBlocks.length % 2 !== 0) {
      issues.push({
        line: lines.length,
        column: 1,
        message: 'Unclosed code block (```)',
        type: 'markdown_code_block_error',
        severity: 'error',
      });
    }

    // Check for unmatched brackets
    const brackets = { '[': ']', '{': '}', '(': ')' };
    for (const [open, close] of Object.entries(brackets)) {
      const openCount = (data.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closeCount = (data.match(new RegExp(`\\${close}`, 'g')) || []).length;
      if (openCount !== closeCount) {
        issues.push({
          line: 1,
          column: 1,
          message: `Unmatched ${open}/${close} brackets (${openCount} open, ${closeCount} close)`,
          type: 'markdown_bracket_error',
          severity: 'warning',
        });
      }
    }

    return issues;
  }

  formatMarkdown(data) {
    return data
      .split('\n')
      .map((line) => {
        // Ensure proper spacing after headers
        if (line.match(/^#+(?! )/)) {
          return line.replace(/^(#+)/, '$1 ');
        }
        return line;
      })
      .join('\n');
  }
}

/**
 * CSV Formatter
 */
class CSVFormatter {
  async parse(data) {
    try {
      const lines = data.split('\n').filter((l) => l.trim());

      if (lines.length === 0) {
        return { isValid: false, formatted: '', errors: [{ line: 1, message: 'Empty CSV' }] };
      }

      // Count columns in first line
      const firstLineColumns = this.countColumns(lines[0]);
      const issues = [];

      // Check each line has same column count
      lines.forEach((line, idx) => {
        const cols = this.countColumns(line);
        if (cols !== firstLineColumns) {
          issues.push({
            line: idx + 1,
            column: 1,
            message: `Expected ${firstLineColumns} columns, got ${cols}`,
            type: 'csv_column_mismatch',
            severity: 'warning',
          });
        }
      });

      const formatted = lines.join('\n');

      return {
        isValid: issues.length === 0,
        formatted, // Always return formatted
        errors: issues,
      };
    } catch (error) {
      return {
        isValid: false,
        formatted: '',
        errors: [
          {
            line: 1,
            column: 1,
            message: error.message,
            type: 'csv_parse_error',
            severity: 'error',
          },
        ],
      };
    }
  }

  countColumns(line) {
    let inQuotes = false;
    let count = 1;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        count++;
      }
    }
    return count;
  }
}

export default FormatValidator;
