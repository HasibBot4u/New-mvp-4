import { useState, useEffect } from 'react';
import { Home, User, BookOpen, Trophy, Radio, MessageCircle, Bot } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const { profile, user } = useAuth();
  const [unansweredCount, setUnansweredCount] = useState(0);

  useEffect(() => {
    if (profile?.role === 'admin' || (profile?.role as any) === 'teacher') {
      const fetchUnanswered = async () => {
        const { data, error } = await supabase
          .from('questions_forum')
          .select('id, answers:forum_answers(count)')
          .eq('is_resolved', false);
        
        if (!error && data) {
          const count = data.filter(q => !q.answers || q.answers[0]?.count === 0).length;
          setUnansweredCount(count);
        }
      };
      fetchUnanswered();

      // Realtime subscription for new questions and answers
      const questionsSub = supabase.channel('questions_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'questions_forum' }, () => {
          fetchUnanswered();
        })
        .subscribe();

      const answersSub = supabase.channel('answers_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_answers' }, () => {
          fetchUnanswered();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(questionsSub);
        supabase.removeChannel(answersSub);
      };
    }
  }, [profile]);

  const hiddenPaths = ['/login', '/admin', '/watch', '/quiz/'];
  const isHiddenPath = hiddenPaths.some(p => 
    location.pathname.startsWith(p)
  );

  // KEY FIX: Also hide when user is not logged in
  // (the landing page at "/" for guests must NOT show student nav)
  const shouldHide = isHiddenPath || !user;

  if (shouldHide) return null;

  const navItems = [
    { icon: Home, label: 'Home', to: '/' },
    { icon: BookOpen, label: 'Subjects', to: '/subjects' },
    { icon: Radio, label: 'লাইভ', to: '/live' },
    { icon: MessageCircle, label: 'Q&A', to: '/qna' },
    { icon: Bot, label: 'AI সহায়ক', to: '/assistant' },
    { icon: Trophy, label: 'Leaderboard', to: '/leaderboard' },
    { icon: User, label: 'Profile', to: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 md:hidden pb-safe">
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => {
          const isActive = path === item.to || (item.to !== '/' && path.startsWith(item.to));
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${
                isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <div className="relative">
                <item.icon className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                {item.label === 'লাইভ' && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                )}
                {item.label === 'Q&A' && unansweredCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unansweredCount > 9 ? '9+' : unansweredCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium" style={item.label === 'লাইভ' ? { fontFamily: 'Hind Siliguri, sans-serif' } : {}}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
