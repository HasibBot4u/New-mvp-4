import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';

export function QuizResultPage() {
  const { quizId, attemptId } = useParams<{ quizId: string, attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && quizId && attemptId) {
      fetchResultData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, quizId, attemptId]);

  const fetchResultData = async () => {
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

      // Fetch attempt details
      const { data: attemptData, error: attemptError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;
      
      // Calculate rank dynamically
      const { count: higherScoresCount } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .eq('status', 'submitted')
        .gt('score', attemptData.score);
        
      const { count: sameScoreFasterCount } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .eq('status', 'submitted')
        .eq('score', attemptData.score)
        .lt('time_taken_seconds', attemptData.time_taken_seconds);

      const calculatedRank = (higherScoresCount || 0) + (sameScoreFasterCount || 0) + 1;
      
      setAttempt({ ...attemptData, calculatedRank });

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

      // Fetch answers
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('attempt_id', attemptId);
        
      if (answersError) throw answersError;
      
      const answersMap: Record<string, string> = {};
      answersData?.forEach(a => {
        answersMap[a.question_id] = a.selected_option_id;
      });
      setAnswers(answersMap);

    } catch (error: any) {
      console.error('Error fetching result:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <StudentLayout>
        <SEO title="ফলাফল লোড হচ্ছে... | NexusEdu" />
        <div className="max-w-3xl mx-auto p-4 space-y-4 mt-8">
          <Skeleton className="h-48 w-full rounded-2xl mb-8" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </StudentLayout>
    );
  }

  if (!quiz || !attempt) {
    return (
      <StudentLayout>
        <SEO title="ফলাফল পাওয়া যায়নি | NexusEdu" />
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 bangla">ফলাফল পাওয়া যায়নি</h2>
          <button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl bangla">ফিরে যান</button>
        </div>
      </StudentLayout>
    );
  }

  const isPassed = attempt.score >= (quiz.pass_marks || 0);
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).length;
  const skippedQuestions = totalQuestions - answeredQuestions;
  
  let correctCount = 0;
  let wrongCount = 0;
  
  questions.forEach(q => {
    const selectedOptionId = answers[q.id];
    if (selectedOptionId) {
      const selectedOption = q.options.find((o: any) => o.id === selectedOptionId);
      if (selectedOption?.is_correct) {
        correctCount++;
      } else {
        wrongCount++;
      }
    }
  });

  const percentage = Math.max(0, Math.min(100, Math.round((attempt.score / quiz.total_marks) * 100))) || 0;

  return (
    <StudentLayout>
      <SEO title={`ফলাফল: ${quiz.title} | NexusEdu`} />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="mb-6">
          <button 
            onClick={() => navigate(`/chapter/${quiz.chapter_id}/quizzes`)}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors bangla"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>কুইজ তালিকায় ফিরে যান</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 bangla">ফলাফল: {quiz.title}</h1>
            <p className="text-sm text-gray-500 bangla">আপনার কুইজের বিস্তারিত ফলাফল</p>
          </div>
        </div>

        {/* Score Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 mb-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 to-blue-400" />
          
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 border-gray-50 mb-6 relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="46" fill="none" 
                stroke={isPassed ? "#22c55e" : "#ef4444"} 
                strokeWidth="8" 
                strokeDasharray={`${percentage * 2.89} 289`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="text-center">
              <span className="text-3xl font-bold text-gray-900">{attempt.score}</span>
              <span className="text-sm text-gray-500 block">/ {quiz.total_marks}</span>
            </div>
          </div>

          <h2 className={`text-2xl font-bold mb-2 bangla ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
            {isPassed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'}
          </h2>
          
          {attempt.calculatedRank > 0 && (
            <p className="text-gray-500 font-medium mb-6 bangla">
              আপনার র‍্যাঙ্ক: {attempt.calculatedRank}
            </p>
          )}

          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto mt-8">
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              <div className="text-xs text-green-800 font-medium bangla">সঠিক</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <div className="text-2xl font-bold text-red-600">{wrongCount}</div>
              <div className="text-xs text-red-800 font-medium bangla">ভুল</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-2xl font-bold text-gray-600">{skippedQuestions}</div>
              <div className="text-xs text-gray-800 font-medium bangla">বাদ</div>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <div className="text-xl font-bold text-indigo-600 mt-1">{Math.floor(attempt.time_taken_seconds / 60)}m</div>
              <div className="text-xs text-indigo-800 font-medium bangla">সময়</div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <Button onClick={() => navigate(`/quiz/${quiz.id}`)} variant="outline" className="gap-2 bangla">
              <RotateCcw className="w-4 h-4" />
              পুনরায় দিন
            </Button>
            <Button onClick={() => navigate(`/chapter/${quiz.chapter_id}/quizzes`)} className="gap-2 bangla">
              <BookOpen className="w-4 h-4" />
              অধ্যায়ে ফিরুন
            </Button>
          </div>
        </div>

        {/* Question Review */}
        <h3 className="text-xl font-bold text-gray-900 mb-6 bangla">উত্তরপত্র পর্যালোচনা</h3>
        
        <div className="space-y-6">
          {questions.map((q, index) => {
            const selectedOptionId = answers[q.id];
            const isAnswered = !!selectedOptionId;
            const selectedOption = q.options.find((o: any) => o.id === selectedOptionId);
            const isCorrect = selectedOption?.is_correct;

            return (
              <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex gap-4 mb-6">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 text-white ${
                    !isAnswered ? 'bg-gray-400' : isCorrect ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 bangla">{q.question_text}</h4>
                    <p className="text-xs text-gray-500 mt-1 bangla">
                      মান: {isCorrect ? `+${q.marks || 1}` : isAnswered ? `-${quiz.negative_per_wrong || 0}` : '0'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pl-12">
                  {q.options.map((opt: any) => {
                    const isSelected = selectedOptionId === opt.id;
                    let optionClass = "border-gray-200 opacity-60";
                    
                    if (opt.is_correct) {
                      optionClass = "border-green-500 bg-green-50 text-green-800 font-medium opacity-100";
                    } else if (isSelected && !opt.is_correct) {
                      optionClass = "border-red-500 bg-red-50 text-red-800 opacity-100";
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 ${optionClass}`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          opt.is_correct ? 'border-green-500 bg-green-500' :
                          isSelected && !opt.is_correct ? 'border-red-500 bg-red-500' :
                          'border-gray-300'
                        }`}>
                          {(isSelected || opt.is_correct) && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="bangla">{opt.option_text}</span>
                        
                        {opt.is_correct && <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />}
                        {isSelected && !opt.is_correct && <XCircle className="w-5 h-5 text-red-500 ml-auto" />}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="mt-6 pl-12">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 flex gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 text-indigo-500" />
                      <div>
                        <span className="font-bold block mb-1 bangla">ব্যাখ্যা:</span>
                        <span className="bangla">{q.explanation}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </StudentLayout>
  );
}
