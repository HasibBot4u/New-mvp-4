import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { motion } from 'framer-motion';
import { SEO } from '../components/SEO';

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (user && quizId) {
      fetchQuizData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, quizId]);

  useEffect(() => {
    if (timeLeft === null || attempt?.status === 'submitted') return;
    
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev !== null ? prev - 1 : null);
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, attempt]);

  const fetchQuizData = async () => {
    setIsLoading(true);
    try {
      // Fetch quiz details
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
        
      if (quizError) throw quizError;
      setQuiz(quizData);

      // Check for existing attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(1);

      if (attemptError && attemptError.code !== 'PGRST116') throw attemptError;

      let currentAttempt = attemptData?.[0];

      if (!currentAttempt || currentAttempt.status === 'submitted') {
        // Create new attempt
        const { data: newAttempt, error: newAttemptError } = await supabase
          .from('quiz_attempts')
          .insert({
            quiz_id: quizId,
            user_id: user!.id,
            status: 'in_progress'
          })
          .select()
          .single();
          
        if (newAttemptError) throw newAttemptError;
        currentAttempt = newAttempt;
      }

      setAttempt(currentAttempt);

      if (currentAttempt.status === 'in_progress') {
        // Calculate time left
        const startedAt = new Date(currentAttempt.started_at).getTime();
        const now = new Date().getTime();
        const elapsedSeconds = Math.floor((now - startedAt) / 1000);
        const timeLimitSeconds = (quizData.time_limit_minutes || 15) * 60;
        const remaining = Math.max(0, timeLimitSeconds - elapsedSeconds);
        setTimeLeft(remaining);
      }

      // Fetch questions and options
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          *,
          options:question_options(*)
        `)
        .eq('quiz_id', quizId)
        .order('display_order', { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // If completed, fetch answers
      if (currentAttempt.status === 'submitted') {
        const { data: answersData, error: answersError } = await supabase
          .from('quiz_answers')
          .select('*')
          .eq('attempt_id', currentAttempt.id);
          
        if (answersError) throw answersError;
        
        const answersMap: Record<string, string> = {};
        answersData?.forEach(a => {
          answersMap[a.question_id] = a.selected_option_id;
        });
        setAnswers(answersMap);
      }

    } catch (error: any) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Ignore missing table error gracefully
      } else {
        console.error('Error fetching quiz:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (questionId: string, optionId: string) => {
    if (attempt?.status === 'submitted') return;
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const toggleMarkForReview = (questionId: string) => {
    if (attempt?.status === 'submitted') return;
    setMarkedForReview(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleSubmit = async () => {
    if (!attempt || attempt.status === 'submitted' || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Calculate score
      let score = 0;
      const answersToInsert = [];
      const negativePerWrong = quiz.negative_per_wrong || 0;

      for (const q of questions) {
        const selectedOptionId = answers[q.id];
        if (selectedOptionId) {
          const selectedOption = q.options.find((o: any) => o.id === selectedOptionId);
          if (selectedOption?.is_correct) {
            score += q.marks || 1;
          } else {
            score -= negativePerWrong;
          }
          answersToInsert.push({
            attempt_id: attempt.id,
            question_id: q.id,
            selected_option_id: selectedOptionId
          });
        }
      }

      // Insert answers
      if (answersToInsert.length > 0) {
        const { error: answersError } = await supabase
          .from('quiz_answers')
          .insert(answersToInsert);
        if (answersError) throw answersError;
      }

      // Calculate time taken
      const startedAt = new Date(attempt.started_at).getTime();
      const now = new Date().getTime();
      const timeTakenSeconds = Math.floor((now - startedAt) / 1000);

      // Update attempt
      const { data: updatedAttempt, error: updateError } = await supabase
        .from('quiz_attempts')
        .update({
          status: 'submitted',
          score: score,
          time_taken_seconds: timeTakenSeconds,
          submitted_at: new Date().toISOString()
        })
        .eq('id', attempt.id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      setAttempt(updatedAttempt);
      setTimeLeft(null);
      navigate(`/quiz/${quizId}/result/${attempt.id}`);
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <SEO title="কুইজ লোড হচ্ছে... | NexusEdu" />
        <div className="h-16 bg-indigo-600" />
        <div className="max-w-3xl mx-auto p-4 space-y-4 mt-8">
          <Skeleton className="h-12 w-3/4 mb-8 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <SEO title="কুইজ পাওয়া যায়নি | NexusEdu" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2 bangla">কুইজ পাওয়া যায়নি</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl bangla">ফিরে যান</button>
      </div>
    );
  }

  const isCompleted = attempt?.status === 'submitted';
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-50 pb-24 flex flex-col"
    >
      <SEO title={`${quiz.title} | NexusEdu`} />
      <header className="bg-indigo-600 text-white h-16 flex items-center px-4 sticky top-0 z-30 shadow-md shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors mr-3">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium truncate bangla">{quiz.title}</h1>
        
        {!isCompleted && timeLeft !== null && (
          <div className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-sm font-bold ${timeLeft < 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-white/20'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 flex flex-col md:flex-row gap-6 mt-4">
        {/* Left column: Question Navigation Grid */}
        <div className="w-full md:w-72 shrink-0 order-2 md:order-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4 bangla">প্রশ্নসমূহ</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isMarked = markedForReview[q.id];
                const isCurrent = idx === currentQuestionIndex;
                
                let btnClass = "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100";
                if (isCurrent) {
                  btnClass = "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30";
                } else if (isMarked) {
                  btnClass = "bg-amber-100 text-amber-700 border-amber-300";
                } else if (isAnswered) {
                  btnClass = "bg-green-100 text-green-700 border-green-300";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center font-medium text-sm transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-6 space-y-3 text-xs text-gray-600 bangla">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div> উত্তর দেওয়া হয়েছে</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div> রিভিউ এর জন্য মার্ক করা</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div> উত্তর দেওয়া হয়নি</div>
            </div>

            {!isCompleted && (
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full mt-6 bangla"
              >
                {isSubmitting ? 'জমা দেওয়া হচ্ছে...' : 'কুইজ জমা দিন'}
              </Button>
            )}
          </div>
        </div>

        {/* Right column: Current Question */}
        <div className="flex-1 order-1 md:order-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 text-lg">
                  {currentQuestionIndex + 1}
                </div>
                <div>
                  <h3 className="text-xl font-medium text-gray-900 leading-relaxed bangla">
                    {currentQuestion.question_text}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2 bangla">
                    মান: {currentQuestion.marks || 1} | নেগেটিভ: {quiz.negative_per_wrong || 0}
                  </p>
                </div>
              </div>
              
              {!isCompleted && (
                <button 
                  onClick={() => toggleMarkForReview(currentQuestion.id)}
                  className={`p-2 rounded-full transition-colors shrink-0 ${markedForReview[currentQuestion.id] ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  title="রিভিউ এর জন্য মার্ক করুন"
                >
                  <Flag className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-3 pl-14">
              {currentQuestion.options.map((opt: any) => {
                const isSelected = answers[currentQuestion.id] === opt.id;
                let optionClass = "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50";
                
                if (isSelected) {
                  optionClass = "border-indigo-600 bg-indigo-50 text-indigo-700";
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionSelect(currentQuestion.id, opt.id)}
                    disabled={isCompleted}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${optionClass}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-lg bangla">{opt.option_text}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="gap-2 bangla"
              >
                <ChevronLeft className="w-4 h-4" /> পূর্ববর্তী
              </Button>
              
              <Button 
                onClick={() => {
                  if (currentQuestionIndex < questions.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                  } else {
                    handleSubmit();
                  }
                }}
                className="gap-2 bangla"
              >
                {currentQuestionIndex < questions.length - 1 ? (
                  <>পরবর্তী <ChevronRight className="w-4 h-4" /></>
                ) : (
                  'কুইজ জমা দিন'
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
