// KALARANG - Bulk product upload via spreadsheet (.xlsx/.xls/.csv)
//
// Two jobs:
//  1. generateSampleTemplate() - builds a ready-to-fill .xlsx with the right
//     headers and one example row, and triggers a browser download.
//  2. parseBulkFile() - reads an uploaded spreadsheet back, validates every
//     row, and returns clean product data ready to hand to addProduct().

import * as XLSX from 'xlsx';
import { Collection, Product } from '../types';
import { resolveProductImages } from './productImageByTitle';

// Column headers, in order, exactly as they appear in the spreadsheet.
// Keep these in sync with parseRow() below.
export const BULK_UPLOAD_COLUMNS = [
  'Name',
  'Collection',
  'Fabric',
  'Work',
  'Border',
  'Texture',
  'Colours',
  'Occasions',
  'MRP',
  'Sale Price',
  'Details',
  'Video URL',
  'Image URLs',
  'In Stock',
  'Featured',
  'New Arrival',
  'Allow Add To Cart',
] as const;

const SAMPLE_ROWS: Record<(typeof BULK_UPLOAD_COLUMNS)[number], string | number>[] = [
  {
    Name: 'Crimson Zari Banarasi Brocade',
    Collection: 'Banarasi',
    Fabric: 'Pure Silk',
    Work: 'Zari Jaal',
    Border: 'Broad Brocade',
    Texture: 'Rich and smooth',
    Colours: 'Red, Maroon',
    Occasions: 'Wedding, Festive',
    MRP: 12999,
    'Sale Price': 8999,
    Details: 'Handwoven Banarasi silk saree with intricate zari jaal work throughout.',
    'Video URL': '',
    'Image URLs': 'https://example.com/image1.jpg, https://example.com/image2.jpg',
    'In Stock': 'Yes',
    Featured: 'No',
    'New Arrival': 'Yes',
    'Allow Add To Cart': 'Yes',
  },
  {
    Name: 'Pearl White Organza Saree',
    Collection: 'Organza',
    Fabric: 'Organza',
    Work: 'Sequin Border',
    Border: 'Scalloped',
    Texture: 'Lightweight and flowy',
    Colours: 'White, Sky blue',
    Occasions: 'Party, Office',
    MRP: 5499,
    'Sale Price': 3999,
    Details: '',
    'Video URL': '',
    'Image URLs': '',
    'In Stock': 'Yes',
    Featured: 'Yes',
    'New Arrival': 'No',
    'Allow Add To Cart': 'Yes',
  },
];

const INSTRUCTIONS_ROWS: string[][] = [
  ['How to use this template'],
  ['1. Do not rename, remove, or reorder the column headers on the "Products" sheet.'],
  ['2. "Name", "Collection", "MRP" and "Sale Price" are required for every row.'],
  ['3. "Collection" must match one of your existing collection names exactly (see list below). It is not case-sensitive.'],
  ['4. "Colours" and "Occasions" — separate multiple values with a comma, e.g. "Red, Blue".'],
  ['5. "Image URLs" — separate multiple links with a comma. Leave blank to auto-assign a stock photo.'],
  ['6. "In Stock", "Featured", "New Arrival", "Allow Add To Cart" — enter Yes or No.'],
  ['7. Delete the two sample rows on the "Products" sheet before uploading your own data (or leave them — duplicates by name will just be skipped).'],
  [''],
  ['Your current collections:'],
];

/**
 * Builds the sample .xlsx workbook and triggers a browser download.
 * Includes an "Instructions" sheet and a "Products" sheet with headers +
 * two filled example rows, plus a live list of the store's collection names
 * so the admin knows exactly what to type in the Collection column.
 */
