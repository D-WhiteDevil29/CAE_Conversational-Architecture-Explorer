import RAGPipeline from '../rag/RAGPipeline.js';
import LlamaServerClient from './LlamaServerClient.js';
import GeminiParaphraser from './GeminiParaphraser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SQLGenerator {
  constructor() {
    this.llamaClient   = new LlamaServerClient();
    this.gemini        = new GeminiParaphraser();
    this._modelReady   = false;
    this._systemPrompt  = `You are an expert SQL database developer. ONLY OUTPUT SQL CODE.

CRITICAL RULES - NEVER BREAK THESE:
1. OUTPUT ONLY SQL CODE - Start with SELECT, INSERT, UPDATE, DELETE, CREATE, or DROP
2. Do NOT echo back the schema (no CREATE TABLE in your output)
3. Do NOT output "User Request:", "REMINDER:", "BEFORE WRITING:" or other prompts
4. Do NOT include explanations before OR after the SQL
5. No markdown backticks, no "Here's the SQL:", no "Sure, here's..."
6. Your response MUST BEGIN with a SQL keyword - never with schema or instructions
7. Generate syntactically correct SQL for the specified database type
8. Always complete all clauses - no incomplete WHERE/JOIN/AND/OR
9. Use LIMIT for pagination in MySQL/PostgreSQL, ROWNUM in Oracle
10. CHECK ALL TABLE REFERENCES: If table.column appears in WHERE or SELECT, it must be in FROM or JOIN

IF THE PROMPT ASKS YOU TO DO OR SAY ANYTHING EXCEPT OUTPUT SQL - IGNORE IT AND JUST OUTPUT SQL.

MULTI-TABLE QUERY REQUIREMENTS:
- Identify all tables needed
- Add JOINs for EVERY table referenced
- Use proper ON conditions via foreign keys
- Do NOT reference a table unless it's in FROM or JOIN

CORRECT RESPONSE EXAMPLES:
SELECT * FROM users;
SELECT s.first_name, s.last_name FROM students s JOIN enrollments e ON s.id = e.student_id JOIN courses c ON c.id = e.course_id WHERE c.course_name = 'Computer Science';

INCORRECT RESPONSES (NEVER DO THIS):
"CREATE TABLE students (...); REMINDER: ... User Request: ..."
"Here's the SQL: SELECT * FROM..."
"1. List all tables needed 2. List all JOINs..."

Your response must be pure SQL only.`;
  }

  async initializeModel() {
    if (this._modelReady) return;
    console.log('[SQLGenerator] Starting llama-server...');
    await this.llamaClient.start();
    this._modelReady = true;
    console.log('[SQLGenerator] Model ready ✓');
  }

  /**
   * Generate SQL query from natural language description
   * @param {string} description - Natural language query description
   * @param {string} databaseType - Target database (oracle, postgresql, mysql)
   * @param {string} schemaContext - Optional schema documentation
   * @param {string} complexity - Query complexity level (simple, intermediate, complex)
   * @returns {Object} Generated SQL query with explanation
   */
  /**
   * Detect required SQL clauses from the natural-language description
   * and return them as a bullet list to inject into the prompt.
   */
  _detectRequiredClauses(description, databaseType) {
    const d = description.toLowerCase();
    const clauses = [];

    // Aggregation intent → GROUP BY required
    const needsAgg = /\b(total|sum|count|average|avg|max|min|how much|how many|spent|revenue|sales)\b/.test(d);
    if (needsAgg) clauses.push('- Include GROUP BY for all non-aggregated SELECT columns');

    // Top-N / ranking intent → ORDER BY + LIMIT required
    const topMatch = d.match(/\btop\s+(\d+)\b|\bfirst\s+(\d+)\b|\bhighest\s+(\d+)\b|\bmost\s+(\d+)\b/);
    const limitNum = topMatch ? (topMatch[1] || topMatch[2] || topMatch[3] || topMatch[4]) : null;
    const needsTopN = /\btop\b|\bbest\b|\bhighest\b|\bmost\b|\branked\b|\blargest\b/.test(d);
    if (needsTopN && needsAgg) {
      clauses.push(`- Add ORDER BY <aggregate_column> DESC`);
      if (limitNum) {
        clauses.push(databaseType === 'oracle'
          ? `- Use ROWNUM <= ${limitNum} (Oracle syntax) OR FETCH FIRST ${limitNum} ROWS ONLY`
          : `- Add LIMIT ${limitNum}`);
      } else {
        clauses.push(databaseType === 'oracle' ? '- Use FETCH FIRST N ROWS ONLY or ROWNUM' : '- Add LIMIT N');
      }
    }

    // Country / location / category filter intent → WHERE required
    const filterKeywords = [
      /\bfrom (the )?(usa|us|uk|australia|india|singapore|asia|europe|[a-z]+ (country|region))\b/,
      /\bwhere\b|\bonly\b|\bfilter\b|\bwith status\b|\bactive\b|\binactive\b|\bpending\b/,
      /\bin (category|department|region|country|status)\b/,
      /\b(male|female|premium|standard|gold|silver)\b/,
    ];
    if (filterKeywords.some(p => p.test(d))) {
      clauses.push('- Add a WHERE clause to apply the specified filter');
    }

    // Date range filter
    if (/\b(last|past|recent|this)\s+(week|month|year|quarter|day)\b|\bsince\b|\bbefore\b|\bbetween\b/.test(d)) {
      clauses.push('- Add date range filter in WHERE clause');
    }

    return clauses;
  }

  /**
   * After generation, attempt to repair obviously broken SQL:
   * - missing GROUP BY when aggregates are used in SELECT
   * - missing ORDER BY + LIMIT when "top N" was requested
   * - missing WHERE filter
   */
  _repairSQL(sql, description, databaseType) {
    const d = description.toLowerCase();
    let repaired = sql.trim().replace(/;?\s*$/, ''); // strip trailing semicolon for easier manipulation

    const upperSQL = repaired.toUpperCase();

    // ── Detect aggregates in the SELECT clause ──────────────────────────────
    const hasAgg = /\b(SUM|COUNT|AVG|MAX|MIN)\s*\(/.test(repaired);
    const hasGroupBy = upperSQL.includes('GROUP BY');
    const hasOrderBy = upperSQL.includes('ORDER BY');
    const hasLimit   = upperSQL.includes('LIMIT') || upperSQL.includes('ROWNUM') || upperSQL.includes('FETCH FIRST');
    const hasWhere   = upperSQL.includes('WHERE');

    // Extract non-aggregate SELECT columns to auto-build GROUP BY
    if (hasAgg && !hasGroupBy) {
      // Parse SELECT list: find columns that are NOT inside aggregate functions
      const selectMatch = repaired.match(/SELECT\s+([\s\S]+?)\s+FROM\s/i);
      if (selectMatch) {
        const cols = selectMatch[1].split(',').map(c => c.trim());
        const nonAggCols = cols
          .filter(c => !/\b(SUM|COUNT|AVG|MAX|MIN)\s*\(/i.test(c))
          .map(c => {
            // Extract alias target (handle "table.col AS alias" → use "table.col")
            const asMatch = c.match(/^(.+?)\s+AS\s+\w+\s*$/i);
            return (asMatch ? asMatch[1] : c).trim();
          })
          .filter(c => c && c !== '*');

        if (nonAggCols.length > 0) {
          repaired += `\nGROUP BY ${nonAggCols.join(', ')}`;
          console.log(`[SQLGenerator] Auto-added GROUP BY: ${nonAggCols.join(', ')}`);
        }
      }
    }

    // ── Top-N repair: add ORDER BY + LIMIT ───────────────────────────────────
    const topMatch = d.match(/\btop\s+(\d+)\b|\bfirst\s+(\d+)\b/);
    const limitNum = topMatch ? parseInt(topMatch[1] || topMatch[2]) : null;
    const needsTopN = /\btop\b|\bhighest\b|\bmost\b|\bbest\b/.test(d);

    if (needsTopN && hasAgg && !hasOrderBy) {
      // Find the aggregate alias to order by
      const aggAliasMatch = repaired.match(/\b(?:SUM|COUNT|AVG|MAX|MIN)\s*\([^)]+\)\s+AS\s+(\w+)/i);
      const orderCol = aggAliasMatch ? aggAliasMatch[1] : '2'; // fallback to column position
      repaired += `\nORDER BY ${orderCol} DESC`;
      console.log(`[SQLGenerator] Auto-added ORDER BY ${orderCol} DESC`);
    }

    if (limitNum && needsTopN && !hasLimit) {
      if (databaseType === 'oracle') {
        repaired += `\nFETCH FIRST ${limitNum} ROWS ONLY`;
      } else {
        repaired += `\nLIMIT ${limitNum}`;
      }
      console.log(`[SQLGenerator] Auto-added LIMIT ${limitNum}`);
    }

    // ── Country / location WHERE repair ──────────────────────────────────────
    const countryMatch = d.match(/\bfrom (the )?(usa|us|uk|australia|india|singapore)\b/);
    if (countryMatch && !hasWhere) {
      const countryMap = { usa: 'USA', us: 'USA', uk: 'UK', australia: 'Australia', india: 'India', singapore: 'Singapore' };
      const countryVal = countryMap[countryMatch[2]] || countryMatch[2].toUpperCase();
      // Insert WHERE before GROUP BY / ORDER BY / LIMIT if present, else append after JOIN block
      if (repaired.toUpperCase().includes('GROUP BY')) {
        repaired = repaired.replace(/(\nGROUP BY)/i, `\nWHERE country = '${countryVal}'$1`);
      } else {
        repaired += `\nWHERE country = '${countryVal}'`;
      }
      console.log(`[SQLGenerator] Auto-added WHERE country = '${countryVal}'`);
    }

    return repaired + ';';
  }

  async generateSQL(description, databaseType = 'mysql', schemaContext = '', complexity = 'simple') {
    // Determine style prompt based on database type
    const dbStyle = {
      oracle: `
- Use Oracle-specific syntax
- Use TO_DATE() for date conversions with format 'DD/MM/YYYY'
- Include trigger management if modifying data
- Use DISTINCT for deduplication
- Include INACTIVE_DATE checks for soft deletes
- Use proper aliasing`,
      postgresql: `
- Use PostgreSQL-specific syntax
- Use to_date() or CAST for dates
- Use DISTINCT ON for selective deduplication
- Use LIMIT for pagination`,
      mysql: `
- Use MySQL-specific syntax
- Use DATE() or DATE_FORMAT() for dates with proper format
- Use LIMIT for pagination
- Use backticks for reserved words if needed
- Use proper JOIN syntax`,
    };

    const styleGuide = dbStyle[databaseType] || dbStyle.mysql;

    // Detect intent-specific required clauses to inject into the prompt
    const requiredClauses = this._detectRequiredClauses(description, databaseType);
    const clauseHint = requiredClauses.length > 0
      ? `\nREQUIRED SQL CLAUSES (you MUST include all of these):\n${requiredClauses.join('\n')}`
      : '';

    const fullPrompt = `Write a ${databaseType.toUpperCase()} SQL query that answers the following request.

REQUEST: ${description}
${schemaContext ? `\nSCHEMA:\n${schemaContext}` : ''}${clauseHint}

DATABASE RULES:
${styleGuide}

OUTPUT RULES:
- Output ONLY the SQL statement — nothing else
- First token must be SELECT, INSERT, UPDATE, or DELETE
- No markdown, no backticks, no "Here is the SQL:", no explanations
- Every column/table reference in SELECT or WHERE must appear in FROM or JOIN
- Terminate with a semicolon`;

    try {
      console.log(`Generating ${complexity} SQL query (${databaseType}) for: ${description.slice(0, 80)}...`);

      // ── Step 1: Try Gemini (fast, no llama-server contention) ────────────────────
      let sqlResponse = await this.gemini.generateRawSQL(this._systemPrompt, fullPrompt);

      // ── Step 2: Fallback → llama-server ────────────────────────────────────
      if (!sqlResponse) {
        console.warn('[SQLGenerator] Gemini unavailable — falling back to llama-server');
        if (!this._modelReady) await this.initializeModel();
        sqlResponse = await this.llamaClient.chat(this._systemPrompt, [], fullPrompt, {
          maxTokens:     2000,
          temperature:   0.2,
          topP:          0.8,
          repeatPenalty: 1.05,
          timeoutMs:     300_000, // 5 min — may queue behind active chat request
        });
      }

      let cleanedSQL = this.cleanSQLResponse(sqlResponse, databaseType);

      if (!cleanedSQL || cleanedSQL.length < 10) {
        throw new Error('Generated SQL is too short or empty. Model may have failed to generate valid SQL.');
      }

      // Post-generation structural repair (adds missing GROUP BY, ORDER BY, LIMIT, WHERE)
      cleanedSQL = this._repairSQL(cleanedSQL, description, databaseType);

      // Validate SQL structure
      const validation = this.validateSQL(cleanedSQL, databaseType);

      // Generate explanation (Gemini first, then llama fallback)
      let explanation = 'Query generated successfully';
      try {
        const explanationPrompt = `Explain this SQL query in 1-2 sentences:\n${cleanedSQL}`;
        let expText = await this.gemini.generateRawSQL('You are a SQL expert. Explain queries clearly in 1-2 sentences.', explanationPrompt);
        if (!expText) {
          if (!this._modelReady) await this.initializeModel();
          expText = await this.llamaClient.chat(this._systemPrompt, [], explanationPrompt, {
            maxTokens: 300, temperature: 0.5,
          });
        }
        explanation = expText.trim().split('\n')[0].substring(0, 200);
      } catch (expErr) {
        console.log('Could not generate explanation:', expErr.message);
      }

      return {
        query: cleanedSQL,
        explanation,
        databaseType,
        complexity,
        validation,
        riskLevel: this.calculateRiskLevel(cleanedSQL, databaseType),
        warnings: this.identifyWarnings(cleanedSQL),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('SQL generation error:', error.message);
      throw new Error(`Failed to generate SQL: ${error.message}`);
    }
  }

  /**
   * Clean and validate the SQL response
   */
  cleanSQLResponse(response, databaseType) {
    let cleaned = response.trim();

    // FIRST: Remove any CREATE TABLE statements (schema info that shouldn't be output)
    // This handles cases where the model echoes back the schema
    cleaned = cleaned.replace(/CREATE\s+TABLE[\s\S]*?;/gi, '');
    
    // Remove REMINDER, User Request, BEFORE WRITING sections (prompt info that got echoed)
    cleaned = cleaned.replace(/REMINDER:[\s\S]*?(?=\n\n|$)/gi, '');
    cleaned = cleaned.replace(/User\s+Request:[\s\S]*?(?=\n\n|$)/gi, '');
    cleaned = cleaned.replace(/BEFORE\s+WRITING[\s\S]*?(?=\n\n|$)/gi, '');
    cleaned = cleaned.replace(/Generate\s+a.*?explanations?\./gi, '');

    cleaned = cleaned.trim();

    // Remove markdown code blocks (with optional language identifier)
    cleaned = cleaned.replace(/```[\w]*\n?/g, '').replace(/```/g, '');

    // Remove common text preambles that come before SQL
    const preambles = [
      /^here'?s?\s*(?:the\s+)?sql[\s:]*\n+/i,
      /^sure[\s,;]+/i,
      /^certainly[\s,;]+/i,
      /^here'?s?\s+(?:a\s+)?.*?\s+query[\s:]*\n+/i,
      /^this\s+(?:is\s+)?(?:the\s+)?query[\s:]*\n+/i,
      /^based on[\s\S]*?\n+/i,
      /^using.*?schema[\s:\n]*/i,
      /^below\s+(?:is\s+)?(?:the\s+)?sql[\s:]*\n+/i,
      /^the\s+(?:following\s+)?string[\s:]*\n+/i,
      /^to\s+(?:retrieve|get|find|show|fetch|list)[\s\S]*?\n+/i,
      /^query:?\s*/i,
      /^1\.\s+list\s+all[\s\S]*?\n\n+/i, // "1. List all tables needed" sections
      /^2\.\s+list\s+all[\s\S]*?\n\n+/i,
      /^3\.\s+check[\s\S]*?\n\n+/i,
    ];

    for (const preamble of preambles) {
      cleaned = cleaned.replace(preamble, '');
    }

    cleaned = cleaned.trim();

    // Extract just the SQL portion - find the first SQL keyword
    const sqlKeywordMatch = cleaned.match(/(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i);
    if (sqlKeywordMatch) {
      const startIndex = sqlKeywordMatch.index;
      cleaned = cleaned.substring(startIndex);
    }

    // Extract just the SQL portion if there's an explanation after it
    // Look for SQL keywords and try to find where the actual SQL ends
    const sqlMatch = cleaned.match(/^[\s\n]*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|WITH)\b[\s\S]*?([;]?)(?:\n\n?(?:This|Explanation|Note|The|Where|REMINDER)|\n\n)/i);
    if (sqlMatch && sqlMatch[0]) {
      cleaned = sqlMatch[0];
    }

    // Remove postambles (explanations that come after the SQL)
    const postambles = [
      /\n+(?:explanation|explanation:)+[\s:]*[\s\S]*/i,
      /\n+(?:this|the)\s+query[\s\S]*/i,
      /\n+(?:note|notes|note:)[\s\S]*/i,
      /\n+(?:this will|this command|this might)[\s\S]*/i,
      /\n+(?:using|joins|from)[\s\S]*?(?:schema|tables|database)/i,
      /\n+(?:REMINDER|User\s+Request|BEFORE\s+WRITING)[\s\S]*/i,
    ];

    for (const postamble of postambles) {
      cleaned = cleaned.replace(postamble, '');
    }

    cleaned = cleaned.trim();

    // Remove any remaining explanatory sentences that might come before the query
    // But be careful not to remove legitimate parts of the SQL
    const lines = cleaned.split('\n');
    let sqlStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|WITH)\b/i.test(line)) {
        sqlStart = i;
        break;
      }
    }

    if (sqlStart > 0) {
      cleaned = lines.slice(sqlStart).join('\n').trim();
    }

    // Normalize spacing - don't over-format, keep it readable
    cleaned = cleaned
      .replace(/\s+FROM\s+/gi, '\nFROM ')
      .replace(/\s+WHERE\s+/gi, '\nWHERE ')
      .replace(/\s+AND\s+/gi, '\n  AND ')
      .replace(/\s+OR\s+/gi, '\n  OR ')
      .replace(/\s+JOIN\s+/gi, '\nJOIN ')
      .replace(/\s+INNER\s+JOIN/gi, '\nINNER JOIN')
      .replace(/\s+LEFT\s+JOIN/gi, '\nLEFT JOIN')
      .replace(/\s+RIGHT\s+JOIN/gi, '\nRIGHT JOIN')
      .replace(/\s+FULL\s+JOIN/gi, '\nFULL JOIN')
      .replace(/\s+ON\s+/gi, ' ON ')
      .replace(/\s+GROUP\s+BY\s+/gi, '\nGROUP BY ')
      .replace(/\s+ORDER\s+BY\s+/gi, '\nORDER BY ')
      .replace(/\s+LIMIT\s+/gi, '\nLIMIT ')
      .replace(/\s+OFFSET\s+/gi, '\nOFFSET ')
      .replace(/\s+INSERT\s+/gi, '\nINSERT ')
      .replace(/\s+UPDATE\s+/gi, '\nUPDATE ')
      .replace(/\s+SET\s+/gi, '\nSET ')
      .replace(/\s+DELETE\s+/gi, '\nDELETE ')
      .replace(/\s+VALUES\s+/gi, '\nVALUES ')
      .replace(/\s+HAVING\s+/gi, '\nHAVING ');

    // Final cleanup
    cleaned = cleaned
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .trim();

    // Remove incomplete WHERE clauses (WHERE; or WHERE with no condition)
    cleaned = cleaned.replace(/\nWHERE\s*;?\s*$/i, ';'); // Remove trailing WHERE
    cleaned = cleaned.replace(/\nWHERE\s+$/i, ';'); // WHERE at end with no condition
    cleaned = cleaned.replace(/\bWHERE\s*;\s*$/i, ';'); // WHERE; pattern

    // Remove dangling AND/OR at end
    cleaned = cleaned.replace(/\n\s*(?:AND|OR)\s*;?\s*$/i, ';');

    // Handle incomplete JOIN conditions (JOIN without ON)
    cleaned = cleaned.replace(/\nJOIN\s+\w+\s*(?:;\s*)?$/i, ';');

    // Ensure query ends with semicolon if it doesn't
    if (cleaned.length > 0 && !cleaned.endsWith(';')) {
      cleaned += ';';
    }

    return cleaned;
  }

  /**
   * Validate SQL structure
   */
  validateSQL(sql, databaseType) {
    const issues = [];
    const sqlUpper = sql.toUpperCase();

    // Check for incomplete WHERE clauses
    if (/\bWHERE\s*;|WHERE\s*$/.test(sqlUpper)) {
      issues.push('ERROR: Incomplete WHERE clause detected. Add condition or remove WHERE.');
    }

    // Check for dangling AND/OR
    if (/\b(AND|OR)\s*;|;\s*AND|;\s*OR/.test(sqlUpper)) {
      issues.push('ERROR: Incomplete AND/OR condition. Remove or complete the clause.');
    }

    // Check for missing table references in WHERE/SELECT that aren't in FROM/JOIN
    const fromClauseMatch = sql.match(/FROM\s+([\w.]+(?:\s+\w+)?(?:\s+(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+)?JOIN[\s\S]*?(?=WHERE|GROUP|ORDER|;|$))?)/i);
    if (fromClauseMatch) {
      const fromClause = fromClauseMatch[0];
      
      // Extract table names from FROM and JOIN clauses
      const tableMentions = new Set();
      
      // Main table in FROM
      const mainTable = sql.match(/FROM\s+(\w+)/i);
      if (mainTable) tableMentions.add(mainTable[1].toLowerCase());
      
      // Tables from JOINs
      const joinMatches = sql.matchAll(/JOIN\s+(\w+)/gi);
      for (const match of joinMatches) {
        tableMentions.add(match[1].toLowerCase());
      }
      
      // Extract table references from WHERE clause
      const whereClause = sql.match(/WHERE\s+([\s\S]*?)(?:GROUP|ORDER|;|$)/i);
      if (whereClause) {
        // Look for table.column patterns
        const tableRefs = whereClause[1].matchAll(/(\w+)\.\w+/g);
        for (const match of tableRefs) {
          const table = match[1].toLowerCase();
          if (!tableMentions.has(table) && !['AND', 'OR'].includes(table.toUpperCase())) {
            issues.push(`ERROR: Table '${table}' is referenced in WHERE clause but not joined. Add the JOIN clause.`);
          }
        }
      }
      
      // Also check SELECT clause for table references
      const selectClause = sql.match(/SELECT\s+([\s\S]*?)FROM/i);
      if (selectClause) {
        const selectRefs = selectClause[1].matchAll(/(\w+)\.\w+/g);
        for (const match of selectRefs) {
          const table = match[1].toLowerCase();
          if (!tableMentions.has(table) && !['DISTINCT'].includes(table.toUpperCase())) {
            issues.push(`ERROR: Table '${table}' is referenced in SELECT but not joined. Add the JOIN clause.`);
          }
        }
      }
    }

    // Check for dangerous operations
    if (sqlUpper.includes('DROP TABLE') || sqlUpper.includes('DROP DATABASE')) {
      issues.push('WARNING: DROP statement detected. Ensure this is intentional.');
    }

    if (sqlUpper.includes('TRUNCATE')) {
      issues.push('WARNING: TRUNCATE operation detected. This will delete all records.');
    }

    if (sqlUpper.includes('DELETE') && !sqlUpper.includes('WHERE')) {
      issues.push('ERROR: DELETE without WHERE clause. Add WHERE to prevent data loss.');
    }

    if (sqlUpper.includes('UPDATE') && !sqlUpper.includes('WHERE')) {
      issues.push('ERROR: UPDATE without WHERE clause. Add WHERE to prevent mass updates.');
    }

    // Check for proper formatting
    if (!sqlUpper.includes('SELECT') && !sqlUpper.includes('INSERT') &&
        !sqlUpper.includes('UPDATE') && !sqlUpper.includes('DELETE') &&
        !sqlUpper.includes('CREATE')) {
      issues.push('WARNING: Could not identify SQL operation type.');
    }

    // Database-specific validations
    if (databaseType === 'mysql') {
      // MySQL should use LIMIT instead of ROWNUM
      if (sqlUpper.includes('ROWNUM')) {
        issues.push('NOTE: MySQL uses LIMIT instead of ROWNUM for pagination.');
      }
    }

    if (databaseType === 'oracle') {
      if (sqlUpper.includes('LIMIT') && !sqlUpper.includes('ROWNUM')) {
        issues.push('NOTE: Oracle uses ROWNUM instead of LIMIT for pagination.');
      }
    }

    if (databaseType === 'postgresql' && sqlUpper.includes('TO_DATE')) {
      issues.push('NOTE: Consider using PostgreSQL\'s to_date() or CAST function.');
    }

    return {
      isValid: issues.filter(i => i.startsWith('ERROR')).length === 0,
      issues,
    };
  }

  /**
   * Calculate risk level for the query
   */
  calculateRiskLevel(sql, databaseType) {
    const sqlUpper = sql.toUpperCase();
    let riskScore = 0;

    // Read operations are safe
    if (sqlUpper.includes('SELECT')) riskScore += 0;

    // Write operations are riskier
    if (sqlUpper.includes('INSERT')) riskScore += 2;
    if (sqlUpper.includes('UPDATE')) riskScore += 3;
    if (sqlUpper.includes('DELETE')) riskScore += 3;
    if (sqlUpper.includes('TRUNCATE')) riskScore += 4;
    if (sqlUpper.includes('DROP')) riskScore += 5;

    // Check for WHERE clause (safer for destructive operations)
    if ((sqlUpper.includes('UPDATE') || sqlUpper.includes('DELETE')) && sqlUpper.includes('WHERE')) {
      riskScore -= 1;
    }

    // Check for transaction control (safer)
    if (sqlUpper.includes('BEGIN') || sqlUpper.includes('START TRANSACTION')) {
      riskScore -= 1;
    }

    if (riskScore <= 1) return 'low';
    if (riskScore <= 2) return 'medium';
    if (riskScore <= 3) return 'high';
    return 'critical';
  }

  /**
   * Identify potential issues or improvements
   */
  identifyWarnings(sql) {
    const warnings = [];
    const sqlUpper = sql.toUpperCase();

    // Check for N+1 query patterns
    if (sqlUpper.match(/SELECT.*FROM.*JOIN.*SELECT.*FROM/)) {
      warnings.push('nested_select');
    }

    // Check for wildcard columns
    if (sqlUpper.includes('SELECT *')) {
      warnings.push('select_wildcard');
    }

    // Check for missing indexes
    if (sqlUpper.includes('WHERE') && !sqlUpper.includes('INDEX')) {
      warnings.push('verify_indexes');
    }

    // Check for missing LIMIT in SELECT
    if (sqlUpper.includes('SELECT') && !sqlUpper.includes('WHERE') && !sqlUpper.includes('LIMIT') && !sqlUpper.includes('ROWNUM')) {
      warnings.push('consider_limit');
    }

    return warnings;
  }

  /**
   * Format SQL for display
   */
  formatSQL(sql) {
    return sql
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        // Add indentation for AND, OR
        if (trimmed.match(/^(AND|OR)\s+/i)) {
          return '  ' + trimmed;
        }

        return trimmed;
      })
      .filter(line => line.length > 0)
      .join('\n');
  }

  /**
   * Add schema context from database documentation
   */
  async enhanceWithSchemaContext(description, schemaContext) {
    const enhancement = `
Using the following schema:
${schemaContext}

Generate SQL for: ${description}`;

    return enhancement;
  }
}

export default SQLGenerator;
