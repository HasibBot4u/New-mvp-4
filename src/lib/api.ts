import { Catalog, QuestionForum, ForumAnswer } from '../types';
import { supabase } from './supabase';

const PRIMARY_BACKEND = 'https://nexusedu-backend-0bjq.onrender.com';
const SECONDARY_BACKEND = 'https://edbe7e18-233b-4ff5-bed9-83c4e0edd51e-00-25a1ryv2rxe0o.sisko.replit.dev';

const CATALOG_CACHE_KEY = 'catalog_cache';
const CATALOG_CACHE_TIME_KEY = 'catalog_cache_time';
const CATALOG_TTL = 10 * 60 * 1000; // 10 minutes

const BACKEND_CACHE_KEY = 'working_backend';
const BACKEND_CACHE_TIME_KEY = 'working_backend_time';
const BACKEND_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to get the currently working backend
export async function getWorkingBackend(): Promise<string> {
  // Check if we have a cached working backend
  const cachedBackend = localStorage.getItem(BACKEND_CACHE_KEY);
  const cachedTime = localStorage.getItem(BACKEND_CACHE_TIME_KEY);
  
  if (cachedBackend && cachedTime) {
    const age = Date.now() - parseInt(cachedTime, 10);
    if (age < BACKEND_TTL) {
      try {
        const response = await fetch(`${cachedBackend}/`, { method: 'GET' });
        if (response.ok) return cachedBackend;
      } catch {
        // Cached backend failed, fall through to check both
      }
    } else {
      localStorage.removeItem(BACKEND_CACHE_KEY);
      localStorage.removeItem(BACKEND_CACHE_TIME_KEY);
    }
  }

  // Try primary
  try {
    const response = await fetch(`${PRIMARY_BACKEND}/`, { method: 'GET' });
    if (response.ok) {
      localStorage.setItem(BACKEND_CACHE_KEY, PRIMARY_BACKEND);
      localStorage.setItem(BACKEND_CACHE_TIME_KEY, Date.now().toString());
      return PRIMARY_BACKEND;
    }
  } catch {
    console.warn('Primary backend failed, trying secondary...');
  }

  // Try secondary
  try {
    const response = await fetch(`${SECONDARY_BACKEND}/`, { method: 'GET' });
    if (response.ok) {
      localStorage.setItem(BACKEND_CACHE_KEY, SECONDARY_BACKEND);
      localStorage.setItem(BACKEND_CACHE_TIME_KEY, Date.now().toString());
      return SECONDARY_BACKEND;
    }
  } catch {
    console.error('Both backends failed');
  }

  // Default to primary if both fail HEAD checks (maybe CORS issue on HEAD, let GET try)
  return PRIMARY_BACKEND;
}

