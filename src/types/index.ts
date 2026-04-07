// FILE: src/types/index.ts

export interface Video {
  id: string;
  chapter_id: string;
  title: string;
  display_order: number;
  telegram_file_id: string;
  telegram_message_id: number;
  telegram_channel_id: string;
  duration: string;
  size_mb: number;
  is_active: boolean;
}

export interface Chapter {
  id: string;
  cycle_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  videos: Video[];
}

export interface Cycle {
  id: string;
  subject_id: string;
  name: string;
  display_order: number;
  telegram_channel_id: string;
  is_active: boolean;
  chapters: Chapter[];
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  display_order: number;
  is_active: boolean;
  cycles: Cycle[];
}

export interface Catalog {
  subjects: Subject[];
  total_videos: number;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: 'user' | 'admin';
  is_blocked: boolean;
  is_restricted: boolean;
  is_enrolled: boolean;
  enrollment_code?: string;
  last_active_at?: string;
  total_watch_time_minutes?: number;
  videos_watched_count?: number;
  created_at: string;
}

export interface Quiz {
  id: string;
  chapter_id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  total_marks: number;
  pass_marks: number;
  negative_per_wrong: number;
  max_attempts: number;
  is_published: boolean;
  display_order: number;
  created_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  question_image_url?: string;
  marks_correct: number;
  marks_wrong: number;
  explanation?: string;
  display_order: number;
  options?: QuestionOption[];
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  started_at: string;
  submitted_at?: string;
  score: number;
  total_marks: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  time_taken_seconds: number;
  status: 'in_progress' | 'submitted' | 'timed_out';
  rank: number;
}

export interface QuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id?: string;
  is_marked_for_review: boolean;
  answered_at: string;
}

export interface QuestionForum {
  id: string;
  user_id: string;
  video_id?: string;
  chapter_id?: string;
  title: string;
  body: string;
  image_url?: string;
  upvotes: number;
  is_resolved: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    display_name: string;
    avatar_url?: string;
  };
  video?: {
    title: string;
  };
  chapter?: {
    name: string;
    cycle?: {
      subject?: {
        name: string;
        color: string;
      };
    };
  };
  answer_count?: number;
  has_upvoted?: boolean;
}

export interface ForumAnswer {
  id: string;
  question_id: string;
  user_id: string;
  body: string;
  image_url?: string;
  upvotes: number;
  is_official: boolean;
  created_at: string;
  user?: {
    display_name: string;
    avatar_url?: string;
    role?: string;
  };
  has_upvoted?: boolean;
}

export interface ForumUpvote {
  id: string;
  user_id: string;
  question_id?: string;
  answer_id?: string;
  created_at: string;
}
