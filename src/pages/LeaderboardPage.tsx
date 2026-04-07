import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, Search, ChevronDown } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';

export function LeaderboardPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (selectedQuizId) {
      fetchLeaderboard(selectedQuizId);
    }
  }, [selectedQuizId]);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, chapter_id, chapters(name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
      if (data && data.length > 0) {
        setSelectedQuizId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    }
  };

  const fetchLeaderboard = async (quizId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          score,
          rank,
          submitted_at,
          profiles (
            full_name,
            display_name,
            avatar_url
          )
        `)
        .eq('quiz_id', quizId)
        .eq('status', 'submitted')
        .order('score', { ascending: false })
        .order('time_taken_seconds', { ascending: true })
        .limit(20);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const maskName = (name: string) => {
    if (!name || name.length <= 2) return name;
    return name.substring(0, 2) + '***' + name.substring(name.length - 1);
  };

  return (
    <StudentLayout>
      <SEO title="লিডারবোর্ড | NexusEdu" />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 bangla">লিডারবোর্ড</h1>
            <p className="text-sm text-gray-500 bangla">কুইজের ফলাফল এবং র‍্যাংকিং</p>
          </div>
        </div>

        <div className="mb-8 relative">
          <select
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bangla"
          >
            {quizzes.length === 0 && <option>কোনো কুইজ পাওয়া যায়নি</option>}
            {quizzes.map(q => (
              <option key={q.id} value={q.id}>
                {q.chapters?.name ? `${q.chapters.name} - ` : ''}{q.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-1 bangla">কোনো ফলাফল নেই</h2>
            <p className="text-sm text-gray-500 bangla">এই কুইজে এখনও কেউ অংশগ্রহণ করেনি।</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-6">Student</div>
              <div className="col-span-4 text-right">Score</div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                return (
                  <div key={index} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-gray-50 ${rank <= 3 ? 'bg-amber-50/30' : ''}`}>
                    <div className="col-span-2 flex justify-center">
                      {rank === 1 ? <Medal className="w-8 h-8 text-amber-500 drop-shadow-sm" /> :
                       rank === 2 ? <Medal className="w-8 h-8 text-gray-400 drop-shadow-sm" /> :
                       rank === 3 ? <Medal className="w-8 h-8 text-amber-700 drop-shadow-sm" /> :
                       <span className="font-bold text-gray-500">{rank}</span>}
                    </div>
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0 border border-indigo-200">
                        {entry.profiles?.avatar_url ? (
                          <img src={entry.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-indigo-600 font-bold text-xs">
                            {(entry.profiles?.display_name || entry.profiles?.full_name || 'S')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 truncate bangla">
                          {maskName(entry.profiles?.display_name || entry.profiles?.full_name || 'Student')}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(entry.submitted_at).toLocaleDateString('bn-BD')}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-4 text-right">
                      <div className="font-bold text-indigo-600 text-lg">{entry.score}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
