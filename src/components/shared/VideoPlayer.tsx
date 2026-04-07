import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, PictureInPicture, Settings } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useVideoProgress } from '../../hooks/useVideoProgress';
import { useAuth } from '../../contexts/AuthContext';
import { saveProgress } from '../../lib/supabase';
import { WakeUpCountdown } from '../WakeUpCountdown';

const getBackendUrl = async () => {
  const BACKENDS = [
    'https://nexusedu-backend-0bjq.onrender.com',
    'https://edbe7e18-233b-4ff5-bed9-83c4e0edd51e-00-25a1ryv2rxe0o.sisko.replit.dev'
  ];
  
  const BACKEND_CACHE_KEY = 'working_backend';
  const BACKEND_CACHE_TIME_KEY = 'working_backend_time';
  const BACKEND_TTL = 5 * 60 * 1000; // 5 minutes

  const workingBackend = localStorage.getItem(BACKEND_CACHE_KEY) || '';
  const cachedTime = localStorage.getItem(BACKEND_CACHE_TIME_KEY);

  if (workingBackend && cachedTime) {
    const age = Date.now() - parseInt(cachedTime, 10);
    if (age < BACKEND_TTL) {
      try {
        const check = await fetch(`${workingBackend}/`, { signal: AbortSignal.timeout(5000) });
        if (check.ok) return workingBackend;
      } catch { /* ignore */ }
    } else {
      localStorage.removeItem(BACKEND_CACHE_KEY);
      localStorage.removeItem(BACKEND_CACHE_TIME_KEY);
    }
  }

  for (const backend of BACKENDS) {
    try {
      const res = await fetch(`${backend}/`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        localStorage.setItem(BACKEND_CACHE_KEY, backend);
        localStorage.setItem(BACKEND_CACHE_TIME_KEY, Date.now().toString());
        return backend;
      }
    } catch { /* ignore */ }
  }
  throw new Error('Cannot reach video server. Check your connection.');
};

