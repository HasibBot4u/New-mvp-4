import { StudentLayout } from '../components/layout/StudentLayout';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { SEO } from '../components/SEO';

export function PlannerPage() {
  return (
    <StudentLayout>
      <SEO title="স্টাডি প্ল্যানার | NexusEdu" />
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <CalendarIcon className="w-10 h-10 text-indigo-600" />
            <div className="absolute -top-1 -right-1 bg-amber-100 text-amber-600 p-1.5 rounded-full">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          
          <h1 className="bangla text-2xl font-bold text-gray-900 mb-3">
            স্টাডি প্ল্যানার
          </h1>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-6 bangla">
            শীঘ্রই আসছে
          </div>
          
          <p className="bangla text-gray-600 leading-relaxed">
            আমরা একটি স্মার্ট স্টাডি প্ল্যানার তৈরি করছি যা আপনাকে আপনার পড়াশোনার রুটিন সাজাতে সাহায্য করবে। খুব শীঘ্রই এই ফিচারটি যুক্ত করা হবে।
          </p>
        </div>
      </div>
    </StudentLayout>
  );
}
