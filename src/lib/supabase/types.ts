export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: { id: string; name: string; address: string | null; created_at: string }
        Insert: { id?: string; name: string; address?: string | null; created_at?: string }
        Update: { id?: string; name?: string; address?: string | null }
      }
      profiles: {
        Row: { id: string; school_id: string; full_name: string; role: 'admin' | 'class_teacher' | 'subject_teacher'; phone: string | null; created_at: string }
        Insert: { id: string; school_id: string; full_name: string; role: 'admin' | 'class_teacher' | 'subject_teacher'; phone?: string | null }
        Update: { school_id?: string; full_name?: string; role?: 'admin' | 'class_teacher' | 'subject_teacher'; phone?: string | null }
      }
      academic_years: {
        Row: { id: string; school_id: string; name: string; start_date: string; end_date: string; is_active: boolean; created_at: string }
        Insert: { id?: string; school_id: string; name: string; start_date: string; end_date: string; is_active?: boolean }
        Update: { name?: string; start_date?: string; end_date?: string; is_active?: boolean }
      }
      classes: {
        Row: { id: string; school_id: string; academic_year_id: string; name: string; class_teacher_id: string | null; created_at: string }
        Insert: { id?: string; school_id: string; academic_year_id: string; name: string; class_teacher_id?: string | null }
        Update: { name?: string; class_teacher_id?: string | null }
      }
      subjects: {
        Row: { id: string; school_id: string; name: string; created_at: string }
        Insert: { id?: string; school_id: string; name: string }
        Update: { name?: string }
      }
      class_subjects: {
        Row: { id: string; class_id: string; subject_id: string; teacher_id: string | null }
        Insert: { id?: string; class_id: string; subject_id: string; teacher_id?: string | null }
        Update: { teacher_id?: string | null }
      }
      students: {
        Row: { id: string; school_id: string; class_id: string | null; gr_no: string; full_name: string; guardian_phone: string | null; is_active: boolean; admission_date: string; created_at: string }
        Insert: { id?: string; school_id: string; class_id?: string | null; gr_no: string; full_name: string; guardian_phone?: string | null; is_active?: boolean; admission_date?: string }
        Update: { class_id?: string | null; full_name?: string; guardian_phone?: string | null; is_active?: boolean }
      }
      comment_codes: {
        Row: { id: string; school_id: string; code: string; label: string; color: string; severity: number; sort_order: number; created_at: string }
        Insert: { id?: string; school_id: string; code: string; label: string; color?: string; severity?: number; sort_order?: number }
        Update: { code?: string; label?: string; color?: string; severity?: number; sort_order?: number }
      }
      diary_uploads: {
        Row: { id: string; school_id: string; class_id: string; uploaded_by: string | null; image_url: string; page_label: string | null; week_start: string | null; week_end: string | null; status: 'pending' | 'processing' | 'extracted' | 'confirmed' | 'failed'; extracted_json: Json | null; error_text: string | null; created_at: string }
        Insert: { id?: string; school_id: string; class_id: string; uploaded_by?: string | null; image_url: string; page_label?: string | null; week_start?: string | null; week_end?: string | null; status?: 'pending' | 'processing' | 'extracted' | 'confirmed' | 'failed' }
        Update: { status?: 'pending' | 'processing' | 'extracted' | 'confirmed' | 'failed'; extracted_json?: Json | null; error_text?: string | null }
      }
      daily_records: {
        Row: { id: string; student_id: string; class_subject_id: string; record_date: string; comment_code_id: string | null; free_text: string | null; entered_by: string | null; entered_at: string; updated_at: string; source: 'app' | 'photo_ocr'; source_upload_id: string | null; confidence: 'high' | 'medium' | 'low' | null; review_status: 'auto_ok' | 'needs_review' | 'confirmed' }
        Insert: { id?: string; student_id: string; class_subject_id: string; record_date: string; comment_code_id?: string | null; free_text?: string | null; entered_by?: string | null; source?: 'app' | 'photo_ocr'; source_upload_id?: string | null; confidence?: 'high' | 'medium' | 'low' | null; review_status?: 'auto_ok' | 'needs_review' | 'confirmed' }
        Update: { comment_code_id?: string | null; free_text?: string | null; review_status?: 'auto_ok' | 'needs_review' | 'confirmed' }
      }
      ai_summaries: {
        Row: { id: string; student_id: string; period_type: 'weekly' | 'monthly'; period_start: string; period_end: string; summary_text: string; generated_at: string }
        Insert: { id?: string; student_id: string; period_type: 'weekly' | 'monthly'; period_start: string; period_end: string; summary_text: string }
        Update: { summary_text?: string }
      }
      alerts: {
        Row: { id: string; student_id: string; alert_type: string; message: string; severity: number; created_at: string; acknowledged_by: string | null; acknowledged_at: string | null }
        Insert: { id?: string; student_id: string; alert_type: string; message: string; severity?: number }
        Update: { acknowledged_by?: string | null; acknowledged_at?: string | null }
      }
    }
    Views: {}
    Functions: {
      auth_school_id: { Args: {}; Returns: string }
      auth_role: { Args: {}; Returns: string }
    }
    Enums: {}
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type School = Tables<'schools'>
export type Profile = Tables<'profiles'>
export type AcademicYear = Tables<'academic_years'>
export type Class = Tables<'classes'>
export type Subject = Tables<'subjects'>
export type ClassSubject = Tables<'class_subjects'>
export type Student = Tables<'students'>
export type CommentCode = Tables<'comment_codes'>
export type DiaryUpload = Tables<'diary_uploads'>
export type DailyRecord = Tables<'daily_records'>
export type AiSummary = Tables<'ai_summaries'>
export type Alert = Tables<'alerts'>