export const api = {
  async getCatalog(): Promise<Catalog> {
    const baseUrl = await getWorkingBackend();
    const response = await fetch(`${baseUrl}/api/catalog`);
    if (!response.ok) {
      throw new Error('Failed to fetch catalog');
    }
    const data = await response.json();
    // Cache the catalog data
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CATALOG_CACHE_TIME_KEY, Date.now().toString());
    return data;
  },

  async getCatalogWithCache(): Promise<Catalog> {
    const cached = localStorage.getItem(CATALOG_CACHE_KEY);
    const cachedTime = localStorage.getItem(CATALOG_CACHE_TIME_KEY);
    
    if (cached && cachedTime) {
      const age = Date.now() - parseInt(cachedTime, 10);
      if (age < CATALOG_TTL) {
        return JSON.parse(cached);
      } else {
        localStorage.removeItem(CATALOG_CACHE_KEY);
        localStorage.removeItem(CATALOG_CACHE_TIME_KEY);
      }
    }

    try {
      return await this.getCatalog();
    } catch (error) {
      if (cached) {
        console.warn('Using stale cached catalog due to fetch error');
        return JSON.parse(cached);
      }
      throw error;
    }
  },

  async warmup(): Promise<void> {
    try {
      const baseUrl = await getWorkingBackend();
      await fetch(`${baseUrl}/api/warmup`);
    } catch (e) {
      console.warn('Warmup failed', e);
    }
  },

  async prefetchVideo(videoId: string): Promise<void> {
    try {
      const baseUrl = await getWorkingBackend();
      await fetch(`${baseUrl}/api/prefetch/${videoId}`);
    } catch (e) {
      console.warn(`Prefetch failed for ${videoId}`, e);
    }
  },

  async refreshCatalog(): Promise<{ status: string; message: string }> {
    const baseUrl = await getWorkingBackend();
    const response = await fetch(`${baseUrl}/api/refresh`);
    if (!response.ok) {
      throw new Error('Failed to refresh catalog');
    }
    return response.json();
  },

  getVideoStreamUrl(videoId: string): string {
    const baseUrl = localStorage.getItem('working_backend') || PRIMARY_BACKEND;
    return `${baseUrl}/api/stream/${videoId}`;
  },

  // Q&A Forum APIs
  async getQuestions(filters?: { is_resolved?: boolean; subject_id?: string; video_id?: string; search?: string }): Promise<QuestionForum[]> {
    let query = supabase
      .from('questions_forum')
      .select(`
        *,
        user:profiles!questions_forum_user_id_fkey(display_name, avatar_url),
        video:videos!questions_forum_video_id_fkey(title),
        chapter:chapters!questions_forum_chapter_id_fkey(
          name,
          cycle:cycles(
            subject:subjects(name, color)
          )
        ),
        answers:forum_answers(count)
      `)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.is_resolved !== undefined) {
      query = query.eq('is_resolved', filters.is_resolved);
    }
    if (filters?.video_id) {
      query = query.eq('video_id', filters.video_id);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,body.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // We can't easily filter by nested subject_id in Supabase without inner joins,
    // so we filter in memory if subject_id is provided.
    let results = data as any[];
    if (filters?.subject_id) {
      results = results.filter(q => q.chapter?.cycle?.subject?.id === filters.subject_id);
    }

    return results.map(q => ({
      ...q,
      answer_count: q.answers?.[0]?.count || 0
    }));
  },

  async getQuestionById(id: string): Promise<QuestionForum> {
    const { data, error } = await supabase
      .from('questions_forum')
      .select(`
        *,
        user:profiles!questions_forum_user_id_fkey(display_name, avatar_url),
        video:videos!questions_forum_video_id_fkey(title),
        chapter:chapters!questions_forum_chapter_id_fkey(
          name,
          cycle:cycles(
            subject:subjects(name, color)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getAnswers(questionId: string): Promise<ForumAnswer[]> {
    const { data, error } = await supabase
      .from('forum_answers')
      .select(`
        *,
        user:profiles!forum_answers_user_id_fkey(display_name, avatar_url, role)
      `)
      .eq('question_id', questionId)
      .order('is_official', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async createQuestion(question: Partial<QuestionForum>): Promise<QuestionForum> {
    const { data, error } = await supabase
      .from('questions_forum')
      .insert(question)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createAnswer(answer: Partial<ForumAnswer>): Promise<ForumAnswer> {
    const { data, error } = await supabase
      .from('forum_answers')
      .insert(answer)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async toggleUpvote(type: 'question' | 'answer', id: string, userId: string): Promise<boolean> {
    const column = type === 'question' ? 'question_id' : 'answer_id';
    const table = type === 'question' ? 'questions_forum' : 'forum_answers';
    
    // Check if already upvoted
    const { data: existing } = await supabase
      .from('forum_upvotes')
      .select('id')
      .eq('user_id', userId)
      .eq(column, id)
      .maybeSingle();

    if (existing) {
      // Remove upvote
      await supabase.from('forum_upvotes').delete().eq('id', existing.id);
      
      // Decrement count
      const { data: item } = await supabase.from(table).select('upvotes').eq('id', id).single();
      if (item) {
        await supabase.from(table).update({ upvotes: Math.max(0, item.upvotes - 1) }).eq('id', id);
      }
      return false;
    } else {
      // Add upvote
      await supabase.from('forum_upvotes').insert({
        user_id: userId,
        [column]: id
      });
      
      // Increment count
      const { data: item } = await supabase.from(table).select('upvotes').eq('id', id).single();
      if (item) {
        await supabase.from(table).update({ upvotes: item.upvotes + 1 }).eq('id', id);
      }
      return true;
    }
  },

  async markQuestionResolved(id: string, is_resolved: boolean): Promise<void> {
    const { error } = await supabase
      .from('questions_forum')
      .update({ is_resolved })
      .eq('id', id);
    if (error) throw error;
  },

  async pinQuestion(id: string, is_pinned: boolean): Promise<void> {
    const { error } = await supabase
      .from('questions_forum')
      .update({ is_pinned })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteQuestion(id: string): Promise<void> {
    const { error } = await supabase
      .from('questions_forum')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('qna-images')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('qna-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
