import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { rowToCollection, collectionToRow, type CollectionRow } from '../supabase/mappers';
import { Collection } from '../types';
import { mergeSeedCollections } from '../utils/mergeSeedCollections';

export function useCollections(options?: { includeSeedFallbacks?: boolean }) {
  const includeSeedFallbacks = options?.includeSeedFallbacks ?? false;
  const [dbCollections, setDbCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchCollections() {
      const { data, error: fetchError } = await supabase
        .from('collections')
        .select('*')
        .order('order', { ascending: true });

      if (!active) return;

      if (fetchError) {
        setError(getSupabaseErrorMessage(fetchError, 'Failed to load collections.'));
        setLoading(false);
        return;
      }

      setDbCollections(((data ?? []) as CollectionRow[]).map(rowToCollection));
      setLoading(false);
      setError(null);
    }

    fetchCollections();

    const channel = supabase
      .channel('collections-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => {
        fetchCollections();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const collections = useMemo(() => {
    if (!includeSeedFallbacks) return dbCollections;
    return mergeSeedCollections(dbCollections, { requiredOnly: true });
  }, [dbCollections, includeSeedFallbacks]);

  const addCollection = async (collectionData: Omit<Collection, 'id'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('collections')
        .insert(collectionToRow(collectionData))
        .select('id')
        .single();
      if (insertError) throw insertError;
      return data!.id as string;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to add collection.'));
    }
  };

  const updateCollection = async (id: string, collectionData: Partial<Collection>) => {
    if (id.startsWith('seed:')) {
      throw new Error('Seed fallback categories cannot be edited. Add them in Admin → Collections first.');
    }
    try {
      const { error: updateError } = await supabase
        .from('collections')
        .update(collectionToRow(collectionData))
        .eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to update collection.'));
    }
  };

  const deleteCollection = async (id: string) => {
    if (id.startsWith('seed:')) {
      throw new Error('Seed fallback categories cannot be deleted.');
    }
    try {
      const { error: deleteError } = await supabase.from('collections').delete().eq('id', id);
      if (deleteError) throw deleteError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to delete collection.'));
    }
  };

  return {
    collections,
    loading,
    error,
    addCollection,
    updateCollection,
    deleteCollection,
  };
}
