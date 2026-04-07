import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, PlayCircle, ChevronRight } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { useVideoProgress } from '../hooks/useVideoProgress';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentLayout } from '../components/layout/StudentLayout';
import { VideoCard } from '../components/shared/VideoCard';
import { SEO } from '../components/SEO';

export function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { catalog, isLoading } = useCatalog();
  const { isCompleted, getProgress } = useVideoProgress();

  const subject = useMemo(() => {
    return catalog?.subjects.find((s: any) => s.id === subjectId);
  }, [catalog, subjectId]);

  const [selectedCycleIdState, setSelectedCycleIdState] = useState<string | null>(null);
  const [selectedChapterIdState, setSelectedChapterIdState] = useState<string | null>(null);

  const selectedCycleId = selectedCycleIdState || (subject?.cycles?.[0]?.id ?? null);
  
  const selectedCycle = useMemo(() => {
    if (!subject || !selectedCycleId) return null;
    return subject.cycles.find((c: any) => c.id === selectedCycleId) || null;
  }, [subject, selectedCycleId]);

  const selectedChapterId = selectedChapterIdState || (selectedCycle?.chapters?.[0]?.id ?? null);

  const setSelectedCycleId = (id: string) => {
    setSelectedCycleIdState(id);
    setSelectedChapterIdState(null); // Reset chapter when cycle changes
  };
  
  const setSelectedChapterId = (id: string) => {
    setSelectedChapterIdState(id);
  };

  if (isLoading) {
    return (
      <StudentLayout>
        <SEO title="লোড হচ্ছে... | NexusEdu" />
        <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
            <div className="md:col-span-3"><Skeleton className="h-full w-full rounded-xl" /></div>
            <div className="md:col-span-3"><Skeleton className="h-full w-full rounded-xl" /></div>
            <div className="md:col-span-6"><Skeleton className="h-full w-full rounded-xl" /></div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (!subject) {
    return (
      <StudentLayout>
        <SEO title="বিষয় পাওয়া যায়নি | NexusEdu" />
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <h2 className="bangla text-2xl font-bold text-gray-900 mb-2">বিষয় পাওয়া যায়নি</h2>
          <p className="bangla text-gray-600 mb-6">আপনি যে বিষয়টি খুঁজছেন তা পাওয়া যায়নি।</p>
          <button 
            onClick={() => navigate('/courses')}
            className="bangla px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            কোর্সে ফিরে যান
          </button>
        </div>
      </StudentLayout>
    );
  }

  const selectedChapter = selectedCycle?.chapters.find((ch: any) => ch.id === selectedChapterId);

  return (
    <StudentLayout>
      <SEO title={`${subject.name} | NexusEdu`} />
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
        <div className="mb-4 flex items-center gap-4 shrink-0">
          <button 
            onClick={() => navigate('/courses')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="bangla text-2xl font-bold text-gray-900">{subject.name}</h1>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
          {/* Panel 1: Cycles */}
          <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-slate-50 shrink-0">
              <h2 className="font-bold text-gray-900 bangla flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                সাইকেলসমূহ
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {subject.cycles.length === 0 ? (
                <p className="p-4 text-center text-gray-500 bangla text-sm">কোনো সাইকেল নেই</p>
              ) : (
                subject.cycles.map((cycle: any) => (
                  <button
                    key={cycle.id}
                    onClick={() => {
                      setSelectedCycleId(cycle.id);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors bangla text-sm font-medium flex items-center justify-between group ${
                      selectedCycleId === cycle.id 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate pr-2">{cycle.name}</span>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedCycleId === cycle.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Panel 2: Chapters */}
          <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-slate-50 shrink-0">
              <h2 className="font-bold text-gray-900 bangla flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                চ্যাপ্টারসমূহ
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {!selectedCycle ? (
                <p className="p-4 text-center text-gray-500 bangla text-sm">সাইকেল নির্বাচন করুন</p>
              ) : selectedCycle.chapters.length === 0 ? (
                <p className="p-4 text-center text-gray-500 bangla text-sm">কোনো চ্যাপ্টার নেই</p>
              ) : (
                selectedCycle.chapters.map((chapter: any) => (
                  <button
                    key={chapter.id}
                    onClick={() => setSelectedChapterId(chapter.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors bangla text-sm font-medium flex items-center justify-between group ${
                      selectedChapterId === chapter.id 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate pr-2">{chapter.name}</span>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedChapterId === chapter.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Panel 3: Videos */}
          <div className="md:col-span-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-slate-50 shrink-0 flex justify-between items-center">
              <h2 className="font-bold text-gray-900 bangla flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-indigo-600" />
                ভিডিও ক্লাস
              </h2>
              {selectedChapter && (
                <span className="text-sm text-gray-500 bangla font-medium bg-white px-2.5 py-1 rounded-full border border-gray-200">
                  {selectedChapter.videos.length}টি ক্লাস
                </span>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {!selectedChapter ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <PlayCircle className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="bangla text-center">ভিডিও দেখতে চ্যাপ্টার নির্বাচন করুন</p>
                </div>
              ) : selectedChapter.videos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <p className="bangla text-center">এই চ্যাপ্টারে কোনো ভিডিও নেই</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedChapter.videos.map((video: any) => {
                    const progress = getProgress(video.id);
                    const durationStr = video.duration || '00:00:00';
                    const timeParts = durationStr.split(':').map(Number);
                    let durationSecs = 0;
                    if (timeParts.length === 3) durationSecs = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                    else if (timeParts.length === 2) durationSecs = timeParts[0] * 60 + timeParts[1];
                    
                    const percent = durationSecs > 0 ? Math.min(100, Math.round((progress / durationSecs) * 100)) : 0;

                    return (
                      <VideoCard
                        key={video.id}
                        video={video}
                        watchPercent={percent}
                        isWatched={isCompleted(video.id)}
                        onClick={() => navigate(`/watch/${video.id}`)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