export function downloadSampleTemplate(collections: Collection[]) {
  const wb = XLSX.utils.book_new();

  const productSheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS, {
    header: [...BULK_UPLOAD_COLUMNS],
  });
  productSheet['!cols'] = BULK_UPLOAD_COLUMNS.map((h) => ({
    wch: Math.max(14, h.length + 4),
  }));
  XLSX.utils.book_append_sheet(wb, productSheet, 'Products');

  const collectionNames = collections.length > 0
    ? collections.map((c) => [c.name])
    : [['(No collections yet — create one in Manage Collections first.)']];
  const instructionsData = [...INSTRUCTIONS_ROWS, ...collectionNames];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');

  XLSX.writeFile(wb, 'kalarang-bulk-upload-template.xlsx');
}

export type BulkProductInput = Omit<Product, 'id' | 'createdAt' | 'isDeleted' | 'slug'>;

export interface BulkParsedRow {
  rowNumber: number; // 1-based row number as seen in the spreadsheet (header = row 1)
  data: BulkProductInput | null;
  errors: string[];
}

export interface BulkParseResult {
  rows: BulkParsedRow[];
  validCount: number;
  invalidCount: number;
}

function toYesNo(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0'].includes(normalized)) return false;
  return fallback;
}

function splitList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return String(value)
    .split(/[,|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function parseRow(
  raw: Record<string, unknown>,
  rowNumber: number,
  collections: Collection[]
): BulkParsedRow {
  const errors: string[] = [];

  const name = String(raw['Name'] ?? '').trim();
  if (!name) errors.push('"Name" is required.');

  const collectionInput = String(raw['Collection'] ?? '').trim();
  const collection = collections.find(
    (c) => c.name.toLowerCase() === collectionInput.toLowerCase()
  );
  if (!collectionInput) {
    errors.push('"Collection" is required.');
  } else if (!collection) {
    errors.push(
      `Collection "${collectionInput}" was not found. Check the Instructions sheet for exact names.`
    );
  }

  const mrp = toNumber(raw['MRP']);
  if (mrp === null || mrp <= 0) errors.push('"MRP" must be a positive number.');

  const salePrice = toNumber(raw['Sale Price']);
  if (salePrice === null || salePrice <= 0) errors.push('"Sale Price" must be a positive number.');

  if (mrp !== null && salePrice !== null && salePrice > mrp) {
    errors.push('"Sale Price" cannot be greater than "MRP".');
  }

  if (errors.length > 0) {
    return { rowNumber, data: null, errors };
  }

  const images = splitList(raw['Image URLs']);

  const data: BulkProductInput = {
    name,
    collectionId: collection!.id,
    fabric: String(raw['Fabric'] ?? '').trim(),
    work: String(raw['Work'] ?? '').trim(),
    border: String(raw['Border'] ?? '').trim(),
    texture: String(raw['Texture'] ?? '').trim(),
    colors: splitList(raw['Colours']).length > 0 ? splitList(raw['Colours']) : ['Standard'],
    occasions: splitList(raw['Occasions']),
    mrp: mrp!,
    salePrice: salePrice!,
    images: resolveProductImages(name, images.length > 0 ? images : undefined),
    details: String(raw['Details'] ?? '').trim() || undefined,
    videoUrl: String(raw['Video URL'] ?? '').trim() || undefined,
    allowAddToCart: toYesNo(raw['Allow Add To Cart'], true),
    isFeatured: toYesNo(raw['Featured'], false),
    isNewArrival: toYesNo(raw['New Arrival'], false),
    inStock: toYesNo(raw['In Stock'], true),
  };

  return { rowNumber, data, errors: [] };
}

/**
 * Reads an uploaded .xlsx/.xls/.csv file and validates every row against
 * the store's current collections. Looks for a sheet named "Products" first
 * (matching the template); if not found, falls back to the first sheet so
 * a plain CSV export still works.
 */
export async function parseBulkFile(
  file: File,
  collections: Collection[]
): Promise<BulkParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = workbook.SheetNames.includes('Products')
    ? 'Products'
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Could not find a sheet with product data in this file.');
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows = json.map((raw, index) => parseRow(raw, index + 2, collections)); // +2: header row + 1-based index

  const validCount = rows.filter((r) => r.data !== null).length;
  const invalidCount = rows.length - validCount;

  return { rows, validCount, invalidCount };
}