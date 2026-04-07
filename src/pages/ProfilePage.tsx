import { useState, useEffect } from 'react';
import { StudentLayout } from '../components/layout/StudentLayout';
import { User, Mail, Shield, Calendar, Clock, PlayCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SEO } from '../components/SEO';
import { Skeleton } from '../components/ui/Skeleton';

const InputField = ({ label, value, type = 'text', disabled = true }: { label: string, value: string, type?: string, disabled?: boolean }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1 bangla">{label}</label>
    <div className="relative">
      <input 
        type={type} 
        value={value} 
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bangla"
        readOnly
      />
      {/* <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600">
        <Edit2 size={14} />
      </button> */}
    </div>
  </div>
);

export function ProfilePage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    watchTimeMinutes: 0,
    completedVideos: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      try {
        // Fetch watch history stats
        const { data: historyData, error: historyError } = await supabase
          .from('watch_history')
          .select('progress_percent, completed')
          .eq('user_id', user.id);

        if (historyError) throw historyError;

        const completed = historyData?.filter(h => h.completed).length || 0;

        setStats({
          watchTimeMinutes: profile?.total_watch_time_minutes || 0,
          completedVideos: completed
        });
      } catch (error) {
        console.error('Error fetching profile stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [user, profile]);

  if (isLoading) {
    return (
      <StudentLayout>
        <SEO title="প্রোফাইল | NexusEdu" />
        <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
          <Skeleton className="w-full h-32 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="w-full h-24 rounded-xl" />
            <Skeleton className="w-full h-24 rounded-xl" />
            <Skeleton className="w-full h-24 rounded-xl" />
          </div>
          <Skeleton className="w-full h-64 rounded-xl" />
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <SEO title="প্রোফাইল | NexusEdu" />
      <div className="max-w-4xl mx-auto px-4 mt-6 pb-24">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden border-2 border-indigo-500">
              <User className="w-10 h-10 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 bangla">{(profile as any)?.full_name || profile?.display_name || 'Student'}</h1>
              <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded mt-1 uppercase">
                {profile?.role || 'USER'}
              </span>
            </div>
          </div>
          {/* <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors bangla">
            <Download size={16} />
            প্রোফাইল ডাউনলোড
          </button> */}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium bangla">মোট দেখার সময়</p>
              <p className="text-2xl font-bold text-gray-900">{Math.floor(stats.watchTimeMinutes / 60)} <span className="text-sm font-normal text-gray-500 bangla">ঘণ্টা</span> {stats.watchTimeMinutes % 60} <span className="text-sm font-normal text-gray-500 bangla">মিনিট</span></p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <PlayCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium bangla">সম্পূর্ণ ভিডিও</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedVideos} <span className="text-sm font-normal text-gray-500 bangla">টি</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2 bangla">
                <Shield className="w-5 h-5 text-indigo-600" />
                অ্যাকাউন্ট তথ্য
              </h2>
              <InputField label="ইমেইল অ্যাড্রেস" value={user?.email || ''} type="email" />
              <InputField label="এনরোলমেন্ট কোড" value={profile?.enrollment_code || 'N/A'} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2 bangla">
                <User className="w-5 h-5 text-indigo-600" />
                ব্যক্তিগত তথ্য
              </h2>
              <InputField label="পূর্ণ নাম" value={(profile as any)?.full_name || profile?.display_name || ''} />
              <InputField label="অ্যাকাউন্ট তৈরি" value={new Date(profile?.created_at || '').toLocaleDateString('bn-BD')} />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2 bangla">
                <Calendar className="w-5 h-5 text-indigo-600" />
                অ্যাক্টিভিটি
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600 bangla">শেষ লগইন</span>
                  <span className="font-medium text-gray-900 bangla">{new Date(user?.last_sign_in_at || '').toLocaleString('bn-BD')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600 bangla">রোল</span>
                  <span className="font-medium text-gray-900 uppercase">{profile?.role || 'USER'}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-6 text-center">
              <h3 className="text-lg font-bold text-indigo-900 mb-2 bangla">প্রোফাইল আপডেট</h3>
              <p className="text-sm text-indigo-700 mb-4 bangla">আপনার প্রোফাইল তথ্য আপডেট করতে অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
              <a href="mailto:mdhosainp414@gmail.com" className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors bangla">
                <Mail className="w-4 h-4 mr-2" />
                ইমেইল করুন
              </a>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
