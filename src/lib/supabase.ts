import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://jwwlnjcickeignkemvrj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3d2xuamNpY2tlaWdua2VtdnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODk1OTAsImV4cCI6MjA4ODg2NTU5MH0.8l6kn6dh_Ki-ecQ78PsL9ma1R5XlhPN6-KmoE9cuYYo',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);

export const logActivity = async (userId: string | undefined, action: string, details: any = {}) => {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId || null,
      action,
      details,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

export const saveProgress = async (userId: string, videoId: string, progressPercent: number) => {
  try {
    // Check if record exists
    const { data: existing, error: fetchError } = await supabase
      .from('watch_history')
      .select('id, watch_count, progress_percent')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existing) {
      // Update
      const shouldIncrement = existing.progress_percent < 95 && progressPercent >= 95;
      await supabase
        .from('watch_history')
        .update({
          progress_percent: progressPercent,
          last_watched_at: new Date().toISOString(),
          watch_count: shouldIncrement ? (existing.watch_count || 0) + 1 : existing.watch_count,
        })
        .eq('id', existing.id);
    } else {
      // Insert
      await supabase.from('watch_history').insert({
        user_id: userId,
        video_id: videoId,
        progress_percent: progressPercent,
        watch_count: progressPercent >= 95 ? 1 : 0,
      });
    }
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
};
