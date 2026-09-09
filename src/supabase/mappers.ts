import type { Product, Collection, Banner, HeroVideo, Settings, Order, OrderItem } from '../types';

/**
 * The rest of the app (sorting, date display) expects Firestore-style
 * `{ seconds: number }` timestamps (see types.ts: `createdAt: any`). Rather
 * than touch every component that reads `.createdAt.seconds`, we keep
 * producing that same shape from Postgres `timestamptz` columns here.
 */
function toTimestamp(value: string | null | undefined): { seconds: number } {
  const ms = value ? new Date(value).getTime() : Date.now();
  return { seconds: Math.floor(ms / 1000) };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  collection_id: string;
  fabric: string | null;
  work: string | null;
  border: string | null;
  texture: string | null;
  occasions: string[] | null;
  colors: string[] | null;
  mrp: number;
  sale_price: number;
  images: string[] | null;
  details: string | null;
  video_url: string | null;
  allow_add_to_cart: boolean | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  in_stock: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    collectionId: row.collection_id,
    fabric: row.fabric ?? '',
    work: row.work ?? '',
    border: row.border ?? '',
    texture: row.texture ?? '',
    occasions: row.occasions ?? [],
    colors: row.colors ?? [],
    mrp: Number(row.mrp),
    salePrice: Number(row.sale_price),
    images: row.images ?? [],
    details: row.details ?? undefined,
    videoUrl: row.video_url ?? undefined,
    allowAddToCart: row.allow_add_to_cart ?? true,
    isFeatured: row.is_featured,
    isNewArrival: row.is_new_arrival,
    inStock: row.in_stock,
    isDeleted: row.is_deleted,
    createdAt: toTimestamp(row.created_at),
  };
}

export function productToRow(data: Partial<Product>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.collectionId !== undefined) row.collection_id = data.collectionId;
  if (data.fabric !== undefined) row.fabric = data.fabric;
  if (data.work !== undefined) row.work = data.work;
  if (data.border !== undefined) row.border = data.border;
  if (data.texture !== undefined) row.texture = data.texture;
  if (data.occasions !== undefined) row.occasions = data.occasions;
  if (data.colors !== undefined) row.colors = data.colors;
  if (data.mrp !== undefined) row.mrp = data.mrp;
  if (data.salePrice !== undefined) row.sale_price = data.salePrice;
  if (data.images !== undefined) row.images = data.images;
  if (data.details !== undefined) row.details = data.details;
  if (data.videoUrl !== undefined) row.video_url = data.videoUrl;
  if (data.allowAddToCart !== undefined) row.allow_add_to_cart = data.allowAddToCart;
  if (data.isFeatured !== undefined) row.is_featured = data.isFeatured;
  if (data.isNewArrival !== undefined) row.is_new_arrival = data.isNewArrival;
  if (data.inStock !== undefined) row.in_stock = data.inStock;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  return row;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  cover_image: string | null;
  order: number;
  is_active: boolean;
  description: string | null;
}

export function rowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    coverImage: row.cover_image ?? '',
    order: row.order,
    isActive: row.is_active,
    description: row.description ?? undefined,
  };
}

export function collectionToRow(data: Partial<Collection>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.coverImage !== undefined) row.cover_image = data.coverImage;
  if (data.order !== undefined) row.order = data.order;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.description !== undefined) row.description = data.description;
  return row;
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------
export interface BannerRow {
  id: string;
  image_url: string | null;
  headline: string | null;
  subtext: string | null;
  cta_label: string | null;
  cta_link: string | null;
  is_active: boolean;
}

export function rowToBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    imageUrl: row.image_url ?? '',
    headline: row.headline ?? '',
    subtext: row.subtext ?? '',
    ctaLabel: row.cta_label ?? '',
    ctaLink: row.cta_link ?? '',
    isActive: row.is_active,
  };
}

