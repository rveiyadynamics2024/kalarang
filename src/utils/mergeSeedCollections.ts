import { SEED_COLLECTIONS } from '../data/seedCatalog';
import type { Collection } from '../types';

/** Required category slugs that must appear in shop navigation even if missing from the database. */
export const REQUIRED_CATEGORY_SLUGS = ['dresses', 'blouses', 'dupattas'] as const;

/**
 * Merge database collections with seed fallbacks for any required (or all seed)
 * categories that are not yet created in the database.
 */
export function mergeSeedCollections(
  dbCollections: Collection[],
  options?: { requiredOnly?: boolean }
): Collection[] {
  const bySlug = new Map(dbCollections.map((c) => [c.slug, c]));
  const seeds = options?.requiredOnly
    ? SEED_COLLECTIONS.filter((c) =>
        (REQUIRED_CATEGORY_SLUGS as readonly string[]).includes(c.slug)
      )
    : SEED_COLLECTIONS;

  const merged = [...dbCollections];

  for (const seed of seeds) {
    if (bySlug.has(seed.slug)) continue;
    merged.push({
      id: `seed:${seed.slug}`,
      name: seed.name,
      slug: seed.slug,
      coverImage: seed.coverImage,
      order: seed.order,
      isActive: seed.isActive,
      description: seed.description,
    });
  }

  return merged.sort((a, b) => a.order - b.order);
}
