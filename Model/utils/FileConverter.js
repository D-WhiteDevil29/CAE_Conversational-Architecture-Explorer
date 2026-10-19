import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FileConverter {
  constructor() {
    this.supportedFormats = [
      'pdf',
      'txt',
      'json',
      'doc',
      'docx',
      'csv',
      'md',
      'html',
      'xml',
    ];
  }

  /**
   * Convert uploaded file to JSON document format
   * @param {Buffer} fileBuffer - File buffer
   * @param {Object} fileInfo - File information (name, mimetype, size)
   * @returns {Promise<Array>} Array of document objects
   */
  async convertToJSON(fileBuffer, fileInfo) {
    const { originalname, mimetype, size } = fileInfo;
    const extension = path.extname(originalname).toLowerCase().slice(1);

    console.log(`Converting file: ${originalname} (${mimetype})`);

    try {
      switch (extension) {
        case 'pdf':
          return await this.convertPDF(fileBuffer, originalname);
        
        case 'txt':
        case 'md':
          return await this.convertText(fileBuffer, originalname, extension);
        
        case 'json':
          return await this.convertJSON(fileBuffer, originalname);
        
        case 'docx':
        case 'doc':
          return await this.convertWord(fileBuffer, originalname);
        
        case 'csv':
          return await this.convertCSV(fileBuffer, originalname);
        
        case 'html':
        case 'xml':
          return await this.convertMarkup(fileBuffer, originalname, extension);
        
        default:
          // For unsupported formats, try to read as text
          console.log(`⚠️ Unsupported format: ${extension}, attempting text extraction`);
          return await this.convertText(fileBuffer, originalname, extension);
      }
    } catch (error) {
      console.error(`Error converting ${originalname}:`, error);
      throw new Error(`Failed to convert ${originalname}: ${error.message}`);
    }
  }

  async convertPDF(buffer, filename) {
    try {
      const data = await pdfParse(buffer);
      
      const document = {
        id: uuidv4(),
        title: filename,
        content: data.text.trim(),
        source: 'uploaded',
        sourceId: `upload-${Date.now()}`,
        type: 'document',
        metadata: {
          filename: filename,
          format: 'pdf',
          pages: data.numpages,
          uploadedAt: new Date().toISOString(),
          info: data.info || {},
        },
      };

      return [document];
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  async convertText(buffer, filename, extension) {
    try {
      const content = buffer.toString('utf-8').trim();
      
      if (!content) {
        throw new Error('File is empty');
      }

      const document = {
        id: uuidv4(),
        title: filename,
        content: content,
        source: 'uploaded',
        sourceId: `upload-${Date.now()}`,
        type: extension === 'md' ? 'markdown' : 'document',
        metadata: {
          filename: filename,
          format: extension,
          uploadedAt: new Date().toISOString(),
          size: buffer.length,
        },
      };

      return [document];
    } catch (error) {
      throw new Error(`Text parsing failed: ${error.message}`);
    }
  }

  async convertJSON(buffer, filename) {
    try {
      const jsonData = JSON.parse(buffer.toString('utf-8'));
      
      if (Array.isArray(jsonData)) {
        return jsonData.map((item) => {
          if (!item.id) item.id = uuidv4();
          if (!item.source) item.source = 'uploaded';
          if (!item.sourceId) item.sourceId = `upload-${Date.now()}`;
          if (!item.metadata) item.metadata = {};
          item.metadata.filename = filename;
          item.metadata.uploadedAt = new Date().toISOString();
          return item;
        });
      } else if (jsonData.content || jsonData.text) {
        const doc = {
          id: jsonData.id || uuidv4(),
          title: jsonData.title || filename,
          content: jsonData.content || jsonData.text,
          source: jsonData.source || 'uploaded',
          sourceId: jsonData.sourceId || `upload-${Date.now()}`,
          type: jsonData.type || 'document',
          metadata: {
            ...jsonData.metadata,
            filename: filename,
            uploadedAt: new Date().toISOString(),
          },
        };
        return [doc];
      } else {
        const document = {
          id: uuidv4(),
          title: filename,
          content: JSON.stringify(jsonData, null, 2),
          source: 'uploaded',
          sourceId: `upload-${Date.now()}`,
          type: 'json-data',
          metadata: {
            filename: filename,
            format: 'json',
            uploadedAt: new Date().toISOString(),
            originalData: jsonData,
          },
        };
        return [document];
      }
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  /**
   * Convert Word document (DOCX) - splits into sections by headings
   */
  async convertWord(buffer, filename) {
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const rawResult = await mammoth.extractRawText({ buffer });
      
      const content = rawResult.value.trim();
      if (!content) {
        throw new Error('Document is empty or contains no readable text');
      }

      const sections = this.splitDocumentIntoSections(htmlResult.value, filename);
      
      if (sections && sections.length > 1) {
        const timestamp = Date.now();
        return sections.map((section, idx) => ({
          id: uuidv4(),
          title: `${filename} - ${section.title}`,
          content: section.content,
          source: 'uploaded',
          sourceId: `upload-${timestamp}-s${idx}`,
          type: 'document-section',
          metadata: {
            filename: filename,
            format: 'docx',
            sectionTitle: section.title,
            sectionIndex: idx,
            totalSections: sections.length,
            uploadedAt: new Date().toISOString(),
            messages: (htmlResult.messages || []).slice(0, 3),
          },
        }));
      }

      // Fall back to single document
      return [{
        id: uuidv4(),
        title: filename,
        content: content,
        source: 'uploaded',
        sourceId: `upload-${Date.now()}`,
        type: 'document',
        metadata: {
          filename: filename,
          format: 'docx',
          uploadedAt: new Date().toISOString(),
          messages: htmlResult.messages || [],
        },
      }];
    } catch (error) {
      throw new Error(`Word document parsing failed: ${error.message}`);
    }
  }

  /**
   * Split HTML document into sections based on headings
   */
  splitDocumentIntoSections(html, filename) {
    if (!html || html.trim().length === 0) return null;

    // Decode common HTML entities
    const clean = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, ' ');

    // Find all headings with their positions
    const headingRegex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
    const headings = [];
    let m;

    while ((m = headingRegex.exec(clean)) !== null) {
      const title = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (title.length >= 3 && title.length <= 120) {
        headings.push({ title, start: m.index, level: m[1] });
      }
    }

    if (headings.length < 2) return null;

    const stripHtml = (s) =>
      s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const sections = [];
    for (let i = 0; i < headings.length; i++) {
      const end = i + 1 < headings.length ? headings[i + 1].start : clean.length;
      const sectionHtml = clean.substring(headings[i].start, end);
      const text = stripHtml(sectionHtml);

      // Only keep sections with meaningful content (> 80 chars)
      if (text.length > 80) {
        sections.push({ title: headings[i].title, content: text });
      }
    }

    return sections.length > 1 ? sections : null;
  }

  /**
   * Convert CSV file
   */
  async convertCSV(buffer, filename) {
    try {
      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const documents = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const rowData = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        const content = Object.entries(rowData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        documents.push({
          id: uuidv4(),
          title: `${filename} - Row ${i}`,
          content: content,
          source: 'uploaded',
          sourceId: `upload-${Date.now()}-row-${i}`,
          type: 'csv-row',
          metadata: {
            filename: filename,
            format: 'csv',
            rowNumber: i,
            uploadedAt: new Date().toISOString(),
            data: rowData,
          },
        });
      }

      if (documents.length === 0) {
        documents.push({
          id: uuidv4(),
          title: filename,
          content: content,
          source: 'uploaded',
          sourceId: `upload-${Date.now()}`,
          type: 'csv',
          metadata: {
            filename: filename,
            format: 'csv',
            uploadedAt: new Date().toISOString(),
            headers: headers,
            rowCount: lines.length - 1,
          },
        });
      }

      return documents;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  async convertMarkup(buffer, filename, extension) {
    try {
      const content = buffer.toString('utf-8');
      
      const textContent = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!textContent) {
        throw new Error('No readable content found');
      }

      const document = {
        id: uuidv4(),
        title: filename,
        content: textContent,
        source: 'uploaded',
        sourceId: `upload-${Date.now()}`,
        type: extension,
        metadata: {
          filename: filename,
          format: extension,
          uploadedAt: new Date().toISOString(),
          originalMarkup: content,
        },
      };

      return [document];
    } catch (error) {
      throw new Error(`${extension.toUpperCase()} parsing failed: ${error.message}`);
    }
  }

  async saveToContext(documents, filename) {
    try {
      const contextDir = path.join(__dirname, '..', 'data', 'context', 'extra-docs');
      
      await fs.mkdir(contextDir, { recursive: true });
      
      const timestamp = Date.now();
      const baseName = path.basename(filename, path.extname(filename));
      const outputFilename = `uploaded-${baseName}-${timestamp}.json`;
      const outputPath = path.join(contextDir, outputFilename);
      
      await fs.writeFile(outputPath, JSON.stringify(documents, null, 2), 'utf-8');
      
      console.log(`Saved ${documents.length} document(s) to: context/extra-docs/${outputFilename}`);
      
      return {
        filename: outputFilename,
        path: outputPath,
        documentCount: documents.length,
      };
    } catch (error) {
      throw new Error(`Failed to save documents: ${error.message}`);
    }
  }
}

export default FileConverter;
