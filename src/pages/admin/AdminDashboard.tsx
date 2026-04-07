import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useCatalog } from '../../contexts/CatalogContext';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Video, BookOpen, Layers, RefreshCw, Activity, CheckCircle, XCircle, Clock, Server, Download, PlayCircle, Ban, AlertTriangle, FileText, Zap, Bug, BarChart2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatRelativeTime } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { getWorkingBackend } from '../../lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { setPageTitle } from '../../utils/setPageTitle';

interface HealthStatus {
  status: string;
  telegram_connected: boolean;
  resolved_channels: number;
  catalog_age_minutes: number;
  cache_size: number;
  version: string;
  uptime: number;
}

export const AdminDashboard: React.FC = () => {
  const { catalog, refreshCatalog, isLoading: isCatalogLoading } = useCatalog();
  const { profile } = useAuth();
  const { showToast } = useToast();
  
  useEffect(() => { setPageTitle('Admin Dashboard'); }, []);
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    blockedUsers: 0,
    totalViews: 0,
    viewsToday: 0,
  });
  
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [analyticsData, setAnalyticsData] = useState({
    dau: [] as any[],
    topVideos: [] as any[],
    topPages: [] as any[]
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Users stats
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
        
      const { count: blockedUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_blocked', true);

      // Views stats
      const { count: totalViews } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'watch_video');
        
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: viewsToday } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'watch_video')
        .gte('created_at', today.toISOString());

      setStats({
        totalUsers: totalUsers || 0,
        blockedUsers: blockedUsers || 0,
        totalViews: totalViews || 0,
        viewsToday: viewsToday || 0,
      });

      // Recent Signups
      const { data: signups } = await supabase
        .from('profiles')
        .select('id, display_name, email, created_at, avatar_url')
        .order('created_at', { ascending: false })
        .limit(5);
      if (signups) setRecentSignups(signups);

      // Recent Activity
      const { data: activity } = await supabase
        .from('activity_logs')
        .select('*, profiles:user_id(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (activity) setRecentActivity(activity);

      // Analytics Data from page_views
      const { data: pageViews } = await supabase
        .from('page_views')
        .select('page, created_at, video_id, videos(title)');

      if (pageViews) {
        // DAU (last 7 days) based on page views
        const dauMap = new Map<string, number>();
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          dauMap.set(d.toISOString().split('T')[0], 0);
        }

        const topPagesMap = new Map<string, number>();
        const topVideosMap = new Map<string, { title: string, views: number }>();

        pageViews.forEach(record => {
          // Views per day
          const dateStr = new Date(record.created_at).toISOString().split('T')[0];
          if (dauMap.has(dateStr)) {
            dauMap.set(dateStr, (dauMap.get(dateStr) || 0) + 1);
          }

          // Top Pages
          topPagesMap.set(record.page, (topPagesMap.get(record.page) || 0) + 1);

          // Top Videos
          if (record.video_id) {
            const videosData = record.videos as any;
            const videoTitle = videosData?.title || 'Unknown Video';
            const currentViews = topVideosMap.get(record.video_id)?.views || 0;
            topVideosMap.set(record.video_id, { title: videoTitle, views: currentViews + 1 });
          }
        });

        const dau = Array.from(dauMap.entries()).map(([date, views]) => ({
          date: date.substring(5), // MM-DD
          views
        }));

        const topPages = Array.from(topPagesMap.entries())
          .map(([page, views]) => ({ page, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 10);

        const topVideos = Array.from(topVideosMap.values())
          .sort((a, b) => b.views - a.views)
          .slice(0, 10);

        setAnalyticsData({ dau, topPages, topVideos });
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchHealth = async () => {
    setIsHealthLoading(true);
    try {
      const backend = await getWorkingBackend();
      const response = await fetch(`${backend}/api/health`);
      if (response.ok) {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          setHealth(data);
        } catch {
          console.error('Invalid JSON from health endpoint:', text.substring(0, 100));
        }
      }
    } catch (error) {
      console.warn('Health check failed:', error);
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchHealth();
    
    const healthInterval = setInterval(fetchHealth, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  const handleForceWarmup = async () => {
    setIsWarmingUp(true);
    try {
      const backend = await getWorkingBackend();
      const response = await fetch(`${backend}/api/warmup`, { method: 'POST' });
      if (response.ok) {
        showToast('Warmup initiated successfully');
        fetchHealth();
      } else {
        showToast('Warmup failed');
      }
    } catch {
      showToast('Connection error during warmup');
    } finally {
      setIsWarmingUp(false);
    }
  };

  const handleViewDebug = async () => {
    setIsDebugLoading(true);
    try {
      const backend = await getWorkingBackend();
      const res = await fetch(`${backend}/api/debug`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setDebugData(data);
          setShowDebugModal(true);
        } catch {
          showToast('Invalid JSON from debug endpoint');
          console.error('Invalid JSON from debug endpoint:', text.substring(0, 100));
        }
      } else {
        showToast('Failed to fetch debug info');
      }
    } catch {
      showToast('Error connecting to backend');
    } finally {
      setIsDebugLoading(false);
    }
  };

  const handleExportUsers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      
      const csvContent = [
        ['ID', 'Name', 'Email', 'Role', 'Blocked', 'Joined Date'].join(','),
        ...data.map(u => [
          u.id, 
          `"${u.display_name || ''}"`, 
          u.email, 
          u.role, 
          u.is_blocked, 
          u.created_at
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `nexusedu_users_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Users exported successfully');
    } catch {
      showToast('Failed to export users');
    }
  };

  const totalCycles = catalog?.subjects.reduce((acc, s) => acc + s.cycles.length, 0) || 0;
  const totalChapters = catalog?.subjects.reduce((acc, s) => 
    acc + s.cycles.reduce((cAcc, c) => cAcc + c.chapters.length, 0), 0) || 0;

  const statCards = [
    { label: 'Subjects', value: catalog?.subjects.length || 0, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Cycles', value: totalCycles, icon: Layers, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Chapters', value: totalChapters, icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { label: 'Videos', value: catalog?.total_videos || 0, icon: Video, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Blocked Users', value: stats.blockedUsers, icon: Ban, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Total Watch Sessions', value: stats.totalViews, icon: PlayCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Watched Today', value: stats.viewsToday, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-blue-100 text-blue-800';
      case 'signup': return 'bg-green-100 text-green-800';
      case 'watch_video': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome back, {profile?.display_name}</h1>
          <p className="text-text-secondary mt-1">Here is what's happening on NexusEdu today.</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-medium text-text-primary">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="text-sm text-text-secondary">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-surface p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">{stat.label}</p>
              <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Backend Health */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Server size={20} className="text-primary" />
            Backend Health
          </h2>
          <Button variant="outline" size="sm" onClick={fetchHealth} isLoading={isHealthLoading}>
            <RefreshCw size={14} className="mr-2" /> Refresh
          </Button>
        </div>
        <div className="p-5">
          {health ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-text-secondary mb-1">Status</p>
                <div className="flex items-center gap-2">
                  {health.status === 'ok' ? (
                    <><CheckCircle size={16} className="text-green-500" /><span className="font-medium text-green-700">Healthy</span></>
                  ) : (
                    <><AlertTriangle size={16} className="text-amber-500" /><span className="font-medium text-amber-700">Degraded</span></>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-text-secondary mb-1">Telegram</p>
                <div className="flex items-center gap-2">
                  {health.telegram_connected ? (
                    <><CheckCircle size={16} className="text-green-500" /><span className="font-medium text-green-700">Connected</span></>
                  ) : (
                    <><XCircle size={16} className="text-red-500" /><span className="font-medium text-red-700">Disconnected</span></>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-text-secondary mb-1">Resolved Channels</p>
                <p className="font-medium text-text-primary">{health.resolved_channels}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-text-secondary mb-1">Catalog Age</p>
                <p className="font-medium text-text-primary">{health.catalog_age_minutes?.toFixed(1) || '0.0'} mins</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary">
              {isHealthLoading ? 'Loading health data...' : 'Health data unavailable'}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center justify-center gap-2 bg-surface" 
          onClick={() => refreshCatalog()}
          isLoading={isCatalogLoading}
        >
          <RefreshCw size={24} className="text-blue-500" />
          <span>Refresh Catalog</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center justify-center gap-2 bg-surface" 
          onClick={handleForceWarmup} 
          isLoading={isWarmingUp}
        >
          <Zap size={24} className="text-amber-500" />
          <span>Force Warmup</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center justify-center gap-2 bg-surface" 
          onClick={handleViewDebug} 
          isLoading={isDebugLoading}
        >
          <Bug size={24} className="text-purple-500" />
          <span>View Debug Info</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center justify-center gap-2 bg-surface" 
          onClick={handleExportUsers}
        >
          <Download size={24} className="text-green-500" />
          <span>Export User List (CSV)</span>
        </Button>
      </div>

      {/* Recent Activity & Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold">Recent Signups</h2>
            <Link to="/admin/users" className="text-sm text-primary hover:underline font-medium">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {recentSignups.length > 0 ? recentSignups.map(user => (
              <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {user.display_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{user.display_name || 'Unknown User'}</p>
                    <p className="text-xs text-text-secondary">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-secondary flex items-center gap-1">
                    <Clock size={12} />
                    {formatRelativeTime(user.created_at)}
                  </p>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-text-secondary">No recent signups</div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold">Recent Activity</h2>
            <Link to="/admin/logs" className="text-sm text-primary hover:underline font-medium">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length > 0 ? recentActivity.map(log => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                      {log.action.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {log.profiles?.display_name || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate max-w-[250px]">
                    {log.details ? JSON.stringify(log.details) : 'No details'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-text-secondary flex items-center gap-1">
                    <Clock size={12} />
                    {formatRelativeTime(log.created_at)}
                  </p>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-text-secondary">No recent activity</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Analytics Section */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-gray-50/50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart2 size={20} className="text-primary" />
            Analytics Overview
          </h2>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* DAU Chart */}
          <div className="h-64">
            <h3 className="text-sm font-medium text-text-secondary mb-4">Daily Active Users (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.dau}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Videos Chart */}
          <div className="h-64">
            <h3 className="text-sm font-medium text-text-secondary mb-4">Most Watched Videos (Top 10)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.topVideos}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="title" axisLine={false} tickLine={false} tick={false} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="views" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Pages Chart */}
          <div className="h-64 lg:col-span-2">
            <h3 className="text-sm font-medium text-text-secondary mb-4">Most Visited Pages (Top 10)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.topPages} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis dataKey="page" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="views" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Content Overview Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-gray-50/50">
          <h2 className="text-lg font-bold">Content Overview</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Subject</th>
                <th className="px-6 py-3 font-medium">Cycles</th>
                <th className="px-6 py-3 font-medium">Chapters</th>
                <th className="px-6 py-3 font-medium">Videos</th>
                <th className="px-6 py-3 font-medium">Channel Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {catalog?.subjects.map(subject => {
                const sCycles = subject.cycles.length;
                const sChapters = subject.cycles.reduce((acc, c) => acc + c.chapters.length, 0);
                const sVideos = subject.cycles.reduce((acc, c) => 
                  acc + c.chapters.reduce((cAcc, ch) => cAcc + ch.videos.length, 0), 0);
                const configuredChannels = subject.cycles.filter(c => c.telegram_channel_id).length;
                
                return (
                  <tr key={subject.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }}></div>
                      {subject.name}
                    </td>
                    <td className="px-6 py-4">{sCycles}</td>
                    <td className="px-6 py-4">{sChapters}</td>
                    <td className="px-6 py-4">{sVideos}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        configuredChannels === sCycles && sCycles > 0
                          ? 'bg-green-100 text-green-800'
                          : configuredChannels > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {configuredChannels} / {sCycles} Configured
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!catalog?.subjects || catalog.subjects.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    No subjects found in catalog
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        title="Backend Debug Information"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Raw diagnostic data from the backend server.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-green-400 font-mono">
              {debugData ? JSON.stringify(debugData, null, 2) : 'No data available'}
            </pre>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setShowDebugModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
