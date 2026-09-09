import { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { rowToSettings, settingsToRow, type SettingsRow } from '../supabase/mappers';
import { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  storeName: 'KALARANG — Silks & Studio',
  whatsappNumber: '919108955445',
  email: 'studio@kalarang.com',
  studioAddress: '',
  announcementBar: {
    enabled: true,
    text: '✨ Every first order 10% off ✨',
  },
  freeShippingThreshold: 5000,
  firstOrderDiscount: { enabled: true, percent: 10 },
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchSettings() {
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (!active) return;

      if (fetchError) {
        setError(getSupabaseErrorMessage(fetchError, 'Failed to load settings.'));
        setLoading(false);
        return;
      }

      setSettings(data ? rowToSettings(data as SettingsRow) : DEFAULT_SETTINGS);
      setLoading(false);
      setError(null);
    }

    fetchSettings();

    const channel = supabase
      .channel(`settings-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.main' },
        () => fetchSettings()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const saveSettings = async (newSettings: Settings) => {
    try {
      const { error: upsertError } = await supabase.from('settings').upsert(settingsToRow(newSettings));
      if (upsertError) throw upsertError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to save settings.'));
    }
  };

  return {
    settings,
    loading,
    error,
    saveSettings,
  };
}
