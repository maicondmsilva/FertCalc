import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { NotificationPreferences } from '../types/notification.types';

export function useNotificationPreferences(userId: string) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error("Error loading preferences", error);
      } else if (data) {
        setPreferences(data as NotificationPreferences);
      } else {
        // Init default preferences
        const defaultPrefs: Partial<NotificationPreferences> = {
          user_id: userId,
          email_enabled: true,
          push_enabled: true,
          in_app_enabled: true,
          sound_enabled: true,
          desktop_enabled: true,
          disabled_types: []
        };
        // Option to insert default preferences on first load
        setPreferences(defaultPrefs as NotificationPreferences);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!userId) return;
    
    // Optimistic UI updates
    setPreferences(prev => prev ? { ...prev, ...updates } : updates as NotificationPreferences);
    
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() });
        
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update preferences:', error);
      // Revert if error? For now just log
    }
  };

  const updateGroup = (groupType: string, enabled: boolean) => {
    // Here we can map groupTypes to disable lists
    // Or just generally toggle options
  };

  const updateSound = (enabled: boolean) => updatePreferences({ sound_enabled: enabled });
  const updateDesktop = (enabled: boolean) => updatePreferences({ desktop_enabled: enabled });

  return {
    preferences,
    isLoading,
    updatePreferences,
    updateGroup,
    updateSound,
    updateDesktop,
    refresh: loadPreferences
  };
}
