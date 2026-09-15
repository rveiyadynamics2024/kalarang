import { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { rowToBanner, bannerToRow, type BannerRow } from '../supabase/mappers';
import { Banner } from '../types';

export function useBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchBanners() {
      const { data, error: fetchError } = await supabase.from('banners').select('*');

      if (!active) return;

      if (fetchError) {
        setError(getSupabaseErrorMessage(fetchError, 'Failed to load banners.'));
        setLoading(false);
        return;
      }

      setBanners(((data ?? []) as BannerRow[]).map(rowToBanner));
      setLoading(false);
      setError(null);
    }

    fetchBanners();

    const channel = supabase
      .channel(`banners-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => {
        fetchBanners();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addBanner = async (bannerData: Omit<Banner, 'id'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('banners')
        .insert(bannerToRow(bannerData))
        .select('id')
        .single();
      if (insertError) throw insertError;
      return data!.id as string;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to add banner.'));
    }
  };

  const updateBanner = async (id: string, bannerData: Partial<Banner>) => {
    try {
      const { error: updateError } = await supabase
        .from('banners')
        .update(bannerToRow(bannerData))
        .eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to update banner.'));
    }
  };

  const deleteBanner = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('banners').delete().eq('id', id);
      if (deleteError) throw deleteError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to delete banner.'));
    }
  };

  return {
    banners,
    loading,
    error,
    addBanner,
    updateBanner,
    deleteBanner,
  };
}
