/**
 * Unit tests for text-extractor module.
 *
 * Tests MIME-type routing, media file detection, canExtractText helper,
 * and graceful error handling.
 */

import { describe, it, expect } from 'vitest';
import { extractText, isUnsupportedMediaType, canExtractText } from './text-extractor';

describe('text-extractor', () => {
  describe('extractText', () => {
    it('should return empty string for image MIME types', async () => {
      const buffer = Buffer.from('fake image data');
      expect(await extractText(buffer, 'image/png', '.png')).toBe('');
      expect(await extractText(buffer, 'image/jpeg', '.jpg')).toBe('');
      expect(await extractText(buffer, 'image/gif', '.gif')).toBe('');
    });

    it('should return empty string for audio MIME types', async () => {
      const buffer = Buffer.from('fake audio data');
      expect(await extractText(buffer, 'audio/mpeg', '.mp3')).toBe('');
      expect(await extractText(buffer, 'audio/wav', '.wav')).toBe('');
      expect(await extractText(buffer, 'audio/mp3', '.mp3')).toBe('');
    });

    it('should return empty string for video MIME types', async () => {
      const buffer = Buffer.from('fake video data');
      expect(await extractText(buffer, 'video/mp4', '.mp4')).toBe('');
      expect(await extractText(buffer, 'video/x-msvideo', '.avi')).toBe('');
    });

    it('should return empty string for unsupported MIME types with unsupported extension', async () => {
      const buffer = Buffer.from('some data');
      expect(await extractText(buffer, 'application/octet-stream', '.bin')).toBe('');
      expect(await extractText(buffer, 'application/zip', '.zip')).toBe('');
    });

    it('should extract text from text/plain buffers', async () => {
      const content = 'Hello, this is plain text content.';
      const buffer = Buffer.from(content, 'utf-8');
      const result = await extractText(buffer, 'text/plain', '.txt');
      expect(result).toBe(content);
    });

    it('should extract text from text/csv buffers', async () => {
      const content = 'col1,col2,col3\nval1,val2,val3';
      const buffer = Buffer.from(content, 'utf-8');
      const result = await extractText(buffer, 'text/csv', '.csv');
      expect(result).toBe(content);
    });

    it('should return empty string for empty text/plain buffers', async () => {
      const buffer = Buffer.from('', 'utf-8');
      const result = await extractText(buffer, 'text/plain', '.txt');
      expect(result).toBe('');
    });

    it('should return empty string for whitespace-only text/plain buffers', async () => {
      const buffer = Buffer.from('   \n\t  ', 'utf-8');
      const result = await extractText(buffer, 'text/plain', '.txt');
      expect(result).toBe('');
    });

    it('should handle errors gracefully and return empty string for corrupt PDF', async () => {
      const buffer = Buffer.from('not a real PDF');
      const result = await extractText(buffer, 'application/pdf', '.pdf');
      expect(result).toBe('');
    });

    it('should handle errors gracefully and return empty string for corrupt DOCX', async () => {
      const buffer = Buffer.from('not a real docx');
      const result = await extractText(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx');
      expect(result).toBe('');
    });

    it('should handle XLSX buffers gracefully (empty buffer)', async () => {
      const buffer = Buffer.alloc(0);
      const result = await extractText(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx');
      // Empty buffer should result in empty string (no content to extract)
      expect(result).toBe('');
    });

    it('should fall back to extension-based extraction when MIME is generic', async () => {
      const content = 'plain text via extension fallback';
      const buffer = Buffer.from(content, 'utf-8');
      // application/octet-stream is generic, but .txt extension triggers text extraction
      const result = await extractText(buffer, 'application/octet-stream', '.txt');
      expect(result).toBe(content);
    });

    it('should handle PPTX MIME type gracefully without throwing', async () => {
      const buffer = Buffer.from('not a real pptx');
      const result = await extractText(
        buffer,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.pptx'
      );
      // PPTX extraction is best-effort — should return a string (possibly with content
      // extracted by xlsx's lenient parser, or empty) but never throw
      expect(typeof result).toBe('string');
    });
  });

  describe('canExtractText', () => {
    it('should return true for PDF extension', () => {
      expect(canExtractText('.pdf')).toBe(true);
      expect(canExtractText('pdf')).toBe(true);
    });

    it('should return true for Word document extensions', () => {
      expect(canExtractText('.docx')).toBe(true);
      expect(canExtractText('.doc')).toBe(true);
    });

    it('should return true for Excel extensions', () => {
      expect(canExtractText('.xlsx')).toBe(true);
      expect(canExtractText('.xls')).toBe(true);
    });

    it('should return true for text/CSV extensions', () => {
      expect(canExtractText('.txt')).toBe(true);
      expect(canExtractText('.csv')).toBe(true);
    });

    it('should return true for PPTX extension', () => {
      expect(canExtractText('.pptx')).toBe(true);
    });

    it('should return false for image extensions', () => {
      expect(canExtractText('.png')).toBe(false);
      expect(canExtractText('.jpg')).toBe(false);
      expect(canExtractText('.jpeg')).toBe(false);
      expect(canExtractText('.gif')).toBe(false);
    });

    it('should return false for audio extensions', () => {
      expect(canExtractText('.mp3')).toBe(false);
      expect(canExtractText('.wav')).toBe(false);
    });

    it('should return false for video extensions', () => {
      expect(canExtractText('.mp4')).toBe(false);
      expect(canExtractText('.avi')).toBe(false);
    });

    it('should return false for unknown extensions', () => {
      expect(canExtractText('.zip')).toBe(false);
      expect(canExtractText('.exe')).toBe(false);
      expect(canExtractText('.bin')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(canExtractText('.PDF')).toBe(true);
      expect(canExtractText('.Docx')).toBe(true);
      expect(canExtractText('.TXT')).toBe(true);
    });
  });

  describe('isUnsupportedMediaType', () => {
    it('should return true for image MIME types', () => {
      expect(isUnsupportedMediaType('image/png')).toBe(true);
      expect(isUnsupportedMediaType('image/jpeg')).toBe(true);
      expect(isUnsupportedMediaType('image/gif')).toBe(true);
      expect(isUnsupportedMediaType('image/webp')).toBe(true);
    });

    it('should return true for audio MIME types', () => {
      expect(isUnsupportedMediaType('audio/mpeg')).toBe(true);
      expect(isUnsupportedMediaType('audio/wav')).toBe(true);
      expect(isUnsupportedMediaType('audio/mp3')).toBe(true);
    });

    it('should return true for video MIME types', () => {
      expect(isUnsupportedMediaType('video/mp4')).toBe(true);
      expect(isUnsupportedMediaType('video/x-msvideo')).toBe(true);
    });

    it('should return false for document MIME types', () => {
      expect(isUnsupportedMediaType('application/pdf')).toBe(false);
      expect(isUnsupportedMediaType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
      expect(isUnsupportedMediaType('text/plain')).toBe(false);
      expect(isUnsupportedMediaType('text/csv')).toBe(false);
    });

    it('should return false for unknown MIME types', () => {
      expect(isUnsupportedMediaType('application/octet-stream')).toBe(false);
      expect(isUnsupportedMediaType('application/json')).toBe(false);
    });
  });
});
