import { useState, useCallback } from 'react';

export function useVideoProgress() {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const triggerUpdate = () => setUpdateTrigger(prev => prev + 1);

  const getProgress = (videoId: string): number => {
    const val = localStorage.getItem(`nexusedu_progress_${videoId}`);
    return val ? parseFloat(val) : 0;
  };

  const setProgress = (videoId: string, time: number) => {
    localStorage.setItem(`nexusedu_progress_${videoId}`, String(time));
    localStorage.setItem(`nexusedu_last_watched_${videoId}`, String(Date.now()));
    triggerUpdate();
  };

  const isCompleted = (videoId: string): boolean => {
    return localStorage.getItem(`nexusedu_complete_${videoId}`) === 'true';
  };

  const setCompleted = (videoId: string, completed: boolean) => {
    if (completed) {
      localStorage.setItem(`nexusedu_complete_${videoId}`, 'true');
    } else {
      localStorage.removeItem(`nexusedu_complete_${videoId}`);
    }
    triggerUpdate();
  };

  const getNotes = (videoId: string): string => {
    return localStorage.getItem(`nexusedu_notes_${videoId}`) || '';
  };

  const setNotes = (videoId: string, notes: string) => {
    localStorage.setItem(`nexusedu_notes_${videoId}`, notes);
    triggerUpdate();
  };

  const getStats = useCallback(() => {
    let completedCount = 0;
    let totalSecondsWatched = 0;
    const inProgressVideos: { videoId: string; progress: number; lastWatched: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('nexusedu_complete_') && localStorage.getItem(key) === 'true') {
        completedCount++;
      } else if (key.startsWith('nexusedu_progress_')) {
        const videoId = key.replace('nexusedu_progress_', '');
        const progress = parseFloat(localStorage.getItem(key) || '0');
        if (progress > 0) {
          totalSecondsWatched += progress;
          if (localStorage.getItem(`nexusedu_complete_${videoId}`) !== 'true') {
            const lastWatched = parseInt(localStorage.getItem(`nexusedu_last_watched_${videoId}`) || '0', 10);
            inProgressVideos.push({ videoId, progress, lastWatched });
          }
        }
      }
    }

    return {
      completedCount,
      hoursWatched: Math.round((totalSecondsWatched / 3600) * 10) / 10,
      inProgressVideos
    };
  }, []);

  const recordWatchDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const watchDatesStr = localStorage.getItem('nexusedu_watch_dates');
    const watchDates: string[] = watchDatesStr ? JSON.parse(watchDatesStr) : [];
    if (!watchDates.includes(today)) {
      watchDates.push(today);
      localStorage.setItem('nexusedu_watch_dates', JSON.stringify(watchDates));
      triggerUpdate();
    }
  };

  return {
    getProgress,
    setProgress,
    isCompleted,
    setCompleted,
    getNotes,
    setNotes,
    getStats,
    recordWatchDate,
    updateTrigger
  };
}
