export type UserRole = 'admin' | 'hod' | 'teacher' | 'student';

export interface WebsiteSettings {
  college_name: string;
  short_name: string;
  tagline: string;
  affiliation_text: string;
  accreditation_text: string;
  website_url: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  district: string;
  postal_code: string;
  phone: string;
  email: string;
  logo_url: string | null;
  background_url: string | null;
  background_position: string;
  background_overlay_opacity: number;
  login_title: string;
  login_subtitle: string;
  login_description: string;
  username_label: string;
  username_placeholder: string;
  password_label: string;
  password_placeholder: string;
  login_button_text: string;
  footer_text: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  border_color: string;
  show_logo: boolean;
  show_institutional_info: boolean;
  show_password_toggle: boolean;
  show_development_credentials: boolean;
  // admin-only extras (may be absent in public response)
  id?: number;
  updated_at?: string;
  updated_by_name?: string | null;
}


export interface StudentProfileSummary {
  id: number;
  register_number: string;
  department_id?: number | null;
  department_name?: string | null;
  regulation_id?: number | null;
  regulation_code?: string | null;
  batch_id?: number | null;
  batch_label?: string | null;
  current_semester_id?: number | null;
  current_semester_number?: number | null;
  current_semester_label?: string | null;
  current_year_number?: number | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  student_profile?: StudentProfileSummary | null;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  hod_name?: string | null;
  hod_email?: string | null;
}

export interface Programme {
  id: number;
  department: number;
  department_name?: string;
  department_code?: string;
  name: string;
  degree_type: 'UG' | 'PG';
  duration_years: number;
  total_semesters: number;
}

export interface Regulation {
  id: number;
  code: string;
  name: string;
  effective_from_year: number;
  notes?: string;
  batches_count?: number;
}

export interface Semester {
  id: number;
  batch: number;
  year_number: number;
  semester_number: number;
  label: string;
}

export interface Batch {
  id: number;
  regulation: number;
  regulation_code?: string;
  programme: number;
  programme_name?: string;
  department_id?: number;
  department_name?: string;
  start_year: number;
  end_year: number;
  label: string;
  semesters?: Semester[];
}

export interface Subject {
  id: number;
  department: number;
  department_code?: string;
  code: string;
  name: string;
  subject_type: 'Theory' | 'Lab';
  credits: number;
}

export interface FacultyAssignment {
  id: number;
  semester_subject: number;
  staff_user: number;
  staff_name?: string;
  staff_code?: string;
  staff_department?: string;
}

export interface SemesterSubject {
  id: number;
  semester: number;
  subject: number;
  subject_details?: Subject;
  assigned_faculty?: FacultyAssignment[];
}

export interface StaffProfile {
  id: number;
  user: number;
  staff_code: string;
  full_name: string;
  email: string;
  phone: string;
  designation: string;
  department: number;
  department_code?: string;
  department_name?: string;
}

export interface StudentProfile {
  id: number;
  user: number;
  register_number: string;
  full_name: string;
  email: string;
  phone: string;
  blood_group: string;
  department: number;
  department_code?: string;
  department_name?: string;
  programme: number;
  programme_name?: string;
  batch: number;
  batch_label?: string;
  regulation_code?: string;
  current_semester: number;
  current_year?: number;
  current_semester_number?: number;
  current_semester_label?: string;
  is_active: boolean;
}

export interface AttendanceStudentRow {
  id: number;
  register_number: string;
  full_name: string;
  periods: Record<number | string, 'present' | 'absent'>;
}

export interface AttendanceGridResponse {
  semester: Semester;
  date: string;
  students: AttendanceStudentRow[];
}

export interface AttendanceDashboardSummary {
  student_id: number;
  register_number: string;
  full_name: string;
  total_recorded_periods: number;
  present_periods: number;
  absent_periods: number;
  percentage: number;
}

export interface Assessment {
  id: number;
  semester_subject: number;
  subject_code?: string;
  subject_name?: string;
  name: string;
  max_marks: number;
  status: 'draft' | 'published';
  created_by?: number;
  created_by_name?: string;
  published_date?: string;
  created_at?: string;
}

export interface Mark {
  id?: number;
  assessment: number;
  student: number;
  register_number?: string;
  student_name?: string;
  obtained_marks?: number | null;
}
