import { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { uploadFile } from '../supabase/storageUpload';
import { rowToVideo, videoToRow, type VideoRow } from '../supabase/mappers';
import { HeroVideo } from '../types';

export function useVideos() {
  const [videos, setVideos] = useState<HeroVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchVideos() {
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(getSupabaseErrorMessage(fetchError, 'Failed to load videos.'));
        setLoading(false);
        return;
      }

      setVideos(((data ?? []) as VideoRow[]).map(rowToVideo));
      setLoading(false);
      setError(null);
    }

    fetchVideos();

    const channel = supabase
      .channel(`videos-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
        fetchVideos();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addVideo = async (videoData: Omit<HeroVideo, 'id' | 'createdAt'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('videos')
        .insert(videoToRow(videoData))
        .select('id')
        .single();
      if (insertError) throw insertError;
      return data!.id as string;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to add video.'));
    }
  };

  const updateVideo = async (id: string, videoData: Partial<HeroVideo>) => {
    try {
      const { error: updateError } = await supabase
        .from('videos')
        .update(videoToRow(videoData))
        .eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to update video.'));
    }
  };

  const deleteVideo = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('videos').delete().eq('id', id);
      if (deleteError) throw deleteError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to delete video.'));
    }
  };

  const uploadVideoFile = (file: File, onProgress: (progress: number) => void): Promise<string> =>
    uploadFile(file, { folder: 'hero-videos', maxSizeMb: 25, onProgress });

  return {
    videos,
    loading,
    error,
    addVideo,
    updateVideo,
    deleteVideo,
    uploadVideoFile,
  };
}
