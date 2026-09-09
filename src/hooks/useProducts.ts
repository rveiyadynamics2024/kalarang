import { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { ensureAdminAuth } from '../auth';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { rowToProduct, productToRow, type ProductRow } from '../supabase/mappers';
import { Product } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchProducts() {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(getSupabaseErrorMessage(fetchError, 'Failed to load products.'));
        setLoading(false);
        return;
      }

      setProducts(((data ?? []) as ProductRow[]).map(rowToProduct));
      setLoading(false);
      setError(null);
    }

    fetchProducts();

    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'isDeleted'>) => {
    try {
      await ensureAdminAuth();

      const docId = productData.slug;
      if (!docId) {
        throw new Error('Product slug is required.');
      }

      const { data: existing } = await supabase
        .from('products')
        .select('id, is_deleted')
        .eq('id', docId)
        .maybeSingle();

      if (existing && !existing.is_deleted) {
        throw new Error(
          `A product named similarly already exists (slug: ${docId}). Use a different display name.`
        );
      }

      const row = {
        id: docId,
        ...productToRow(productData),
        is_deleted: false,
      };

      const { error: upsertError } = await supabase.from('products').upsert(row);
      if (upsertError) throw upsertError;

      return docId;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to add product.'));
    }
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      await ensureAdminAuth();

      const { id: _id, createdAt: _createdAt, ...updates } = productData;
      const row = { ...productToRow(updates), updated_at: new Date().toISOString() };

      const { error: updateError } = await supabase.from('products').update(row).eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to update product.'));
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await ensureAdminAuth();

      const { error: deleteError } = await supabase
        .from('products')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (deleteError) throw deleteError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to delete product.'));
    }
  };

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
  };
}
