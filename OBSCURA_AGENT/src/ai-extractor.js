/**
 * Obscura Agent — AI Extractor Module
 * Structured data extraction from HTML using CSS/XPath selectors.
 * Optimized logic — no LLM calls. Uses Cheerio for DOM parsing.
 */

const cheerio = require('cheerio');

class AIExtractor {
  constructor(opts = {}) {
    this._extractors = opts.extractors || {};
  }

  /**
   * Register a custom extraction schema
   * @param {string} name
   * @param {object} schema - { selector: string, fields: { name: string, selector: string, type: string }[] }
   */
  registerSchema(name, schema) {
    this._extractors[name] = schema;
  }

  /**
   * Extract structured data from HTML using a schema
   */
  extract(html, schema) {
    const $ = cheerio.load(html);
    const schemaDef = typeof schema === 'string' ? this._extractors[schema] : schema;

    if (!schemaDef) {
      return this._autoExtract(html, $);
    }

    const result = {};

    if (schemaDef.selector) {
      const container = $(schemaDef.selector);
      if (container.length === 0) return result;

      for (const field of schemaDef.fields || []) {
        const elements = container.find(field.selector);
        const values = [];
        elements.each((_, el) => {
          const $el = $(el);
          let value;
          switch (field.type || 'text') {
            case 'text': value = $el.text().trim(); break;
            case 'html': value = $el.html(); break;
            case 'attr':
              value = $el.attr(field.attribute || 'href');
              break;
            case 'number':
              value = parseFloat($el.text().trim().replace(/[^0-9.-]/g, ''));
              break;
            default: value = $el.text().trim();
          }
          if (value !== undefined && value !== '' && !isNaN(value)) {
            values.push(value);
          }
        });

        result[field.name] = field.multiple ? values : (values[0] || null);
      }
    }

    return result;
  }

  /**
   * Auto-extract common patterns from any page
   */
  _autoExtract(html, $) {
    const result = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      headings: [],
      links: [],
      images: [],
      paragraphs: [],
      price: null,
      emails: [],
      phones: [],
      dates: [],
    };

    // Headings
    $('h1, h2, h3').each((_, el) => {
      const h = $(el);
      result.headings.push({
        level: el.tagName.toLowerCase(),
        text: h.text().trim()
      });
      if (result.headings.length >= 20) return false;
    });

    // Links
    $('a[href]').each((_, el) => {
      const a = $(el);
      result.links.push(a.attr('href'));
      if (result.links.length >= 50) return false;
    });

    // Images
    $('img[src]').each((_, el) => {
      const img = $(el);
      result.images.push({
        src: img.attr('src'),
        alt: img.attr('alt') || ''
      });
      if (result.images.length >= 20) return false;
    });

    // Paragraphs
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) result.paragraphs.push(text);
    });

    // Price pattern: $X.XX, £X.XX, €X.XX, etc.
    const priceRegex = /[\$\£\€]\s*\d+(?:,\d{3})*(?:\.\d{2})?/g;
    const bodyText = $('body').text();
    const priceMatches = bodyText.match(priceRegex);
    if (priceMatches) result.price = priceMatches[0];

    // Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = bodyText.match(emailRegex);
    if (emailMatches) result.emails = [...new Set(emailMatches)].slice(0, 10);

    // Phone numbers (US format)
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = bodyText.match(phoneRegex);
    if (phoneMatches) result.phones = [...new Set(phoneMatches)].slice(0, 5);

    // Dates in common formats
    const dateRegex = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}/g;
    const dateMatches = bodyText.match(dateRegex);
    if (dateMatches) result.dates = [...new Set(dateMatches)].slice(0, 10);

    return result;
  }

  /**
   * Extract tables as JSON arrays
   */
  extractTable(html, tableSelector) {
    const $ = cheerio.load(html);
    const table = $(tableSelector);
    if (!table.length) return [];

    const headers = [];
    table.find('thead th, thead td, tr:first-child th, tr:first-child td').each((_, el) => {
      headers.push($(el).text().trim());
    });

    const rows = [];
    const startRow = headers.length > 0 ? 1 : 0;
    table.find('tr').slice(startRow).each((_, row) => {
      const cells = [];
      $(row).find('td, th').each((_, cell) => {
        cells.push($(cell).text().trim());
      });
      if (cells.length > 0) {
        const rowObj = {};
        cells.forEach((cell, i) => {
          rowObj[headers[i] || `col_${i}`] = cell;
        });
        rows.push(rowObj);
      }
    });

    return rows;
  }
}

module.exports = { AIExtractor };