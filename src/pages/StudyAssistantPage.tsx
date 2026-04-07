import React from 'react';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';
import { ComingSoon } from '../components/shared/ComingSoon';
import { Bot } from 'lucide-react';

export const StudyAssistantPage: React.FC = () => {
  return (
    <StudentLayout>
      <SEO title="AI স্টাডি অ্যাসিস্ট্যান্ট | NexusEdu" />
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <ComingSoon 
          title="AI স্টাডি অ্যাসিস্ট্যান্ট"
          description="আমরা একটি অত্যাধুনিক AI অ্যাসিস্ট্যান্ট তৈরি করছি যা আপনার যেকোনো প্রশ্নের উত্তর দিতে পারবে। খুব শীঘ্রই এই ফিচারটি যুক্ত করা হবে।"
          icon={<Bot className="w-10 h-10 text-indigo-600" />}
        />
      </div>
    </StudentLayout>
  );
};
