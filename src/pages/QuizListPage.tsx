import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Clock, HelpCircle, Trophy, PlayCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';

export function QuizListPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuizzes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*, questions(count)')
        .eq('chapter_id', chapterId)
        .eq('is_published', true)
        .order('display_order', { ascending: true });

      if (quizError) throw quizError;
      setQuizzes(quizData || []);

      if (user && quizData && quizData.length > 0) {
        const { data: attemptData, error: attemptError } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('user_id', user.id)
          .in('quiz_id', quizData.map(q => q.id));

        if (attemptError && attemptError.code !== 'PGRST116') throw attemptError;

        const attemptMap: Record<string, any> = {};
        attemptData?.forEach(a => {
          if (!attemptMap[a.quiz_id] || a.score > attemptMap[a.quiz_id].score) {
            attemptMap[a.quiz_id] = a;
          }
        });
        setAttempts(attemptMap);
      }

    } catch (error: any) {
      if (error.code !== 'PGRST205') {
        console.error('Error fetching quizzes:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [chapterId, user]);

  useEffect(() => {
    if (chapterId) {
      fetchQuizzes();
    }
  }, [chapterId, fetchQuizzes]);

  if (isLoading) {
    return (
      <StudentLayout>
        <SEO title="কুইজ | NexusEdu" />
        <div className="max-w-3xl mx-auto p-4 space-y-4 mt-8">
          <Skeleton className="h-12 w-3/4 mb-8 rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <SEO title="কুইজ | NexusEdu" />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors bangla"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ফিরে যান</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 bangla">অধ্যায়ের কুইজসমূহ</h1>
            <p className="text-sm text-gray-500 bangla">আপনার প্রস্তুতি যাচাই করুন</p>
          </div>
        </div>

        {quizzes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2 bangla">কোনো কুইজ নেই</h2>
            <p className="text-gray-500 bangla">এই অধ্যায়ে এখনও কোনো কুইজ যোগ করা হয়নি।</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map(quiz => {
              const attempt = attempts[quiz.id];
              const questionCount = quiz.questions?.[0]?.count || 0;
              
              return (
                <div key={quiz.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-indigo-200 transition-colors">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 bangla">{quiz.title}</h3>
                  
                  <div className="flex flex-wrap gap-4 mb-5 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md">
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                      <span className="bangla">{questionCount} টি প্রশ্ন</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="bangla">{quiz.time_limit_minutes} মিনিট</span>
                    </div>
                    {attempt && attempt.status === 'submitted' && (
                      <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md font-medium">
                        <Trophy className="w-4 h-4" />
                        <span className="bangla">সর্বোচ্চ স্কোর: {attempt.score}/{quiz.total_marks}</span>
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bangla"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {attempt && attempt.status === 'submitted' ? 'আবার শুরু করুন' : 'শুরু করুন'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
