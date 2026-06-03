/**
 * Script to create a minimal institutional .docx template with placeholders.
 * 
 * This creates a valid Word document containing the required placeholder tags:
 * {{NUMERO_ACTA}}, {{CIUDAD_FECHA}}, {{HORA}}, {{LUGAR}}, {{ASISTENTES}},
 * {{ORDEN_DIA}}, {{DESARROLLO}}, {{PROYECTO}}, {{REVISO}}, {{COPIA}}
 * 
 * Usage: npx tsx scripts/create-template.ts
 */

import PizZip from 'pizzip';
import * as fs from 'fs';
import * as path from 'path';

// Minimal content types for a valid .docx
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

// Package relationships
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

// Word relationships
const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Styles with institutional formatting
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="200" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:spacing w:before="200" w:after="100"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;

// Helper to create a paragraph with text
function p(text: string, style?: string, bold?: boolean): string {
  const pStyle = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p>${pStyle}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

// Main document content with all placeholders in single text runs
const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${p('UNIVERSIDAD COOPERATIVA DE COLOMBIA', 'Heading1', true)}
    ${p('FACULTAD DE INGENIER\u00CDA', 'Heading1', true)}
    ${p('ACTA DE COMIT\u00C9', 'Heading1', true)}
    ${p('Acta No. {{NUMERO_ACTA}}', 'Heading2', true)}
    ${p('Ciudad y Fecha: {{CIUDAD_FECHA}}')}
    ${p('Hora: {{HORA}}')}
    ${p('Lugar: {{LUGAR}}')}
    ${p('ASISTENTES', 'Heading2', true)}
    ${p('{{ASISTENTES}}')}
    ${p('ORDEN DEL D\u00CDA', 'Heading2', true)}
    ${p('{{ORDEN_DIA}}')}
    ${p('DESARROLLO', 'Heading2', true)}
    ${p('{{DESARROLLO}}')}
    ${p('FIRMAS', 'Heading2', true)}
    ${p('Proyect\u00F3: {{PROYECTO}}')}
    ${p('Revis\u00F3: {{REVISO}}')}
    ${p('Copia: {{COPIA}}')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

function createTemplate(): void {
  const zip = new PizZip();
  
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', WORD_RELS);
  zip.file('word/document.xml', DOCUMENT);
  zip.file('word/styles.xml', STYLES);

  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const outputDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'acta-comite-curricular-ing-industrial.docx');
  fs.writeFileSync(outputPath, buffer);

  console.log(`Template created successfully at: ${outputPath}`);
  console.log(`File size: ${buffer.length} bytes`);
}

createTemplate();
