import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type { Regulation, Programme, Batch, SemesterSubject, StaffProfile } from '../types';
import { Button, FormField, Input, Select, Modal, ConfirmModal, Badge, LoadingState, ErrorState } from '../components/UIComponents';
import { Plus, Trash2, UserPlus } from 'lucide-react';

export const SubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [_programmes, setProgrammes] = useState<Programme[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffProfile[]>([]);

  // ── Filter chain: Regulation → Batch → Semester ─────────────────────────
  const [selectedReg, setSelectedReg] = useState<number>(0);
  const [selectedBatch, setSelectedBatch] = useState<number>(0);
  const [selectedSem, setSelectedSem] = useState<number>(0);

  const [semesterSubjects, setSemesterSubjects] = useState<SemesterSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Subject Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subType, setSubType] = useState<'Theory' | 'Lab'>('Theory');
  const [credits, setCredits] = useState<number>(3.0);
  const [savingSub, setSavingSub] = useState(false);

  // Assign Faculty Modal
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [targetSemSubject, setTargetSemSubject] = useState<SemesterSubject | null>(null);
  const [selectedStaffUser, setSelectedStaffUser] = useState<number>(0);
  const [savingFaculty, setSavingFaculty] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SemesterSubject | null>(null);

  // Build department query param for HOD isolation
  const deptParam = user?.role === 'hod' && user?.department_id
    ? `?department=${user.department_id}`
    : '';

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [regRes, progRes, batchRes, staffRes] = await Promise.all([
        apiRequest<Regulation[]>('/regulations/'),
        apiRequest<Programme[]>(`/programmes/${deptParam}`),   // HOD-scoped by backend
        apiRequest<Batch[]>(`/batches/${deptParam}`),          // HOD-scoped by backend
        apiRequest<StaffProfile[]>('/staff/'),                  // already HOD-scoped by backend
      ]);

      setRegulations(regRes);
      setProgrammes(progRes);
      setBatches(batchRes);
      setStaffMembers(staffRes);

      if (staffRes.length > 0) setSelectedStaffUser(staffRes[0].user);
    } catch (err: any) {
      setError(err.message || 'Failed to load metadata.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // ── Cascade: batches filtered by regulation ──────────────────────────────
  const filteredBatches = useMemo(() => {
    if (!selectedReg) return batches;
    return batches.filter((b) => b.regulation === selectedReg);
  }, [batches, selectedReg]);

  // When regulation changes → auto-select first matching batch
  useEffect(() => {
    const first = filteredBatches[0];
    if (first) {
      setSelectedBatch(first.id);
    } else {
      setSelectedBatch(0);
      setSelectedSem(0);
    }
  }, [selectedReg, filteredBatches]);

  // When batch changes → auto-select first semester
  const selectedBatchObj = useMemo(
    () => batches.find((b) => b.id === selectedBatch),
    [batches, selectedBatch]
  );
  useEffect(() => {
    if (selectedBatchObj?.semesters && selectedBatchObj.semesters.length > 0) {
      setSelectedSem(selectedBatchObj.semesters[0].id);
    } else {
      setSelectedSem(0);
    }
  }, [selectedBatch, selectedBatchObj]);

  // Auto-initialize: once batches loaded, pick first regulation and batch
  useEffect(() => {
    if (batches.length > 0 && !selectedReg && regulations.length > 0) {
      // Detect regulations present in HOD's batches
      const presentRegIds = [...new Set(batches.map((b) => b.regulation))];
      const firstReg = regulations.find((r) => presentRegIds.includes(r.id));
      if (firstReg) setSelectedReg(firstReg.id);
    }
  }, [batches, regulations]);

  const loadSubjects = async () => {
    if (!selectedSem) return;
    try {
      const res = await apiRequest<SemesterSubject[]>(`/semester-subjects/?semester=${selectedSem}`);
      setSemesterSubjects(res);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [selectedSem]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode || !subName || !selectedSem) return;
    setSavingSub(true);
    try {
      await apiRequest('/subjects/', {
        method: 'POST',
        body: JSON.stringify({
          code: subCode,
          name: subName,
          subject_type: subType,
          credits,
          semester_id: selectedSem,
        }),
      });
      setIsModalOpen(false);
      setSubCode('');
      setSubName('');
      loadSubjects();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSub(false);
    }
  };

  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSemSubject || !selectedStaffUser) return;
    setSavingFaculty(true);
    try {
      await apiRequest(`/semester-subjects/${targetSemSubject.id}/assign_faculty/`, {
        method: 'POST',
        body: JSON.stringify({
          staff_user_id: selectedStaffUser,
        }),
      });
      setIsFacultyModalOpen(false);
      loadSubjects();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingFaculty(false);
    }
  };

  const handleUnassignFaculty = async (semSubId: number, staffUserId: number) => {
    try {
      await apiRequest(`/semester-subjects/${semSubId}/unassign_faculty/`, {
        method: 'POST',
        body: JSON.stringify({ staff_user_id: staffUserId }),
      });
      loadSubjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/subjects/${deleteTarget.subject}/`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadSubjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <LoadingState message="Loading Subject Configurations..." />;
  if (error) return <ErrorState message={error} onRetry={loadInitialData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Subject Management</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
            Configure Semester Courses &amp; Faculty Teaching Assignments
            {user?.department_name && (
              <strong> — {user.department_name}</strong>
            )}
          </p>
        </div>
        {user?.role === 'hod' && (
          <Button onClick={() => setIsModalOpen(true)} disabled={!selectedSem}>
            <Plus size={16} /> Add Subject to Semester
          </Button>
        )}
      </div>

      {/* Selection Chain: Regulation → Batch → Semester */}
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

        <FormField label="Year &amp; Semester">
          <Select value={selectedSem} onChange={(e) => setSelectedSem(parseInt(e.target.value))}>
            <option value={0}>-- Select Semester --</option>
            {selectedBatchObj?.semesters?.map((sem) => (
              <option key={sem.id} value={sem.id}>Year {sem.year_number} • {sem.label}</option>
            ))}
          </Select>
        </FormField>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        {!selectedSem ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
            Select a Regulation, Batch and Semester to view subjects.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px' }}>Subject Code</th>
                  <th style={{ padding: '8px 12px' }}>Subject Name</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>Credits</th>
                  <th style={{ padding: '8px 12px' }}>Assigned Faculty</th>
                  {user?.role === 'hod' && <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {semesterSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'hod' ? 6 : 5} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                      No subjects configured for this semester yet.
                    </td>
                  </tr>
                ) : (
                  semesterSubjects.map((semSub) => (
                    <tr key={semSub.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{semSub.subject_details?.code}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{semSub.subject_details?.name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge variant={semSub.subject_details?.subject_type === 'Lab' ? 'warning' : 'neutral'}>
                          {semSub.subject_details?.subject_type}
                        </Badge>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{semSub.subject_details?.credits}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {semSub.assigned_faculty && semSub.assigned_faculty.length > 0 ? (
                            semSub.assigned_faculty.map((f) => (
                              <span key={f.id} style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--subtle-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {f.staff_name} ({f.staff_code})
                                {user?.role === 'hod' && (
                                  <span style={{ cursor: 'pointer', color: 'red', fontWeight: 'bold' }} onClick={() => handleUnassignFaculty(semSub.id, f.staff_user)}>×</span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--muted-fg)', fontStyle: 'italic' }}>No Faculty Assigned</span>
                          )}
                        </div>
                      </td>
                      {user?.role === 'hod' && (
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" size="sm" onClick={() => { setTargetSemSubject(semSub); setIsFacultyModalOpen(true); }}>
                              <UserPlus size={12} /> Assign
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => setDeleteTarget(semSub)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Subject Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Subject to Selected Semester">
        <form onSubmit={handleCreateSubject}>
          <FormField label="Subject Code">
            <Input value={subCode} onChange={(e) => setSubCode(e.target.value)} required placeholder="CS3501" />
          </FormField>
          <FormField label="Subject Name">
            <Input value={subName} onChange={(e) => setSubName(e.target.value)} required placeholder="Compiler Design" />
          </FormField>
          <FormField label="Subject Type">
            <Select value={subType} onChange={(e) => setSubType(e.target.value as any)}>
              <option value="Theory">Theory</option>
              <option value="Lab">Lab</option>
            </Select>
          </FormField>
          <FormField label="Credits">
            <Input type="number" step="0.5" value={credits} onChange={(e) => setCredits(parseFloat(e.target.value))} required />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingSub}>Save Subject</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Faculty Modal */}
      <Modal isOpen={isFacultyModalOpen} onClose={() => setIsFacultyModalOpen(false)} title={`Assign Faculty: ${targetSemSubject?.subject_details?.code}`}>
        <form onSubmit={handleAssignFaculty}>
          <FormField label="Select Faculty / Staff">
            <Select value={selectedStaffUser} onChange={(e) => setSelectedStaffUser(parseInt(e.target.value))}>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.user}>{s.full_name} ({s.staff_code}) - {s.department_code}</option>
              ))}
            </Select>
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsFacultyModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingFaculty}>Confirm Assignment</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Subject"
        message={`Are you sure you want to delete ${deleteTarget?.subject_details?.code}?`}
      />
    </div>
  );
};
