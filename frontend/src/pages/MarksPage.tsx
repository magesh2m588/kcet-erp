import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebsiteSettings } from '../context/WebsiteSettingsContext';
import { apiRequest } from '../services/api';
import type { Regulation, Batch } from '../types';
import { Button, Select, Input, Badge, LoadingState, ErrorState, ConfirmModal } from '../components/UIComponents';
import { CheckCircle2, Send, Lock } from 'lucide-react';

interface AssignedSubject {
  semester_subject_id: number;
  subject_id: number;
  code: string;
  name: string;
  subject_type: string;
  credits: number;
  batch_id: number;
  batch_label: string;
  regulation_code: string;
  semester_id: number;
  year_number: number;
  semester_number: number;
  semester_label: string;
  faculty_name?: string;
}

interface StudentMarkRow {
  student_id: number;
  register_number: string;
  full_name: string;
  obtained_marks: number | null;
  grade: string | null;
}

interface AssessmentContextData {
  assessment: {
    id: number;
    name: string;
    status: 'draft' | 'published';
    published_date: string | null;
    created_by_name: string | null;
    published_by_name: string | null;
  };
  subject: {
    code: string;
    name: string;
    subject_type: string;
    credits: number;
    faculty_name: string;
  };
  academic_context: {
    regulation_code: string;
    batch_label: string;
    year_number: number;
    semester_number: number;
    semester_label: string;
  };
  exam_type: 'numeric' | 'grade';
  students: StudentMarkRow[];
}

interface StudentResultItem {
  subject_code: string;
  subject_name: string;
  subject_type: string;
  credits: number;
  mark: number | null;
  grade: string | null;
  result: string;
}

interface StudentResultsPayload {
  status: 'published' | 'unpublished';
  message?: string;
  student_info: {
    full_name: string;
    register_number: string;
    programme_name: string;
    regulation_code: string;
    batch_label: string;
    year_number: number;
    semester_number: number;
    semester_label: string;
    exam_name: string;
  };
  exam_type?: 'numeric' | 'grade';
  results?: StudentResultItem[];
}