interface VideoPlayerProps {
  videoId: string;
  sizeMb?: number;
  onComplete?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export function VideoPlayer({ videoId, sizeMb = 0, onComplete, onTimeUpdate }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { getProgress, setProgress, isCompleted, setCompleted } = useVideoProgress();
  const { user } = useAuth();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [actualDuration, setActualDuration] = useState<number>(0);
  
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startVideo = useCallback(async (startTime: number = 0) => {
    if (!videoRef.current || !videoId) return;

    const vid = videoRef.current;
    vid.pause();
    vid.removeAttribute('src');
    vid.load();

    setHasError(false);
    setErrorMessage('');
    setIsStarting(true);
    setHasStarted(true);

    try {
      const backend = await getBackendUrl();
      const controller = new AbortController();
      const wakeTimeout = setTimeout(() => controller.abort(), 15000);
      
      try {
        const healthRes = await fetch(`${backend}/api/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!healthRes.ok) {
          throw new Error('Backend not ready');
        }
      } catch {
        throw new Error('no supported source (backend waking up)');
      } finally {
        clearTimeout(wakeTimeout);
      }

      const prefetchController = new AbortController();
      const prefetchTimeout = setTimeout(() => prefetchController.abort(), 10000);
      try {
        await fetch(`${backend}/api/prefetch/${videoId}`, {
          signal: prefetchController.signal,
          cache: 'no-store',
        });
      } catch {
        // ignore
      } finally {
        clearTimeout(prefetchTimeout);
      }

      if (!mountedRef.current) return;

      const streamUrl = `${backend}/api/stream/${videoId}`;
      vid.preload = 'metadata';
      vid.src = streamUrl;
      vid.load();
      
      if (startTime > 0) {
        vid.currentTime = startTime;
      }

      try {
        await vid.play();
      } catch (playError: unknown) {
        const msg = playError instanceof Error ? playError.message : '';
        if (msg.includes('AbortError') || msg.includes('interrupted') || msg.includes('NotAllowedError') || msg.includes('user')) {
          setIsStarting(false);
          return;
        }
        throw playError;
      }

      setIsStarting(false);

    } catch (error: unknown) {
      if (!mountedRef.current) return;
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      let userMessage = 'ভিডিও লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      
      if (errorMsg.includes('no supported source') || errorMsg.includes('MEDIA_ELEMENT_ERROR') || errorMsg.includes('MEDIA_ERR_SRC_NOT_SUPPORTED')) {
        userMessage = 'ব্যাকএন্ড সার্ভার প্রস্তুত নয়। ৩০ সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন। (সার্ভার ঘুম থেকে উঠছে)';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        userMessage = 'নেটওয়ার্ক সমস্যা। ইন্টারনেট কানেকশন চেক করুন।';
      }
      
      setHasError(true);
      setErrorMessage(userMessage);
      setIsStarting(false);
      setHasStarted(false);
    }
  }, [videoId]);

  useEffect(() => {
    const savedVolume = localStorage.getItem('nexusedu_volume');
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));
      if (videoRef.current) videoRef.current.volume = parseFloat(savedVolume);
    }

    const savedSpeed = localStorage.getItem('nexusedu_speed');
    if (savedSpeed) {
      setPlaybackSpeed(parseFloat(savedSpeed));
      if (videoRef.current) videoRef.current.playbackRate = parseFloat(savedSpeed);
    }

    const savedProgress = getProgress(videoId);
    if (savedProgress > 10) {
      setResumeTime(savedProgress);
    } else {
      setResumeTime(0);
    }
    setShowResumePrompt(false);
  }, [videoId, getProgress]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const showVideoToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1000);
  };

  const togglePlay = useCallback(() => {
    if (!hasStarted || !videoRef.current) {
      if (!isStarting) startVideo();
      return;
    }
    if (isStarting) return;
    
    const video = videoRef.current;
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      setHasError(true);
      setHasStarted(false);
      setErrorMessage('Video format not supported or server error.');
      return;
    }

    if (video.paused || video.ended) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if (error.name !== 'AbortError') {
            setIsBuffering(false);
            setIsPlaying(false);
            setHasError(true);
            setHasStarted(false);
            if (error.name === 'NotAllowedError') {
              setErrorMessage('Autoplay was prevented by your browser. Please tap play manually.');
              setHasError(false);
              setHasStarted(true);
            } else {
              setErrorMessage('Failed to play video: ' + (error.message || 'Unknown error'));
            }
          }
        });
      }
    } else {
      video.pause();
    }
  }, [hasStarted, isStarting, startVideo]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
    localStorage.setItem('nexusedu_volume', String(newVolume));
  };

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        const savedVolume = localStorage.getItem('nexusedu_volume');
        const restoreVol = savedVolume ? parseFloat(savedVolume) : 1;
        setVolume(restoreVol > 0 ? restoreVol : 1);
        videoRef.current.volume = restoreVol > 0 ? restoreVol : 1;
      }
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      await document.exitFullscreen().catch(err => console.error(err));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSeek = useCallback((amount: number) => {
    if (!hasStarted) return;
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
      showVideoToast(amount > 0 ? '+10s' : '-10s');
    }
  }, [hasStarted]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasStarted) return;
    if (progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * duration;
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    localStorage.setItem('nexusedu_speed', String(speed));
    setShowSpeedMenu(false);
    showToast(`Speed changed to ${speed}x`);
  };

  const togglePiP = async () => {
    if (!hasStarted || !videoRef.current) return;
    try {
      if (document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          if (videoRef.current.readyState >= 1) {
            await videoRef.current.requestPictureInPicture();
          } else {
            showToast("Please wait for video to load");
          }
        }
      }
    } catch (error) {
      console.error("PiP error:", error);
      showToast("Picture-in-Picture not available");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k': e.preventDefault(); togglePlay(); break;
        case 'arrowleft': e.preventDefault(); handleSeek(-10); break;
        case 'arrowright': e.preventDefault(); handleSeek(10); break;
        case 'arrowup':
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            setIsMuted(newVol === 0);
            localStorage.setItem('nexusedu_volume', String(newVol));
            showVideoToast(`Volume ${Math.round(newVol * 100)}%`);
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            setIsMuted(newVol === 0);
            localStorage.setItem('nexusedu_volume', String(newVol));
            showVideoToast(`Volume ${Math.round(newVol * 100)}%`);
          }
          break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleSeek, toggleMute, toggleFullscreen]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', () => {
        if (isPlaying) setShowControls(false);
      });
    }
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', () => {});
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  const lastLocalSaveTimeRef = useRef<number>(0);
  const lastSupabaseSaveTimeRef = useRef<number>(0);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    if (onTimeUpdate) onTimeUpdate(time);

    if (videoRef.current.buffered.length > 0) {
      setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }

    if (Math.abs(time - lastLocalSaveTimeRef.current) >= 5) {
      lastLocalSaveTimeRef.current = time;
      setProgress(videoId, time);
    }
    
    if (user && actualDuration > 0 && Math.abs(time - lastSupabaseSaveTimeRef.current) >= 30) {
      lastSupabaseSaveTimeRef.current = time;
      const percent = Math.floor((time / actualDuration) * 100);
      saveProgress(user.id, videoId, percent).catch(console.error);
    }

    if (actualDuration > 5 && (time / actualDuration) > 0.85 && !isCompleted(videoId)) {
      setCompleted(videoId, true);
      if (onComplete) onComplete();
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        setActualDuration(dur);
      }
    }
  };

  const handleDurationChange = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full bg-black aspect-video group overflow-hidden rounded-xl shadow-lg"
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setShowControls(true); }}
        onError={(e) => {
          const vid = e.currentTarget;
          const code = vid.error?.code ?? 0;
          const codeMap: Record<number, string> = {
            1: 'ভিডিও লোড বাতিল করা হয়েছে।',
            2: 'নেটওয়ার্ক সমস্যায় ভিডিও লোড হয়নি।',
            3: 'ভিডিও ডিকোড করতে সমস্যা হয়েছে।',
            4: 'ব্যাকএন্ড সার্ভার প্রস্তুত নয়। ৩০ সেকেন্ড অপেক্ষা করে পুনরায় চেষ্টা করুন।',
          };
          const msg = codeMap[code] ?? 'ভিডিও লোড করতে অজানা সমস্যা হয়েছে।';
          setHasError(true);
          setErrorMessage(msg);
          setIsStarting(false);
          setHasStarted(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (hasStarted) togglePlay(); }}
      />

      {/* Initial Play Overlay */}
      {!hasStarted && !hasError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
          {isStarting ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-white font-semibold text-base bangla">
                {errorMessage || 'ভিডিও লোড হচ্ছে...'}
              </p>
            </div>
          ) : showResumePrompt ? (
            <div className="flex flex-col items-center bg-surface-card p-8 rounded-2xl shadow-xl max-w-sm w-full mx-4">
              <p className="text-text-primary font-bold text-xl mb-6 bangla text-center">
                আপনি আগে {formatTime(resumeTime)} পর্যন্ত দেখেছেন। এখান থেকেই শুরু করবেন?
              </p>
              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => { setShowResumePrompt(false); startVideo(resumeTime); }}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors bangla"
                >
                  হ্যাঁ, এখান থেকে শুরু করুন
                </button>
                <button 
                  onClick={() => { setShowResumePrompt(false); startVideo(0); }}
                  className="w-full py-3 bg-background-section text-text-primary rounded-xl font-semibold hover:bg-gray-100 transition-colors bangla"
                >
                  প্রথম থেকে শুরু করুন
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="flex flex-col items-center cursor-pointer group"
              onClick={() => {
                if (resumeTime > 0) setShowResumePrompt(true);
                else startVideo(0);
              }}
            >
              <div className="w-20 h-20 bg-primary/90 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300 shadow-lg shadow-primary/30">
                <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
              </div>
              <p className="text-white font-bold text-lg mb-2 bangla">
                ভিডিও প্লে করুন
              </p>
              {sizeMb > 0 && (
                <div className="text-white/60 text-sm bangla">
                  ফাইল সাইজ: {sizeMb.toFixed(1)} MB
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Overlay */}
      {hasError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <WakeUpCountdown onRetry={() => {
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.removeAttribute('src');
              videoRef.current.load();
            }
            try {
              localStorage.removeItem('working_backend');
              localStorage.removeItem('working_backend_time');
            } catch { /* ignore */ }
            setHasError(false);
            setHasStarted(false);
            setIsStarting(false);
            setErrorMessage('');
          }} />
        </div>
      )}

      {/* Loading Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Center Toast */}
      {toastMessage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 text-white px-4 py-2 rounded-full text-lg font-medium animate-fade-in">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 px-4 pb-4 pt-12 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div 
          ref={progressRef}
          className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer relative group/progress mb-4"
          onClick={handleProgressClick}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
            style={{ width: `${(buffered / duration) * 100}%` }}
          />
          <div 
            className="absolute top-0 left-0 h-full bg-primary rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform shadow-md" />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-primary transition-colors">
              {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6" fill="currentColor" />}
            </button>
            
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="hover:text-primary transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-300 accent-primary"
              />
            </div>

            <div className="text-sm font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg overflow-hidden border border-white/10 flex flex-col-reverse">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => changeSpeed(speed)}
                      className={`px-4 py-2 text-sm text-left hover:bg-white/10 transition-colors ${playbackSpeed === speed ? 'text-primary font-bold' : 'text-white'}`}
                    >
                      {speed === 1 ? 'Normal' : `${speed}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={togglePiP} className="hover:text-primary transition-colors" title="Picture in Picture">
              <PictureInPicture className="w-5 h-5" />
            </button>
            
            <button onClick={toggleFullscreen} className="hover:text-primary transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
