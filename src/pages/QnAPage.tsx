import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle, Plus, Search, CheckCircle, Clock, Image as ImageIcon, Loader2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCatalog } from '../contexts/CatalogContext';
import { Skeleton } from '../components/ui/Skeleton';
import { motion } from 'framer-motion';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';

export function QnAPage() {
  const { user } = useAuth();
  const { catalog } = useCatalog();
  const [searchParams] = useSearchParams();
  const videoIdParam = searchParams.get('video');
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  
  // Filters
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Question Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState(videoIdParam || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Pre-fill chapter if video is provided
  useEffect(() => {
    if (videoIdParam && catalog) {
      for (const subject of catalog.subjects) {
        for (const cycle of subject.cycles) {
          for (const chapter of cycle.chapters) {
            if (chapter.videos.some((v: any) => v.id === videoIdParam)) {
              setSelectedChapterId(chapter.id);
              setShowNewModal(true);
              break;
            }
          }
        }
      }
    }
  }, [videoIdParam, catalog]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchQuestions(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, videoIdParam]);

  const fetchQuestions = async (pageNumber: number) => {
    if (pageNumber === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      let query = supabase
        .from('questions_forum')
        .select(`
          *,
          profiles:user_id (full_name, avatar_url),
          answers:forum_answers(count)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

      if (filter === 'resolved') {
        query = query.eq('is_resolved', true);
      } else if (filter === 'unresolved') {
        query = query.eq('is_resolved', false);
      }
      
      if (videoIdParam) {
        query = query.eq('video_id', videoIdParam);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        if (pageNumber === 0) {
          setQuestions(data);
        } else {
          setQuestions(prev => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchQuestions(nextPage);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const imageUrl = await api.uploadImage(file);
      setNewBody(prev => prev + `\n\n![Image](${imageUrl})\n`);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || !newBody.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('questions_forum')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          body: newBody.trim(),
          chapter_id: selectedChapterId || null,
          video_id: selectedVideoId || null
        });

      if (error) throw error;
      
      setShowNewModal(false);
      setNewTitle('');
      setNewBody('');
      setSelectedChapterId('');
      setSelectedVideoId('');
      setPage(0);
      fetchQuestions(0);
    } catch (error) {
      console.error('Error submitting question:', error);
      alert('Failed to submit question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to get all chapters for dropdown
  const allChapters = catalog?.subjects.flatMap(s => s.cycles).flatMap(c => c.chapters) || [];
  const selectedChapter = allChapters.find(c => c.id === selectedChapterId);
  const chapterVideos = selectedChapter?.videos || [];

  return (
    <StudentLayout>
      <SEO title="প্রশ্নোত্তর | NexusEdu" description="NexusEdu Q&A Forum" />
      
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="bangla text-2xl font-bold text-gray-900">প্রশ্নোত্তর ফোরাম</h1>
                <p className="bangla text-gray-500">আপনার প্রশ্ন করুন এবং অন্যদের সাহায্য করুন</p>
              </div>
            </div>
            <button 
              onClick={() => setShowNewModal(true)} 
              className="bangla flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>নতুন প্রশ্ন করুন</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="প্রশ্ন খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bangla w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar shrink-0">
              <button
                onClick={() => setFilter('all')}
                className={`bangla px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                সকল প্রশ্ন
              </button>
              <button
                onClick={() => setFilter('unresolved')}
                className={`bangla px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'unresolved' ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                অমীমাংসিত
              </button>
              <button
                onClick={() => setFilter('resolved')}
                className={`bangla px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'resolved' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                সমাধান হয়েছে
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div>
                      <Skeleton className="w-32 h-4 mb-2" />
                      <Skeleton className="w-24 h-3" />
                    </div>
                  </div>
                  <Skeleton className="w-3/4 h-6 mb-3" />
                  <Skeleton className="w-full h-4 mb-2" />
                  <Skeleton className="w-2/3 h-4" />
                </div>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-indigo-300" />
              </div>
              <h3 className="bangla text-xl font-bold text-gray-900 mb-2">কোনো প্রশ্ন পাওয়া যায়নি</h3>
              <p className="bangla text-gray-500 mb-6">প্রথম প্রশ্নটি আপনিই করুন এবং আলোচনা শুরু করুন!</p>
              <button 
                onClick={() => setShowNewModal(true)} 
                className="bangla px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                নতুন প্রশ্ন করুন
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((q) => (
                <Link 
                  key={q.id} 
                  to={`/qna/${q.id}`}
                  className="block bg-white p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-50 flex items-center justify-center overflow-hidden shrink-0 border border-indigo-100">
                        {q.profiles?.avatar_url ? (
                          <img src={q.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                        )}
                      </div>
                      <div>
                        <p className="bangla text-sm font-bold text-gray-900 line-clamp-1">
                          {q.profiles?.full_name || 'অজানা ব্যবহারকারী'}
                        </p>
                        <p className="bangla text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(q.created_at).toLocaleDateString('bn-BD')}
                        </p>
                      </div>
                    </div>
                    {q.is_resolved && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0 border border-emerald-100">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline bangla">সমাধান হয়েছে</span>
                      </span>
                    )}
                  </div>

                  <h3 className="bangla text-lg sm:text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {q.is_pinned && '📌 '}{q.title}
                  </h3>
                  
                  <p className="bangla text-sm text-gray-600 line-clamp-2 mb-4">
                    {q.body}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                    <span className="bangla flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                      <MessageCircle className="w-4 h-4 text-indigo-400" />
                      <span className="font-medium">{q.answers?.[0]?.count || 0}</span> উত্তর
                    </span>
                    <span className="bangla flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span className="font-medium">{q.upvotes || 0}</span> ভোট
                    </span>
                    {q.chapter_id && (
                      <span className="bangla px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 text-xs font-medium">
                        {allChapters.find(c => c.id === q.chapter_id)?.name || 'অধ্যায়'}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              
              {hasMore && (
                <div className="flex justify-center pt-6">
                  <button 
                    onClick={loadMore} 
                    disabled={isLoadingMore}
                    className="bangla px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    আরও দেখুন
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Question Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="bangla text-xl font-bold text-gray-900">নতুন প্রশ্ন করুন</h2>
              <button 
                onClick={() => setShowNewModal(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitQuestion} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="bangla block text-sm font-bold text-gray-700 mb-1.5">অধ্যায় (ঐচ্ছিক)</label>
                  <select
                    value={selectedChapterId}
                    onChange={e => {
                      setSelectedChapterId(e.target.value);
                      setSelectedVideoId('');
                    }}
                    className="bangla w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors"
                  >
                    <option value="">অধ্যায় নির্বাচন করুন</option>
                    {allChapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="bangla block text-sm font-bold text-gray-700 mb-1.5">ভিডিও (ঐচ্ছিক)</label>
                  <select
                    value={selectedVideoId}
                    onChange={e => setSelectedVideoId(e.target.value)}
                    disabled={!selectedChapterId}
                    className="bangla w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">ভিডিও নির্বাচন করুন</option>
                    {chapterVideos.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="bangla block text-sm font-bold text-gray-700 mb-1.5">প্রশ্নের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="আপনার প্রশ্নটি সংক্ষেপে লিখুন..."
                  className="bangla w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="bangla block text-sm font-bold text-gray-700">বিস্তারিত *</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-mono">Markdown supported</span>
                    <label className={`cursor-pointer flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-lg transition-colors ${isUploadingImage ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                      {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      <span className="bangla">ছবি যোগ করুন</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                      />
                    </label>
                  </div>
                </div>
                <textarea
                  required
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  placeholder="আপনার প্রশ্নটি বিস্তারিতভাবে লিখুন..."
                  rows={6}
                  className="bangla w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowNewModal(false)}
                  className="bangla px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bangla px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  পোস্ট করুন
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </StudentLayout>
  );
}
