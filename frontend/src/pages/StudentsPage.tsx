import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type { StudentProfile, Batch, Programme, Regulation } from '../types';
import { Button, FormField, Input, Select, Modal, ConfirmModal, Badge, LoadingState, ErrorState } from '../components/UIComponents';
import { Plus, Trash2, Edit, TrendingUp, TrendingDown } from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter chain: Regulation → Batch → display students
  const [filterReg, setFilterReg] = useState<string>('');
  const [filterBatch, setFilterBatch] = useState<string>('');

  // Add/Edit Student Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [regNum, setRegNum] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [selectedProg, setSelectedProg] = useState<number>(0);
  // Modal uses its own regulation selector to drive batch list
  const [modalReg, setModalReg] = useState<number>(0);
  const [selectedBatch, setSelectedBatch] = useState<number>(0);
  const [selectedSem, setSelectedSem] = useState<number>(0);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Promotion / Demotion Modal
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoMode, setPromoMode] = useState<'promote' | 'demote'>('promote');
  const [promoBatchId, setPromoBatchId] = useState<number>(0);
  const [promoSemId, setPromoSemId] = useState<number>(0);
  const [promoCount, setPromoCount] = useState<number>(0);
  const [promoLoading, setPromoLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StudentProfile | null>(null);

  // Build department query param for HOD isolation
  const deptParam = user?.role === 'hod' && user?.department_id
    ? `?department=${user.department_id}`
    : '';

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch students — backend automatically restricts HOD to their department
      // The filterBatch param drives the batch filter on top
      const studentUrl = filterBatch ? `/students/?batch=${filterBatch}` : '/students/';
      const [stRes, batchRes, progRes, regRes] = await Promise.all([
        apiRequest<StudentProfile[]>(studentUrl),
        apiRequest<Batch[]>(`/batches/${deptParam}`),  // HOD-scoped by backend
        apiRequest<Programme[]>(`/programmes/${deptParam}`),  // HOD-scoped by backend
        apiRequest<Regulation[]>('/regulations/'),
      ]);
      setStudents(stRes);
      setBatches(batchRes);
      setProgrammes(progRes);
      setRegulations(regRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterBatch]);

  // ── Filter chain helpers ──────────────────────────────────────────────────
  // Batches filtered by the selected regulation in the FILTER BAR
  const filteredBatchesForFilter = useMemo(() => {
    if (!filterReg) return batches;
    return batches.filter((b) => b.regulation === parseInt(filterReg));
  }, [batches, filterReg]);

  // When filterReg changes, reset the batch filter
  useEffect(() => {
    setFilterBatch('');
  }, [filterReg]);

  // Batches filtered by the selected regulation in the ADD MODAL
  const modalBatches = useMemo(() => {
    if (!modalReg) return batches;
    return batches.filter((b) => b.regulation === modalReg);
  }, [batches, modalReg]);

  // Auto-select first batch when modal reg changes
  useEffect(() => {
    const first = modalBatches[0];
    if (first) {
      setSelectedBatch(first.id);
      if (first.semesters && first.semesters.length > 0) {
        setSelectedSem(first.semesters[0].id);
      }
    } else {
      setSelectedBatch(0);
      setSelectedSem(0);
    }
  }, [modalBatches]);

  // Auto-update semester when modal batch changes
  const currentBatchObj = useMemo(
    () => batches.find((b) => b.id === selectedBatch),
    [batches, selectedBatch]
  );
  useEffect(() => {
    if (currentBatchObj?.semesters && currentBatchObj.semesters.length > 0) {
      setSelectedSem(currentBatchObj.semesters[0].id);
    }
  }, [selectedBatch]);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFullName('');
    setRegNum('');
    setEmail('');
    setPhone('');
    setBloodGroup('O+');
    setPassword('');
    // Pre-select first regulation and batch
    const firstReg = regulations[0];
    if (firstReg) {
      setModalReg(firstReg.id);
    }
    if (programmes.length > 0) {
      setSelectedProg(programmes[0].id);
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: StudentProfile) => {
    setEditingStudent(st);
    setFullName(st.full_name);
    setRegNum(st.register_number);
    setEmail(st.email);
    setPhone(st.phone || '');
    setBloodGroup(st.blood_group || 'O+');
    setSelectedProg(st.programme);
    setSelectedBatch(st.batch);
    setSelectedSem(st.current_semester);
    setPassword('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingStudent) {
        await apiRequest(`/students/${editingStudent.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            register_number: regNum,
            blood_group: bloodGroup,
            current_semester: selectedSem,
            password: password || undefined,
          }),
        });
      } else {
        await apiRequest('/students/', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            register_number: regNum,
            email,
            phone,
            blood_group: bloodGroup,
            programme: selectedProg,
            batch: selectedBatch,
            current_semester: selectedSem,
            password,
          }),
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPromotionModal = (mode: 'promote' | 'demote') => {
    setPromoMode(mode);
    const firstBatch = batches[0];
    if (firstBatch) {
      setPromoBatchId(firstBatch.id);
      if (firstBatch.semesters && firstBatch.semesters.length > 0) {
        setPromoSemId(firstBatch.semesters[0].id);
      }
    }
    setIsPromoModalOpen(true);
  };

  useEffect(() => {
    if (promoBatchId && promoSemId) {
      const activeStudentsInSem = students.filter(
        (s) => s.batch === promoBatchId && s.current_semester === promoSemId
      );
      setPromoCount(activeStudentsInSem.length);
    }
  }, [promoBatchId, promoSemId, students]);

  const handleExecutePromotion = async () => {
    if (!promoBatchId || !promoSemId) return;
    setPromoLoading(true);
    try {
      const endpoint = promoMode === 'promote' ? '/students/promote/' : '/students/demote/';
      const res = await apiRequest<{ message: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          batch: promoBatchId,
          semester: promoSemId,
        }),
      });
      alert(res.message);
      setIsPromoModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/students/${deleteTarget.id}/`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Promo batch semester list
  const promoBatchObj = batches.find((b) => b.id === promoBatchId);

  if (loading) return <LoadingState message="Loading KCET Student Records..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Student Directory</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
            Registered Students at Krishnasamy College of Engineering and Technology
            {user?.department_name && (
              <strong> — {user.department_name}</strong>
            )}
          </p>
        </div>

        {user?.role === 'hod' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={() => openPromotionModal('demote')}>
              <TrendingDown size={14} /> Bulk Demote
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openPromotionModal('promote')}>
              <TrendingUp size={14} /> Bulk Promote
            </Button>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus size={14} /> Add Student
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar: Regulation → Batch cascade */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', backgroundColor: 'var(--card-bg)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)' }}>Regulation</label>
          <Select value={filterReg} onChange={(e) => setFilterReg(e.target.value)} style={{ width: '160px' }}>
            <option value="">All Regulations</option>
            {regulations.map((r) => (
              <option key={r.id} value={r.id}>{r.code}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-fg)' }}>Batch</label>
          <Select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} style={{ width: '220px' }}>
            <option value="">All Batches</option>
            {filteredBatchesForFilter.map((b) => (
              <option key={b.id} value={b.id}>{b.programme_name} ({b.label})</option>
            ))}
          </Select>
        </div>
        {(filterReg || filterBatch) && (
          <Button variant="secondary" size="sm" onClick={() => { setFilterReg(''); setFilterBatch(''); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px 12px' }}>Register Number</th>
                <th style={{ padding: '8px 12px' }}>Full Name</th>
                <th style={{ padding: '8px 12px' }}>Email</th>
                <th style={{ padding: '8px 12px' }}>Batch</th>
                <th style={{ padding: '8px 12px' }}>Year &amp; Sem</th>
                <th style={{ padding: '8px 12px' }}>Blood Group</th>
                {user?.role === 'hod' && <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'hod' ? 7 : 6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', fontStyle: 'italic' }}>
                    No students found for the selected filter.
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{st.register_number}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{st.full_name}</td>
                    <td style={{ padding: '8px 12px' }}>{st.email}</td>
                    <td style={{ padding: '8px 12px' }}><Badge variant="neutral">{st.batch_label}</Badge></td>
                    <td style={{ padding: '8px 12px' }}>Year {st.current_year} • {st.current_semester_label}</td>
                    <td style={{ padding: '8px 12px' }}>{st.blood_group}</td>
                    {user?.role === 'hod' && (
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(st)}>
                            <Edit size={12} /> Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(st)}>
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
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? `Edit Student: ${editingStudent.register_number}` : 'Add New Student'}
      >
        <form onSubmit={handleSubmit}>
          <FormField label="Full Name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Aravind Kumar S" />
          </FormField>
          <FormField label="Register Number (Login Identifier)">
            <Input value={regNum} onChange={(e) => setRegNum(e.target.value)} required placeholder="311824104001" disabled={!!editingStudent} />
          </FormField>
          <FormField label="Email Address">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="aravind@gmail.com" />
          </FormField>
          <FormField label="Phone Number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9123456789" />
          </FormField>
          <FormField label="Blood Group">
            <Select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </Select>
          </FormField>
          {!editingStudent && (
            <>
              <FormField label="Programme">
                <Select value={selectedProg} onChange={(e) => setSelectedProg(parseInt(e.target.value))}>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Regulation">
                <Select value={modalReg} onChange={(e) => setModalReg(parseInt(e.target.value))}>
                  <option value={0}>-- Select Regulation --</option>
                  {regulations.map((r) => (
                    <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Batch">
                <Select value={selectedBatch} onChange={(e) => setSelectedBatch(parseInt(e.target.value))}>
                  <option value={0}>-- Select Batch --</option>
                  {modalBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.programme_name} ({b.label})</option>
                  ))}
                </Select>
              </FormField>
            </>
          )}
          <FormField label="Current Semester">
            <Select value={selectedSem} onChange={(e) => setSelectedSem(parseInt(e.target.value))}>
              <option value={0}>-- Select Semester --</option>
              {currentBatchObj?.semesters?.map((sem) => (
                <option key={sem.id} value={sem.id}>Year {sem.year_number} • {sem.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={editingStudent ? "New Password (optional)" : "Password"}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editingStudent} placeholder="••••••••" />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Student</Button>
          </div>
        </form>
      </Modal>

      {/* Promotion / Demotion Modal */}
      <Modal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        title={promoMode === 'promote' ? 'Bulk Student Promotion' : 'Bulk Student Demotion'}
      >
        <div>
          <FormField label="Select Batch">
            <Select value={promoBatchId} onChange={(e) => setPromoBatchId(parseInt(e.target.value))}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.programme_name} ({b.label})</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Select Current Semester">
            <Select value={promoSemId} onChange={(e) => setPromoSemId(parseInt(e.target.value))}>
              {promoBatchObj?.semesters?.map((sem) => (
                <option key={sem.id} value={sem.id}>Year {sem.year_number} • {sem.label}</option>
              ))}
            </Select>
          </FormField>

          <div style={{ padding: '12px', backgroundColor: 'var(--subtle-bg)', borderRadius: 'var(--radius-sm)', margin: '12px 0', fontSize: '12px' }}>
            <strong>Students Impacted:</strong> {promoCount} active student(s) found in this semester.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsPromoModalOpen(false)}>Cancel</Button>
            <Button
              variant={promoMode === 'promote' ? 'primary' : 'danger'}
              onClick={handleExecutePromotion}
              loading={promoLoading}
            >
              {promoMode === 'promote' ? 'Promote All Students' : 'Demote All Students'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Student Record"
        message={`Are you sure you want to delete student ${deleteTarget?.full_name} (${deleteTarget?.register_number})?`}
      />
    </div>
  );
};
