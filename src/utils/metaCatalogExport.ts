import * as XLSX from 'xlsx';
import { Product, Collection } from '../types';

/**
 * Builds a product feed in Meta (Facebook/Instagram) Commerce Catalog format.
 * Required Meta columns: id, title, description, availability, condition,
 * price, link, image_link, brand.
 */

const BRAND = 'KALARANG';
const MAX_ADDITIONAL_IMAGES = 19;

export const META_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'color',
  'material',
  'gender',
  'age_group',
  'product_type',
  'google_product_category',
] as const;

type MetaRow = Record<(typeof META_COLUMNS)[number], string>;

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

const formatPrice = (amount: number) => `${Number(amount).toFixed(2)} INR`;

function buildRow(product: Product, collections: Collection[]): MetaRow {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const images = (product.images || []).filter((url) => url && isHttpUrl(url));
  const collection = collections.find((c) => c.id === product.collectionId);

  const sale = Number(product.salePrice) || 0;
  const mrp = Number(product.mrp) || 0;
  // Meta: "price" = regular price, "sale_price" = discounted price
  const regularPrice = mrp > sale ? mrp : sale;
  const salePrice = mrp > sale && sale > 0 ? sale : 0;

  const descriptionParts = [
    product.details?.trim(),
    product.fabric && `Fabric: ${product.fabric}.`,
    product.work && `Work: ${product.work}.`,
    product.border && `Border: ${product.border}.`,
  ].filter(Boolean);

  return {
    id: product.id,
    title: product.name.slice(0, 150),
    description:
      descriptionParts.join(' ') || `${product.name} by ${BRAND} Silks & Studio.`,
    availability: product.inStock ? 'in stock' : 'out of stock',
    condition: 'new',
    price: formatPrice(regularPrice),
    sale_price: salePrice ? formatPrice(salePrice) : '',
    link: `${origin}/products/${product.slug}`,
    image_link: images[0] || '',
    additional_image_link: images.slice(1, 1 + MAX_ADDITIONAL_IMAGES).join(','),
    brand: BRAND,
    color: (product.colors || []).join(', '),
    material: product.fabric || '',
    gender: 'female',
    age_group: 'adult',
    product_type: collection?.name || 'Sarees',
    google_product_category:
      'Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing > Saris & Lehengas',
  };
}

export function buildMetaCatalogRows(products: Product[], collections: Collection[]): MetaRow[] {
  return products
    .filter((p) => !p.isDeleted)
    .map((p) => buildRow(p, collections));
}

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadMetaCatalogCsv(products: Product[], collections: Collection[]) {
  const rows = buildMetaCatalogRows(products, collections);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...META_COLUMNS] });
  const csv = XLSX.utils.sheet_to_csv(sheet);
  // BOM so Excel opens UTF-8 correctly
  download(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    `kalarang-meta-catalog-${fileStamp()}.csv`
  );
  return rows.length;
}

export function downloadMetaCatalogXlsx(products: Product[], collections: Collection[]) {
  const rows = buildMetaCatalogRows(products, collections);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...META_COLUMNS] });
  sheet['!cols'] = META_COLUMNS.map((col) => ({
    wch: ['description', 'link', 'image_link', 'additional_image_link', 'google_product_category'].includes(col)
      ? 45
      : 18,
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Products');
  XLSX.writeFile(book, `kalarang-meta-catalog-${fileStamp()}.xlsx`);
  return rows.length;
}