export function bannerToRow(data: Partial<Banner>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.imageUrl !== undefined) row.image_url = data.imageUrl;
  if (data.headline !== undefined) row.headline = data.headline;
  if (data.subtext !== undefined) row.subtext = data.subtext;
  if (data.ctaLabel !== undefined) row.cta_label = data.ctaLabel;
  if (data.ctaLink !== undefined) row.cta_link = data.ctaLink;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  return row;
}

// ---------------------------------------------------------------------------
// Hero videos
// ---------------------------------------------------------------------------
export interface VideoRow {
  id: string;
  video_url: string;
  title: string | null;
  subtitle: string | null;
  is_active: boolean;
  created_at: string;
}

export function rowToVideo(row: VideoRow): HeroVideo {
  return {
    id: row.id,
    videoUrl: row.video_url,
    title: row.title ?? '',
    subtitle: row.subtitle ?? undefined,
    isActive: row.is_active,
    createdAt: toTimestamp(row.created_at),
  };
}

export function videoToRow(data: Partial<HeroVideo>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.videoUrl !== undefined) row.video_url = data.videoUrl;
  if (data.title !== undefined) row.title = data.title;
  if (data.subtitle !== undefined) row.subtitle = data.subtitle;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  return row;
}

// ---------------------------------------------------------------------------
// Settings (single row, id = 'main')
// ---------------------------------------------------------------------------
export interface SettingsRow {
  id: string;
  store_name: string;
  whatsapp_number: string;
  email: string | null;
  studio_address: string | null;
  announcement_bar: { enabled: boolean; text: string } | null;
  free_shipping_threshold: number;
  first_order_discount: { enabled: boolean; percent: number } | null;
  colors: Settings['colors'] | null;
}

export function rowToSettings(row: SettingsRow): Settings {
  return {
    storeName: row.store_name,
    whatsappNumber: row.whatsapp_number,
    email: row.email ?? undefined,
    studioAddress: row.studio_address ?? undefined,
    announcementBar: row.announcement_bar ?? { enabled: false, text: '' },
    freeShippingThreshold: Number(row.free_shipping_threshold),
    firstOrderDiscount: row.first_order_discount ?? undefined,
    colors: row.colors ?? undefined,
  };
}

export function settingsToRow(data: Settings): Record<string, unknown> {
  return {
    id: 'main',
    store_name: data.storeName,
    whatsapp_number: data.whatsappNumber,
    email: data.email,
    studio_address: data.studioAddress,
    announcement_bar: data.announcementBar,
    free_shipping_threshold: data.freeShippingThreshold,
    first_order_discount: data.firstOrderDiscount,
    colors: data.colors,
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export interface OrderRow {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  pincode: string | null;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  shipping_charges: number;
  total: number;
  status: Order['status'];
  payment_method: 'cod' | 'online' | null;
  payment_id: string | null;
  created_at: string;
}

export function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    pincode: row.pincode ?? '',
    notes: row.notes ?? undefined,
    items: row.items ?? [],
    subtotal: Number(row.subtotal),
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    discountPercent: row.discount_percent != null ? Number(row.discount_percent) : undefined,
    shippingCharges: Number(row.shipping_charges),
    total: Number(row.total),
    status: row.status,
    paymentMethod: row.payment_method ?? 'cod',
    paymentId: row.payment_id ?? undefined,
    createdAt: toTimestamp(row.created_at),
  };
}

export function orderToRow(
  data: Omit<Order, 'id' | 'createdAt' | 'status'>
): Record<string, unknown> {
  return {
    customer_name: data.customerName,
    phone: data.phone,
    address: data.address,
    pincode: data.pincode,
    notes: data.notes,
    items: data.items,
    subtotal: data.subtotal,
    discount_amount: data.discountAmount,
    discount_percent: data.discountPercent,
    shipping_charges: data.shippingCharges,
    total: data.total,
    // Online (Razorpay) payments are marked 'confirmed' immediately since
    // money has already been received; COD orders stay 'pending' until
    // admin confirms them.
    status: data.paymentMethod === 'online' ? 'confirmed' : 'pending',
    payment_method: data.paymentMethod ?? 'cod',
    payment_id: data.paymentId ?? null,
  };
}