export const MarksPage: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useWebsiteSettings();

  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Filters for Teacher / HOD
  const [filterReg, setFilterReg] = useState<string>('');
  const [filterBatch, setFilterBatch] = useState<string>('');
  const [filterSemNumber, setFilterSemNumber] = useState<string>('1');
  const [examName, setExamName] = useState<string>('IAT 1');

  // Teacher specific state
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
  const [selectedSemSubId, setSelectedSemSubId] = useState<string>('');
  const [markContextData, setMarkContextData] = useState<AssessmentContextData | null>(null);
  const [draftMarks, setDraftMarks] = useState<Record<number, { mark_value: string; grade_value: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // HOD specific state
  const [hodSubjects, setHodSubjects] = useState<AssignedSubject[]>([]);
  const [activeHodSubId, setActiveHodSubId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  // Student specific state
  const [studentYear, setStudentYear] = useState<string>('1');
  const [studentSemNum, setStudentSemNum] = useState<string>('1');
  const [studentExamName, setStudentExamName] = useState<string>('IAT 1');
  const [studentResultsData, setStudentResultsData] = useState<StudentResultsPayload | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Build department query param for HOD
  const deptParam = user?.role === 'hod' && user?.department_id ? `?department=${user.department_id}` : '';

  const loadInitialOptions = async () => {
    setLoading(true);
    setError('');
    try {
      const [regRes, batchRes] = await Promise.all([
        apiRequest<Regulation[]>('/regulations/'),
        apiRequest<Batch[]>(`/batches/${deptParam}`),
      ]);
      setRegulations(regRes);
      setBatches(batchRes);
      if (regRes.length > 0) setFilterReg(String(regRes[0].id));
      if (batchRes.length > 0) setFilterBatch(String(batchRes[0].id));
    } catch (err: any) {
      setError(err.message || 'Failed to load options.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialOptions();
  }, []);

  // Filter batches by regulation
  const availableBatches = useMemo(() => {
    if (!filterReg) return batches;
    return batches.filter((b) => b.regulation === parseInt(filterReg));
  }, [batches, filterReg]);

  // When filterReg changes, auto-select first batch
  useEffect(() => {
    if (availableBatches.length > 0) {
      setFilterBatch(String(availableBatches[0].id));
    } else {
      setFilterBatch('');
    }
  }, [availableBatches]);

  // ── TEACHER / HOD: Load Assigned / Department Subjects ─────────────────────
  const loadAssignedSubjects = async () => {
    if (!filterBatch || !filterSemNumber) return;
    try {
      // Find semester id matching batch and sem number
      const currentBatchObj = batches.find((b) => b.id === parseInt(filterBatch));
      const targetSemObj = currentBatchObj?.semesters?.find((s) => s.semester_number === parseInt(filterSemNumber));

      if (!targetSemObj) {
        setAssignedSubjects([]);
        setHodSubjects([]);
        return;
      }

      const url = `/teacher/assigned-subjects/?batch=${filterBatch}&semester=${targetSemObj.id}`;
      const subs = await apiRequest<AssignedSubject[]>(url);

      if (user?.role === 'teacher') {
        setAssignedSubjects(subs);
        if (subs.length > 0) {
          setSelectedSemSubId(String(subs[0].semester_subject_id));
        } else {
          setSelectedSemSubId('');
          setMarkContextData(null);
        }
      } else if (user?.role === 'hod' || user?.role === 'admin') {
        setHodSubjects(subs);
        if (subs.length > 0) {
          setActiveHodSubId(subs[0].semester_subject_id);
        } else {
          setActiveHodSubId(null);
          setMarkContextData(null);
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.role === 'teacher' || user?.role === 'hod' || user?.role === 'admin') {
      loadAssignedSubjects();
    }
  }, [filterBatch, filterSemNumber, user?.role]);

  // ── Load Mark Entry Context for Selected Subject ─────────────────────────
  const targetSubjectId = user?.role === 'teacher' ? selectedSemSubId : (activeHodSubId ? String(activeHodSubId) : '');

  const loadMarkContext = async () => {
    if (!targetSubjectId || !examName) return;
    try {
      const data = await apiRequest<AssessmentContextData>(`/marks/v2/entry/?semester_subject_id=${targetSubjectId}&exam_name=${encodeURIComponent(examName)}`);
      setMarkContextData(data);
      // Initialize draft marks state
      const initialDraft: Record<number, { mark_value: string; grade_value: string }> = {};
      data.students.forEach((s) => {
        initialDraft[s.student_id] = {
          mark_value: s.obtained_marks !== null ? String(s.obtained_marks) : '',
          grade_value: s.grade || '',
        };
      });
      setDraftMarks(initialDraft);
    } catch (err: any) {
      alert(err.message || 'Failed to load marks.');
    }
  };

  useEffect(() => {
    if (targetSubjectId && examName) {
      loadMarkContext();
    }
  }, [targetSubjectId, examName]);

  // ── TEACHER: Save Marks ───────────────────────────────────────────────────
  const handleSaveMarks = async () => {
    if (!targetSubjectId || !examName || !markContextData) return;
    setSavingMarks(true);
    setSaveMsg('');
    try {
      const payloadMarks = Object.entries(draftMarks).map(([stId, vals]) => ({
        student_id: parseInt(stId),
        mark_value: vals.mark_value ? parseFloat(vals.mark_value) : null,
        grade_value: vals.grade_value || null,
      }));

      await apiRequest('/marks/v2/entry/', {
        method: 'POST',
        body: JSON.stringify({
          semester_subject_id: parseInt(targetSubjectId),
          exam_name: examName,
          marks: payloadMarks,
        }),
      });

      setSaveMsg('Marks saved successfully!');
      loadMarkContext();
    } catch (err: any) {
      alert(err.message || 'Failed to save marks.');
    } finally {
      setSavingMarks(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  // ── HOD: Publish Marks ────────────────────────────────────────────────────
  const handlePublishMarks = async () => {
    if (!activeHodSubId || !examName) return;
    setPublishing(true);
    try {
      const res = await apiRequest<{ message: string }>('/marks/v2/publish/', {
        method: 'POST',
        body: JSON.stringify({
          semester_subject_id: activeHodSubId,
          exam_name: examName,
        }),
      });
      alert(res.message);
      setShowPublishConfirm(false);
      loadMarkContext();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // ── STUDENT: Load Published Results ─────────────────────────────────────
  const loadStudentResults = async () => {
    if (user?.role !== 'student') return;
    setLoading(true);
    try {
      const res = await apiRequest<StudentResultsPayload>(`/student/results/?semester_number=${studentSemNum}&exam_name=${encodeURIComponent(studentExamName)}`);
      setStudentResultsData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'student') {
      loadStudentResults();
    }
  }, [studentSemNum, studentExamName, user?.role]);

  if (loading) return <LoadingState message="Loading Marks Management System..." />;
  if (error) return <ErrorState message={error} onRetry={loadInitialOptions} />;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. STUDENT VIEW — OFFICIAL KCET ACADEMIC RESULT SHEET
  // ─────────────────────────────────────────────────────────────────────────
  if (user?.role === 'student') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header Title */}
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Academic Results</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: 0 }}>
            Official published examination marks and grade transcripts.
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Academic Year
            </label>
            <Select
              value={studentYear}
              onChange={(e) => {
                const yr = e.target.value;
                setStudentYear(yr);
                // Default semester number based on year
                const defaultSem = (parseInt(yr) * 2 - 1).toString();
                setStudentSemNum(defaultSem);
              }}
              style={{ width: '150px' }}
            >
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </Select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Semester
            </label>
            <Select value={studentSemNum} onChange={(e) => setStudentSemNum(e.target.value)} style={{ width: '160px' }}>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </Select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Examination Title
            </label>
            <Select value={studentExamName} onChange={(e) => setStudentExamName(e.target.value)} style={{ width: '180px' }}>
              <option value="IAT 1">Internal Assessment Test 1 (IAT 1)</option>
              <option value="IAT 2">Internal Assessment Test 2 (IAT 2)</option>
              <option value="ANNA UNIVERSITY">Anna University End Semester Exam</option>
            </Select>
          </div>
        </div>

        {/* ── UNPUBLISHED STATUS BANNER ───────────────────────────────────── */}
        {studentResultsData?.status === 'unpublished' && (
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '40px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}>
            <Lock size={36} style={{ color: 'var(--muted-fg)', opacity: 0.6 }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Yet to be Published</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-fg)', maxWidth: '480px' }}>
              The examination results for <strong>{studentResultsData.student_info.exam_name}</strong> ({studentResultsData.student_info.semester_label}) have not been published by the Head of Department yet.
            </p>
          </div>
        )}

        {/* ── OFFICIAL KCET ACADEMIC RESULT SHEET ─────────────────────────── */}
        {studentResultsData?.status === 'published' && studentResultsData.results && (
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '2px solid var(--border-color)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
          }}>
            {/* Institution Header */}
            <div style={{
              backgroundColor: 'var(--subtle-bg)',
              borderBottom: '2px solid var(--border-color)',
              padding: '24px 30px',
              textAlign: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {settings.logo_url && settings.show_logo ? (
                  <img src={settings.logo_url} alt="KCET Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
                    KC
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {settings.college_name || 'KRISHNASAMY COLLEGE OF ENGINEERING & TECHNOLOGY'}
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--muted-fg)' }}>
                    {settings.accreditation_text || 'Approved by AICTE, New Delhi & Affiliated to Anna University'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--muted-fg)' }}>
                    {settings.address_line_1}, {settings.address_line_2}, {settings.city} – {settings.postal_code}
                  </p>
                </div>
              </div>
              <div style={{
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color)',
                display: 'inline-block',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--primary-color)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>
                ACADEMIC PERFORMANCE TRANSCRIPT — {studentResultsData.student_info.exam_name}
              </div>
            </div>

            {/* Student Info Details */}
            <div style={{
              padding: '18px 24px',
              backgroundColor: 'var(--card-bg)',
              borderBottom: '1px solid var(--border-color)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '12px',
            }}>
              <div><span style={{ color: 'var(--muted-fg)', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>Student Name:</span> <strong style={{ display: 'block', fontSize: '13px' }}>{studentResultsData.student_info.full_name}</strong></div>
              <div><span style={{ color: 'var(--muted-fg)', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>Register Number:</span> <strong style={{ display: 'block', fontSize: '13px' }}>{studentResultsData.student_info.register_number}</strong></div>
              <div><span style={{ color: 'var(--muted-fg)', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>Programme & Batch:</span> <strong style={{ display: 'block', fontSize: '13px' }}>{studentResultsData.student_info.programme_name} ({studentResultsData.student_info.batch_label})</strong></div>
              <div><span style={{ color: 'var(--muted-fg)', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>Regulation & Semester:</span> <strong style={{ display: 'block', fontSize: '13px' }}>{studentResultsData.student_info.regulation_code} • {studentResultsData.student_info.semester_label}</strong></div>
            </div>

            {/* Results Table */}
            <div style={{ padding: '20px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 14px' }}>Subject Code</th>
                    <th style={{ padding: '10px 14px' }}>Subject Title</th>
                    <th style={{ padding: '10px 14px' }}>Type</th>
                    <th style={{ padding: '10px 14px' }}>Credits</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {studentResultsData.exam_type === 'grade' ? 'Grade' : 'Mark / 100'}
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Result Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentResultsData.results.map((resItem) => (
                    <tr key={resItem.subject_code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{resItem.subject_code}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{resItem.subject_name}</td>
                      <td style={{ padding: '10px 14px' }}>{resItem.subject_type}</td>
                      <td style={{ padding: '10px 14px' }}>{resItem.credits}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
                        {studentResultsData.exam_type === 'grade'
                          ? (resItem.grade || '-')
                          : (resItem.mark !== null ? resItem.mark : '-')}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <Badge variant={resItem.result === 'PASS' ? 'success' : 'error'}>
                          {resItem.result}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Official Footer */}
            <div style={{
              padding: '12px 24px',
              backgroundColor: 'var(--subtle-bg)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--muted-fg)',
            }}>
              <span>Computer Generated Document • Verified by KCET Controller of Examinations</span>
              <span>Status: <strong>OFFICIAL & PUBLISHED</strong></span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. TEACHER & HOD WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
            {user?.role === 'teacher' ? 'Enter Marks' : 'Student Marks & Publishing'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: 0 }}>
            {user?.role === 'teacher'
              ? 'Enter and edit student internal/grade marks for your assigned subjects.'
              : 'Review teacher-submitted marks and publish results for students.'}
          </p>
        </div>

        {user?.role === 'hod' && targetSubjectId && markContextData && (
          <Button
            onClick={() => setShowPublishConfirm(true)}
            disabled={markContextData.assessment.status === 'published'}
            variant={markContextData.assessment.status === 'published' ? 'secondary' : 'primary'}
          >
            <Send size={14} /> {markContextData.assessment.status === 'published' ? 'Published' : 'Publish Marks'}
          </Button>
        )}
      </div>

      {/* Save Success Banner */}
      {saveMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
          backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-fg)',
          display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(34,197,94,0.3)',
        }}>
          <CheckCircle2 size={16} /> {saveMsg}
        </div>
      )}

      {/* Publish Confirmation Dialog */}
      <ConfirmModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={handlePublishMarks}
        title="Publish Examination Marks?"
        message={`Are you sure you want to publish ${examName} marks for ${markContextData?.subject.code} (${markContextData?.subject.name})? Once published, student portal access becomes available immediately.`}
        loading={publishing}
      />

      {/* Shared Filter Controls */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Regulation
          </label>
          <Select value={filterReg} onChange={(e) => setFilterReg(e.target.value)} style={{ width: '150px' }}>
            {regulations.map((r) => (
              <option key={r.id} value={r.id}>{r.code}</option>
            ))}
          </Select>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Batch
          </label>
          <Select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} style={{ width: '200px' }}>
            {availableBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.programme_name} ({b.label})</option>
            ))}
          </Select>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Semester
          </label>
          <Select value={filterSemNumber} onChange={(e) => setFilterSemNumber(e.target.value)} style={{ width: '140px' }}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </Select>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Exam Title
          </label>
          <Select value={examName} onChange={(e) => setExamName(e.target.value)} style={{ width: '180px' }}>
            <option value="IAT 1">IAT 1</option>
            <option value="IAT 2">IAT 2</option>
            <option value="ANNA UNIVERSITY">Anna University</option>
          </Select>
        </div>
      </div>

      {/* ── TEACHER: Assigned Subject Selector ──────────────────────────── */}
      {user?.role === 'teacher' && (
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Assigned Subject (Teacher Allocation)
          </label>
          {assignedSubjects.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--badge-error-fg)', margin: 0, fontStyle: 'italic' }}>
              No subjects assigned to you for the selected Regulation, Batch, and Semester.
            </p>
          ) : (
            <Select value={selectedSemSubId} onChange={(e) => setSelectedSemSubId(e.target.value)} style={{ width: '100%', maxWidth: '400px' }}>
              {assignedSubjects.map((sub) => (
                <option key={sub.semester_subject_id} value={sub.semester_subject_id}>
                  {sub.code} — {sub.name} ({sub.subject_type})
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {/* ── HOD: Subject Tabs Selector ────────────────────────────────────── */}
      {(user?.role === 'hod' || user?.role === 'admin') && (
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
            Department Curriculum Subjects ({examName})
          </label>
          {hodSubjects.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0, fontStyle: 'italic' }}>
              No subjects found for the selected filter parameters.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hodSubjects.map((sub) => {
                const isActive = activeHodSubId === sub.semester_subject_id;
                return (
                  <button
                    key={sub.semester_subject_id}
                    onClick={() => setActiveHodSubId(sub.semester_subject_id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--primary-color)' : 'var(--subtle-bg)',
                      color: isActive ? '#fff' : 'var(--fg-app)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {sub.code} — {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STUDENT MARKS ENTRY & REVIEW TABLE ──────────────────────────── */}
      {markContextData && (
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 700 }}>
                {markContextData.subject.code} — {markContextData.subject.name}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted-fg)' }}>
                Faculty: <strong>{markContextData.subject.faculty_name}</strong> • Credits: {markContextData.subject.credits} • Exam: <strong>{markContextData.assessment.name}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Badge variant={markContextData.assessment.status === 'published' ? 'success' : 'warning'}>
                {markContextData.assessment.status.toUpperCase()}
              </Badge>
              {user?.role === 'teacher' && (
                <Button onClick={handleSaveMarks} loading={savingMarks} size="sm">
                  Save Marks
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px' }}>Register Number</th>
                  <th style={{ padding: '8px 12px' }}>Student Name</th>
                  <th style={{ padding: '8px 12px', width: '220px' }}>
                    {markContextData.exam_type === 'grade' ? 'Anna University Grade' : 'Mark (Max 100)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {markContextData.students.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                      No active students found in this batch/semester.
                    </td>
                  </tr>
                ) : (
                  markContextData.students.map((st) => {
                    const currentDraft = draftMarks[st.student_id] || { mark_value: '', grade_value: '' };

                    return (
                      <tr key={st.student_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{st.register_number}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{st.full_name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {user?.role === 'teacher' ? (
                            markContextData.exam_type === 'grade' ? (
                              <Select
                                value={currentDraft.grade_value}
                                onChange={(e) => setDraftMarks((prev) => ({
                                  ...prev,
                                  [st.student_id]: { ...prev[st.student_id], grade_value: e.target.value }
                                }))}
                                style={{ width: '140px' }}
                              >
                                <option value="">Select Grade</option>
                                <option value="O">O (Outstanding)</option>
                                <option value="A+">A+ (Excellent)</option>
                                <option value="A">A (Very Good)</option>
                                <option value="B+">B+ (Good)</option>
                                <option value="B">B (Above Avg)</option>
                                <option value="C">C (Average)</option>
                                <option value="AR">AR (Arrear)</option>
                              </Select>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0–100"
                                value={currentDraft.mark_value}
                                onChange={(e) => setDraftMarks((prev) => ({
                                  ...prev,
                                  [st.student_id]: { ...prev[st.student_id], mark_value: e.target.value }
                                }))}
                                style={{ width: '120px' }}
                              />
                            )
                          ) : (
                            <span style={{ fontWeight: 700 }}>
                              {markContextData.exam_type === 'grade' ? (st.grade || '-') : (st.obtained_marks !== null ? st.obtained_marks : '-')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {user?.role === 'teacher' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button onClick={handleSaveMarks} loading={savingMarks}>
                Save All Marks
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
