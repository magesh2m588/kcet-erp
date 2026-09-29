import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type { Regulation, Batch, AttendanceStudentRow, AttendanceDashboardSummary } from '../types';
import { Button, FormField, Input, Select, Badge, LoadingState, ErrorState } from '../components/UIComponents';
import { CalendarCheck2, Save, BarChart2 } from 'lucide-react';

interface StudentInfo {
  name: string;
  register_number: string;
  department: string;
  regulation: string;
  batch: string;
  year: number;
  semester: number;
  semester_label: string;
}

interface AttendanceHistoryItem {
  date: string;
  periods: Record<number, string>;
  present_count: number;
  absent_count: number;
}

interface StudentAttendanceResponse {
  date_status?: 'ENTERED' | 'YET_TO_ENTER' | 'INVALID_DATE';
  has_attendance?: boolean;
  student_info?: StudentInfo;
  semester?: any;
  date?: string;
  students: AttendanceStudentRow[];
  summary?: {
    total_periods: number;
    present: number;
    absent: number;
    percentage: number;
  };
  history?: AttendanceHistoryItem[];
}

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [activeTab, setActiveTab] = useState<'daily' | 'dashboard'>('daily');

  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // ── Filter chain for HOD/Staff: Regulation → Batch → Semester ─────────────────────────
  const [selectedReg, setSelectedReg] = useState<number>(0);
  const [selectedBatch, setSelectedBatch] = useState<number>(0);
  const [selectedSem, setSelectedSem] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Grid Data for Daily Attendance
  const [gridStudents, setGridStudents] = useState<AttendanceStudentRow[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [savingGrid, setSavingGrid] = useState(false);

  // Student specific data & date status
  const [dateStatus, setDateStatus] = useState<'ENTERED' | 'YET_TO_ENTER' | 'INVALID_DATE'>('ENTERED');
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [studentSummary, setStudentSummary] = useState<{ total_periods: number; present: number; absent: number; percentage: number } | null>(null);
  const [studentHistory, setStudentHistory] = useState<AttendanceHistoryItem[]>([]);

  // Dashboard Summaries for HOD
  const [dashSummaries, setDashSummaries] = useState<AttendanceDashboardSummary[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);

  const [error, setError] = useState('');

  // Check if selected date is in the future
  const isFutureDate = useMemo(() => {
    if (!selectedDate) return false;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return false;
    const sel = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sel > today;
  }, [selectedDate]);

  // Build department query param for HOD isolation
  const deptParam = user?.role === 'hod' && user?.department_id
    ? `?department=${user.department_id}`
    : '';

  const loadInitialData = async () => {
    setError('');
    // For STUDENT role: DO NOT fetch regulations or global batches!
    if (isStudent) {
      fetchStudentAttendance();
      return;
    }

    try {
      const [regRes, batchRes] = await Promise.all([
        apiRequest<Regulation[]>('/regulations/'),
        apiRequest<Batch[]>(`/batches/${deptParam}`),  // HOD-scoped by backend
      ]);
      setRegulations(regRes);
      setBatches(batchRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load metadata.');
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [user]);

  // ── Cascade: batches filtered by regulation (HOD/Staff) ──────────────────────────────
  const filteredBatches = useMemo(() => {
    if (!selectedReg) return batches;
    return batches.filter((b) => b.regulation === selectedReg);
  }, [batches, selectedReg]);

  // When regulation changes → auto-select first matching batch
  useEffect(() => {
    if (isStudent) return;
    const first = filteredBatches[0];
    if (first) {
      setSelectedBatch(first.id);
    } else {
      setSelectedBatch(0);
      setSelectedSem(0);
    }
  }, [selectedReg, filteredBatches, isStudent]);

  // When batch changes → auto-select first semester
  const selectedBatchObj = useMemo(
    () => batches.find((b) => b.id === selectedBatch),
    [batches, selectedBatch]
  );
  useEffect(() => {
    if (isStudent) return;
    if (selectedBatchObj?.semesters && selectedBatchObj.semesters.length > 0) {
      setSelectedSem(selectedBatchObj.semesters[0].id);
    } else {
      setSelectedSem(0);
    }
  }, [selectedBatch, selectedBatchObj, isStudent]);

  // Auto-initialize: once batches loaded, pick first regulation present
  useEffect(() => {
    if (isStudent) return;
    if (batches.length > 0 && !selectedReg && regulations.length > 0) {
      const presentRegIds = [...new Set(batches.map((b) => b.regulation))];
      const firstReg = regulations.find((r) => presentRegIds.includes(r.id));
      if (firstReg) setSelectedReg(firstReg.id);
      else {
        const first = batches[0];
        setSelectedBatch(first.id);
        if (first.semesters && first.semesters.length > 0) {
          setSelectedSem(first.semesters[0].id);
        }
      }
    }
  }, [batches, regulations, isStudent]);

  // Fetch student personal attendance
  const fetchStudentAttendance = async (dateVal?: string) => {
    setLoadingGrid(true);
    setError('');
    try {
      const d = dateVal || selectedDate;
      const res = await apiRequest<StudentAttendanceResponse>(`/attendance/grid/?date=${d}`);
      if (res.date_status) setDateStatus(res.date_status);
      if (res.student_info) setStudentInfo(res.student_info);
      setGridStudents(res.students || []);
      if (res.summary) setStudentSummary(res.summary);
      if (res.history) setStudentHistory(res.history);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch personal attendance records.');
    } finally {
      setLoadingGrid(false);
    }
  };

  // Fetch daily grid for HOD/Staff
  const fetchGridData = async () => {
    if (isStudent || !selectedSem || !selectedDate) return;
    setLoadingGrid(true);
    try {
      const res = await apiRequest<{ students: AttendanceStudentRow[] }>(
        `/attendance/grid/?semester_id=${selectedSem}&date=${selectedDate}`
      );
      setGridStudents(res.students);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingGrid(false);
    }
  };

  useEffect(() => {
    if (isStudent) return;
    if (!selectedSem) return;
    if (activeTab === 'daily') {
      fetchGridData();
    } else {
      fetchDashboardData();
    }
  }, [selectedSem, selectedDate, activeTab, isStudent]);

  const fetchDashboardData = async () => {
    if (isStudent || !selectedSem) return;
    setLoadingDash(true);
    try {
      const res = await apiRequest<{ student_summaries: AttendanceDashboardSummary[] }>(
        `/attendance/dashboard/?semester_id=${selectedSem}`
      );
      setDashSummaries(res.student_summaries);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDash(false);
    }
  };

  const handlePeriodToggle = (studentId: number, periodNum: number) => {
    if (user?.role !== 'hod') return;
    setGridStudents((prev) =>
      prev.map((st) => {
        if (st.id === studentId) {
          const currStatus = st.periods[periodNum] || 'present';
          const nextStatus = currStatus === 'present' ? 'absent' : 'present';
          return {
            ...st,
            periods: { ...st.periods, [periodNum]: nextStatus },
          };
        }
        return st;
      })
    );
  };

  const handleMarkDayAbsent = (studentId: number) => {
    if (user?.role !== 'hod') return;
    setGridStudents((prev) =>
      prev.map((st) => {
        if (st.id === studentId) {
          const allAbsent: Record<number, 'absent'> = {};
          for (let p = 1; p <= 8; p++) allAbsent[p] = 'absent';
          return { ...st, periods: allAbsent };
        }
        return st;
      })
    );
  };

  const handleSaveAttendance = async () => {
    if (user?.role !== 'hod') {
      alert('PERMISSION DENIED: Only HODs can take attendance.');
      return;
    }

    setSavingGrid(true);
    const payload: Record<number, { periods: Record<number, string> }> = {};
    gridStudents.forEach((st) => {
      payload[st.id] = { periods: st.periods };
    });

    try {
      await apiRequest('/attendance/grid/', {
        method: 'POST',
        body: JSON.stringify({
          semester_id: selectedSem,
          date: selectedDate,
          attendance: payload,
        }),
      });
      alert('Daily attendance saved successfully!');
      fetchGridData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingGrid(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={loadInitialData} />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER FOR STUDENT ROLE
  // ─────────────────────────────────────────────────────────────────────────
  if (isStudent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Attendance</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
            Personal Academic Attendance Record &amp; Semester Summary
          </p>
        </div>

        {/* Student Information Display Header (Read-Only) */}
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                {studentInfo?.name || user?.full_name}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Register Number</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                {studentInfo?.register_number || user?.student_profile?.register_number || '—'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                {studentInfo?.department || user?.department_name || '—'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Regulation</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                {studentInfo?.regulation || user?.student_profile?.regulation_code || '—'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Batch</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                {studentInfo?.batch || user?.student_profile?.batch_label || '—'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Year</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                Year {studentInfo?.year || user?.student_profile?.current_year_number || '1'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Semester</span>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--text-color)' }}>
                Semester {studentInfo?.semester || user?.student_profile?.current_semester_number || '1'}
              </div>
            </div>
          </div>
        </div>

        {/* Student Attendance Summary Cards */}
        {studentSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>Total Periods Recorded</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{studentSummary.total_periods}</div>
            </div>
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--badge-success-fg)' }}>Present Periods</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--badge-success-fg)', marginTop: '4px' }}>{studentSummary.present}</div>
            </div>
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--badge-error-fg)' }}>Absent Periods</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--badge-error-fg)', marginTop: '4px' }}>{studentSummary.absent}</div>
            </div>
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>Attendance Percentage</div>
              <div style={{ marginTop: '6px' }}>
                <Badge variant={studentSummary.percentage >= 75 ? 'success' : 'error'}>
                  {studentSummary.percentage}%
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Records & History */}
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          {loadingGrid ? (
            <LoadingState message="Loading your attendance history..." />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Attendance Records</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>Select Date:</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      fetchStudentAttendance(e.target.value);
                    }}
                    style={{ width: '160px' }}
                  />
                </div>
              </div>

              {/* Single Date Attendance State Display */}
              {dateStatus === 'ENTERED' && gridStudents.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-fg)', marginBottom: '8px' }}>
                    Daily Periods Status for {selectedDate}:
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Register Number</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Student Name</th>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                            <th key={p} style={{ padding: '8px 6px', width: '50px' }}>P{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gridStudents.map((st) => (
                          <tr key={st.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>{st.register_number}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500 }}>{st.full_name}</td>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
                              const isPresent = st.periods[p] === 'present';
                              return (
                                <td key={p} style={{ padding: '6px 4px' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: isPresent ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
                                      color: isPresent ? 'var(--badge-success-fg)' : 'var(--badge-error-fg)',
                                      border: `1px solid ${isPresent ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                    }}
                                  >
                                    {isPresent ? 'P' : 'A'}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : dateStatus === 'YET_TO_ENTER' ? (
                <div style={{
                  backgroundColor: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '32px 24px',
                  textAlign: 'center',
                  margin: '16px 0 24px 0'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-color)', marginBottom: '6px' }}>
                    Yet to enter {isFutureDate ? '— future date' : ''}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>
                    Attendance has not been entered for this date.
                  </div>
                </div>
              ) : (
                <div style={{
                  backgroundColor: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '32px 24px',
                  textAlign: 'center',
                  margin: '16px 0 24px 0'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--badge-error-fg)', marginBottom: '6px' }}>
                    Invalid date
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>
                    No attendance was entered for this past date.
                  </div>
                </div>
              )}

              {/* Semester Attendance History Table */}
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', marginTop: '16px' }}>
                Attendance Summary History
              </div>
              {studentHistory.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                  No attendance history recorded yet for this semester.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                          <th key={p} style={{ padding: '8px 6px', width: '50px' }}>P{p}</th>
                        ))}
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Present</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Absent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentHistory.map((item) => (
                        <tr key={item.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>{item.date}</td>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
                            const isPresent = item.periods[p] === 'present';
                            return (
                              <td key={p} style={{ padding: '6px 4px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 7px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: isPresent ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
                                    color: isPresent ? 'var(--badge-success-fg)' : 'var(--badge-error-fg)',
                                  }}
                                >
                                  {isPresent ? 'P' : 'A'}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--badge-success-fg)', fontWeight: 700 }}>
                            {item.present_count}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--badge-error-fg)', fontWeight: 700 }}>
                            {item.absent_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER FOR HOD & STAFF ROLES
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Attendance Operations</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
            Daily P1–P8 Institutional Period Attendance &amp; Dashboard Summaries
            {user?.department_name && (
              <strong> — {user.department_name}</strong>
            )}
          </p>
        </div>

        {user?.role === 'hod' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant={activeTab === 'daily' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('daily')}
            >
              <CalendarCheck2 size={14} /> Daily Attendance Grid
            </Button>
            <Button
              variant={activeTab === 'dashboard' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart2 size={14} /> Attendance Dashboard
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar: Regulation → Batch → Semester cascade */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <FormField label="Regulation">
          <Select value={selectedReg} onChange={(e) => setSelectedReg(parseInt(e.target.value))}>
            <option value={0}>-- All Regulations --</option>
            {regulations.map((r) => (
              <option key={r.id} value={r.id}>{r.code}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Batch">
          <Select value={selectedBatch} onChange={(e) => setSelectedBatch(parseInt(e.target.value))}>
            <option value={0}>-- Select Batch --</option>
            {filteredBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.programme_name} ({b.label})</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Current Semester">
          <Select value={selectedSem} onChange={(e) => setSelectedSem(parseInt(e.target.value))}>
            <option value={0}>-- Select Semester --</option>
            {selectedBatchObj?.semesters?.map((sem) => (
              <option key={sem.id} value={sem.id}>Year {sem.year_number} • {sem.label}</option>
            ))}
          </Select>
        </FormField>

        {activeTab === 'daily' && (
          <FormField label="Date">
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </FormField>
        )}
      </div>

      {!selectedSem && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontStyle: 'italic' }}>
          Select a Batch and Semester to view attendance.
        </div>
      )}

      {/* TAB 1: DAILY ATTENDANCE GRID (HOD ONLY / READ-ONLY FOR OTHERS) */}
      {selectedSem > 0 && activeTab === 'daily' && (
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          {loadingGrid ? (
            <LoadingState message="Loading Period Attendance Grid..." />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Attendance Sheet for {selectedDate} ({gridStudents.length} Students)
                </span>
                {user?.role === 'hod' && (
                  <Button onClick={handleSaveAttendance} loading={savingGrid}>
                    <Save size={14} /> Save Daily Attendance
                  </Button>
                )}
              </div>

              {gridStudents.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                  No students found in this semester.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Register Number</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Student Name</th>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                          <th key={p} style={{ padding: '8px 6px', width: '50px' }}>P{p}</th>
                        ))}
                        {user?.role === 'hod' && <th style={{ padding: '8px 12px', textAlign: 'center' }}>Day Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gridStudents.map((st) => (
                        <tr key={st.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>{st.register_number}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500 }}>{st.full_name}</td>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
                            const isPresent = st.periods[p] === 'present';
                            return (
                              <td key={p} style={{ padding: '6px 4px' }}>
                                <button
                                  type="button"
                                  disabled={user?.role !== 'hod'}
                                  onClick={() => handlePeriodToggle(st.id, p)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid',
                                    cursor: user?.role === 'hod' ? 'pointer' : 'default',
                                    backgroundColor: isPresent ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
                                    color: isPresent ? 'var(--badge-success-fg)' : 'var(--badge-error-fg)',
                                    borderColor: isPresent ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                                  }}
                                >
                                  {isPresent ? 'P' : 'A'}
                                </button>
                              </td>
                            );
                          })}
                          {user?.role === 'hod' && (
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <Button variant="danger" size="sm" onClick={() => handleMarkDayAbsent(st.id)}>
                                Absent Day
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: ATTENDANCE DASHBOARD REPORT (HOD/Staff) */}
      {selectedSem > 0 && activeTab === 'dashboard' && (
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          {loadingDash ? (
            <LoadingState message="Calculating Semester Attendance Aggregate..." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 12px' }}>Register Number</th>
                    <th style={{ padding: '8px 12px' }}>Student Name</th>
                    <th style={{ padding: '8px 12px' }}>Present Periods</th>
                    <th style={{ padding: '8px 12px' }}>Absent Periods</th>
                    <th style={{ padding: '8px 12px' }}>Total Periods Recorded</th>
                    <th style={{ padding: '8px 12px' }}>Semester Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {dashSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                        No attendance records found for this semester.
                      </td>
                    </tr>
                  ) : (
                    dashSummaries.map((sum) => (
                      <tr key={sum.student_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{sum.register_number}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{sum.full_name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--badge-success-fg)', fontWeight: 600 }}>{sum.present_periods}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--badge-error-fg)', fontWeight: 600 }}>{sum.absent_periods}</td>
                        <td style={{ padding: '8px 12px' }}>{sum.total_recorded_periods}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <Badge variant={sum.percentage >= 75 ? 'success' : 'error'}>
                            {sum.percentage}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
