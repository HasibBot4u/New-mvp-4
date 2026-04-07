import { Link } from 'react-router-dom';
import { BookOpen, PlayCircle, ChevronRight } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { Skeleton } from '../components/ui/Skeleton';
import { StudentLayout } from '../components/layout/StudentLayout';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';

export function CoursesPage() {
  const { catalog, isLoading } = useCatalog();

  return (
    <StudentLayout>
      <SEO title="আমার কোর্সসমূহ | NexusEdu" />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="bangla text-3xl font-bold text-gray-900 mb-2">আমার কোর্সসমূহ</h1>
          <p className="bangla text-gray-600">আপনার এনরোল করা সকল কোর্স এখানে দেখতে পাবেন</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalog?.subjects.map((subject: any) => {
              // Count total videos
              const totalVideos = subject.cycles.reduce((acc: number, cycle: any) => {
                return acc + cycle.chapters.reduce((chAcc: number, chapter: any) => chAcc + chapter.videos.length, 0);
              }, 0);

              return (
                <Link 
                  key={subject.id} 
                  to={`/subject/${subject.id}`}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-1 group flex flex-col"
                >
                  <div className="p-6 flex items-center gap-4 border-b border-gray-50 bg-slate-50">
                    <div className="w-14 h-14 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center text-3xl">
                      {subject.icon || '📚'}
                    </div>
                    <div>
                      <h3 className="bangla text-xl font-bold text-gray-900">{subject.name}</h3>
                      <p className="bangla text-sm text-gray-500">HSC সম্পূর্ণ সিলেবাস</p>
                    </div>
                  </div>
                  
                  <div className="p-6 flex-grow flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <BookOpen className="w-5 h-5" />
                        <span className="bangla font-medium">{subject.cycles.length} সাইকেল</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <PlayCircle className="w-5 h-5" />
                        <span className="bangla font-medium">{totalVideos}+ ক্লাস</span>
                      </div>
                    </div>
                    
                    <div className="w-full py-2.5 bg-indigo-50 text-indigo-600 font-medium rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors bangla">
                      কোর্স দেখুন <ChevronRight className="w-5 h-5 ml-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </StudentLayout>
  );
}
