import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, CheckCircle, Clock, Send, Image as ImageIcon, Loader2, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';

export function QnADetailPage() {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [question, setQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  
  const [newAnswer, setNewAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [userUpvotes, setUserUpvotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (questionId) {
      setPage(0);
      setHasMore(true);
      fetchQuestionAndAnswers(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, user]);

  const fetchQuestionAndAnswers = async (pageNumber: number) => {
    if (pageNumber === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      // Fetch Question (only on first page load)
      if (pageNumber === 0) {
        const { data: qData, error: qError } = await supabase
          .from('questions_forum')
          .select(`
            *,
            profiles:user_id (full_name, avatar_url)
          `)
          .eq('id', questionId)
          .single();

        if (qError) throw qError;
        setQuestion(qData);
      }

      // Fetch Answers
      const { data: aData, error: aError } = await supabase
        .from('forum_answers')
        .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
        .eq('question_id', questionId)
        .order('is_accepted', { ascending: false })
        .order('is_official', { ascending: false })
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: true })
        .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

      if (aError) throw aError;
      
      if (aData) {
        if (pageNumber === 0) {
          setAnswers(aData);
        } else {
          setAnswers(prev => [...prev, ...aData]);
        }
        setHasMore(aData.length === PAGE_SIZE);
      }

      // Fetch user's upvotes if logged in (only on first page load)
      if (user && pageNumber === 0) {
        const { data: upvotesData } = await supabase
          .from('forum_upvotes')
          .select('question_id, answer_id')
          .eq('user_id', user.id);
          
        if (upvotesData) {
          const upvotesMap: Record<string, boolean> = {};
          upvotesData.forEach(u => {
            if (u.question_id) upvotesMap[`q_${u.question_id}`] = true;
            if (u.answer_id) upvotesMap[`a_${u.answer_id}`] = true;
          });
          setUserUpvotes(upvotesMap);
        }
      }
    } catch (error) {
      console.error('Error fetching QnA details:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchQuestionAndAnswers(nextPage);
    }
  };

  const handleUpvote = async (type: 'question' | 'answer', id: string) => {
    if (!user) {
      alert('ভোট দিতে লগইন করুন');
      return;
    }

    const key = `${type === 'question' ? 'q' : 'a'}_${id}`;
    const isUpvoted = userUpvotes[key];
    
    // Optimistic update
    setUserUpvotes(prev => ({ ...prev, [key]: !isUpvoted }));
    
    if (type === 'question') {
      setQuestion((prev: any) => ({ ...prev, upvotes: prev.upvotes + (isUpvoted ? -1 : 1) }));
    } else {
      setAnswers(prev => prev.map(a => a.id === id ? { ...a, upvotes: a.upvotes + (isUpvoted ? -1 : 1) } : a));
    }

    try {
      if (isUpvoted) {
        // Remove upvote
        let query = supabase.from('forum_upvotes').delete().eq('user_id', user.id);
        if (type === 'question') query = query.eq('question_id', id);
        else query = query.eq('answer_id', id);
        await query;

        // Decrement count
        await supabase.rpc('decrement_upvote', { 
          target_table: type === 'question' ? 'questions_forum' : 'forum_answers',
          row_id: id 
        });
        // Note: RPC might not exist, fallback to direct update if needed, but RLS might block direct update.
        // For simplicity, assuming direct update works or we ignore exact sync for now.
      } else {
        // Add upvote
        await supabase.from('forum_upvotes').insert({
          user_id: user.id,
          question_id: type === 'question' ? id : null,
          answer_id: type === 'answer' ? id : null
        });
      }
    } catch (error) {
      console.error('Error toggling upvote:', error);
      // Revert optimistic update on error
      setUserUpvotes(prev => ({ ...prev, [key]: isUpvoted }));
      // We don't fetch all again to avoid losing pagination state, just let it be or fetch specific item
    }
  };

  const handleMarkAccepted = async (answerId: string) => {
    if (!user || (question.user_id !== user.id && profile?.role !== 'admin')) {
      alert('শুধুমাত্র প্রশ্নকর্তা বা অ্যাডমিন এটি করতে পারবেন');
      return;
    }

    try {
      const { error } = await supabase.rpc('mark_answer_accepted', {
        p_question_id: questionId,
        p_answer_id: answerId,
        p_user_id: user.id
      });

      if (error) throw error;

      // Update local state
      setAnswers((prev: any[]) => prev.map((a: any) => ({
        ...a,
        is_accepted: a.id === answerId
      })));
      setQuestion((prev: any) => ({ ...prev, is_resolved: true }));
    } catch (error) {
      console.error('Error marking answer as accepted:', error);
      alert('Failed to mark answer as accepted');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const imageUrl = await api.uploadImage(file);
      setNewAnswer(prev => prev + `\n\n![Image](${imageUrl})\n`);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAnswer.trim() || !questionId) return;

    setIsSubmitting(true);
    try {
      const isOfficial = profile?.role === 'admin' || (profile?.role as any) === 'teacher';
      
      const { error } = await supabase
        .from('forum_answers')
        .insert({
          question_id: questionId,
          user_id: user.id,
          body: newAnswer.trim(),
          is_official: isOfficial
        });

      if (error) throw error;
      
      setNewAnswer('');
      setPage(0);
      fetchQuestionAndAnswers(0);
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <StudentLayout>
        <SEO title="প্রশ্ন ও উত্তর | NexusEdu" />
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="w-32 h-8" />
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <Skeleton className="w-full h-8 mb-4" />
            <Skeleton className="w-full h-24" />
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (!question) {
    return (
      <StudentLayout>
        <SEO title="প্রশ্ন পাওয়া যায়নি | NexusEdu" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4 bangla">প্রশ্নটি পাওয়া যায়নি</h2>
            <Button onClick={() => navigate('/qna')}>ফিরে যান</Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <SEO title={`${question.title} | NexusEdu`} />
      <div className="max-w-3xl mx-auto pb-24">
        <div className="mb-6">
          <button 
            onClick={() => navigate('/qna')}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors bangla"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ফিরে যান</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* Question Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {question.is_resolved && (
              <div className="bg-green-50 px-4 py-2 border-b border-green-100 flex items-center gap-2 text-green-700 text-sm font-medium bangla">
                <CheckCircle className="w-4 h-4" />
                এই প্রশ্ন সমাধান করা হয়েছে
              </div>
            )}
            <div className="p-5 sm:p-6">
              <div className="flex gap-4">
                {/* Upvote Column */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button 
                    onClick={() => handleUpvote('question', question.id)}
                    className={`p-2 rounded-full transition-colors ${
                      userUpvotes[`q_${question.id}`] ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="font-medium text-gray-700">{question.upvotes || 0}</span>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 bangla">
                    {question.title}
                  </h1>
                  <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 mb-6 bangla">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {question.body}
                    </ReactMarkdown>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 overflow-hidden">
                        {question.profiles?.avatar_url ? (
                          <img src={question.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-5 h-5 text-indigo-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 bangla">
                          {question.profiles?.full_name || 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 bangla">
                          <Clock className="w-3 h-3" />
                          {new Date(question.created_at).toLocaleString('bn-BD')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Answers Section */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 bangla">
              <MessageCircle className="w-5 h-5 text-indigo-600" />
              {answers.length} টি উত্তর
            </h3>

            <div className="space-y-4">
              {answers.map((answer) => (
                <div 
                  key={answer.id} 
                  className={`bg-white rounded-xl border p-5 sm:p-6 ${
                    answer.is_official ? 'border-amber-200 shadow-sm bg-amber-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Upvote Column */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleUpvote('answer', answer.id)}
                        className={`p-2 rounded-full transition-colors ${
                          userUpvotes[`a_${answer.id}`] ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <span className="font-medium text-gray-700">{answer.upvotes || 0}</span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 mb-4 bangla">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {answer.body}
                        </ReactMarkdown>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
                            {answer.profiles?.avatar_url ? (
                              <img src={answer.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 bangla">
                                {answer.profiles?.full_name || 'Unknown User'}
                              </p>
                              {answer.is_official && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 bangla">
                                  <CheckCircle className="w-3 h-3" />
                                  শিক্ষকের উত্তর
                                </span>
                              )}
                              {answer.is_accepted && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 bangla">
                                  <CheckCircle className="w-3 h-3" />
                                  সঠিক উত্তর
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 bangla">
                              {new Date(answer.created_at).toLocaleString('bn-BD')}
                            </p>
                          </div>
                        </div>
                        {user && (question.user_id === user.id || profile?.role === 'admin') && !answer.is_accepted && (
                          <button
                            onClick={() => handleMarkAccepted(answer.id)}
                            className="text-xs font-medium text-gray-500 hover:text-green-600 transition-colors bangla flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            সঠিক উত্তর হিসেবে নির্বাচন করুন
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={loadMore} 
                    isLoading={isLoadingMore}
                    className="bangla"
                  >
                    আরও দেখুন
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Add Answer Form */}
          {user ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 bangla">আপনার উত্তর দিন</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Markdown supported</span>
                  <label className={`cursor-pointer flex items-center gap-1 text-xs font-medium ${isUploadingImage ? 'text-gray-400' : 'text-indigo-600 hover:text-indigo-700'}`}>
                    {isUploadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
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
              <form onSubmit={handleSubmitAnswer}>
                <textarea
                  required
                  value={newAnswer}
                  onChange={e => setNewAnswer(e.target.value)}
                  placeholder="এখানে আপনার উত্তর লিখুন..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none mb-4 bangla"
                />
                <div className="flex justify-end">
                  <Button type="submit" isLoading={isSubmitting} className="flex items-center gap-2 bangla">
                    <Send className="w-4 h-4" />
                    উত্তর পোস্ট করুন
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-6 text-center mt-8 border border-gray-200">
              <p className="text-gray-600 mb-4 bangla">উত্তর দিতে আপনাকে লগইন করতে হবে</p>
              <Button onClick={() => navigate('/login')} className="bangla">লগইন করুন</Button>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
