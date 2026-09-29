import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Badge, LoadingState, ErrorState } from '../components/UIComponents';
import { BookOpen, UserCheck, Calendar } from 'lucide-react';

interface SubjectItem {
  id: number;
  subject_id: number;
  code: string;
  name: string;
  subject_type: 'Theory' | 'Lab';
  credits: number;
  faculty_name: string;
}

interface PreviousSemester {
  semester_id: number;
  year_number: number;
  semester_number: number;
  label: string;
  subjects: SubjectItem[];
}

interface MySubjectsData {
  student: {
    register_number: string;
    full_name: string;
    programme: string;
    regulation: string;
    batch: string;
    current_year: number;
    current_semester: number;
    current_semester_label: string;
  };
  current_semester_subjects: SubjectItem[];
  previous_semesters: PreviousSemester[];
}

export const StudentSubjectsPage: React.FC = () => {
  const [data, setData] = useState<MySubjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSem, setExpandedSem] = useState<number | null>(null);

  const loadSubjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<MySubjectsData>('/student/my-subjects/');
      setData(res);
      if (res.previous_semesters.length > 0) {
        setExpandedSem(res.previous_semesters[res.previous_semesters.length - 1].semester_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load curriculum subjects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  if (loading) return <LoadingState message="Loading Curriculum & Subject Assignments..." />;
  if (error) return <ErrorState message={error} onRetry={loadSubjects} />;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>My Curriculum & Subjects</h1>
        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: 0 }}>
          Read-only view of enrolled subjects and allocated faculty members for current and past academic semesters.
        </p>
      </div>

      {/* Student Profile Card */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', fontWeight: 600 }}>Student Name</span>
          <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '14px' }}>{data.student.full_name}</p>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', fontWeight: 600 }}>Register Number</span>
          <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '14px' }}>{data.student.register_number}</p>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', fontWeight: 600 }}>Programme & Batch</span>
          <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: '13px' }}>{data.student.programme} ({data.student.batch})</p>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', fontWeight: 600 }}>Current Academic Context</span>
          <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: '13px', color: 'var(--primary-color)' }}>
            Year {data.student.current_year} • {data.student.current_semester_label} ({data.student.regulation})
          </p>
        </div>
      </div>

      {/* ── CURRENT SEMESTER SUBJECTS ────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <BookOpen size={18} style={{ color: 'var(--primary-color)' }} />
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
            Current Semester Subjects ({data.student.current_semester_label})
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px' }}>Subject Code</th>
                <th style={{ padding: '10px 12px' }}>Subject Title</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px' }}>Credits</th>
                <th style={{ padding: '10px 12px' }}>Allocated Faculty</th>
              </tr>
            </thead>
            <tbody>
              {data.current_semester_subjects.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                    No subjects registered for the current semester yet.
                  </td>
                </tr>
              ) : (
                data.current_semester_subjects.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{sub.code}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{sub.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge variant={sub.subject_type === 'Lab' ? 'warning' : 'neutral'}>
                        {sub.subject_type}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{sub.credits}</td>
                    <td style={{ padding: '10px 12px', color: sub.faculty_name === 'Not Assigned' ? 'var(--muted-fg)' : 'var(--fg-app)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <UserCheck size={14} style={{ opacity: 0.7 }} />
                        {sub.faculty_name}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PREVIOUS SEMESTERS ACADEMIC HISTORY ─────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <Calendar size={18} style={{ color: 'var(--primary-color)' }} />
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
            Previous Semesters History
          </h2>
        </div>

        {data.previous_semesters.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted-fg)', fontStyle: 'italic', margin: 0 }}>
            No previous semester history found (Current Semester 1).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.previous_semesters.map((prevSem) => {
              const isExpanded = expandedSem === prevSem.semester_id;
              return (
                <div
                  key={prevSem.semester_id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setExpandedSem(isExpanded ? null : prevSem.semester_id)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'var(--subtle-bg)',
                      border: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>
                      Year {prevSem.year_number} • {prevSem.label} ({prevSem.subjects.length} Subjects)
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 600 }}>
                      {isExpanded ? 'Hide Subjects ▲' : 'View Subjects ▼'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '12px', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--muted-fg)' }}>
                            <th style={{ padding: '6px 10px' }}>Subject Code</th>
                            <th style={{ padding: '6px 10px' }}>Subject Name</th>
                            <th style={{ padding: '6px 10px' }}>Type</th>
                            <th style={{ padding: '6px 10px' }}>Credits</th>
                            <th style={{ padding: '6px 10px' }}>Faculty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prevSem.subjects.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: 'var(--muted-fg)' }}>
                                No subjects recorded for this semester.
                              </td>
                            </tr>
                          ) : (
                            prevSem.subjects.map((sub) => (
                              <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '6px 10px', fontWeight: 700 }}>{sub.code}</td>
                                <td style={{ padding: '6px 10px' }}>{sub.name}</td>
                                <td style={{ padding: '6px 10px' }}>{sub.subject_type}</td>
                                <td style={{ padding: '6px 10px' }}>{sub.credits}</td>
                                <td style={{ padding: '6px 10px' }}>{sub.faculty_name}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
