import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import type { Regulation, Batch, Programme } from '../types';
import { Button, FormField, Input, Select, Modal, ConfirmModal, Badge, LoadingState, ErrorState } from '../components/UIComponents';
import { Plus, Trash2 } from 'lucide-react';

export const AcademicStructurePage: React.FC = () => {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regCode, setRegCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regYear, setRegYear] = useState<number>(2025);
  const [regNotes, setRegNotes] = useState('');
  const [savingReg, setSavingReg] = useState(false);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<number>(0);
  const [selectedProg, setSelectedProg] = useState<number>(0);
  const [batchStartYear, setBatchStartYear] = useState<number>(2025);
  const [savingBatch, setSavingBatch] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'reg' | 'batch'; id: number; label: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [regRes, batchRes, progRes] = await Promise.all([
        apiRequest<Regulation[]>('/regulations/'),
        apiRequest<Batch[]>('/batches/'),
        apiRequest<Programme[]>('/programmes/'),
      ]);
      setRegulations(regRes);
      setBatches(batchRes);
      setProgrammes(progRes);
      if (regRes.length > 0) setSelectedReg(regRes[0].id);
      if (progRes.length > 0) setSelectedProg(progRes[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load academic structure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveRegulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCode || !regName) return;
    setSavingReg(true);
    try {
      await apiRequest('/regulations/', {
        method: 'POST',
        body: JSON.stringify({
          code: regCode,
          name: regName,
          effective_from_year: regYear,
          notes: regNotes,
        }),
      });
      setIsRegModalOpen(false);
      setRegCode('');
      setRegName('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingReg(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReg || !selectedProg || !batchStartYear) return;
    setSavingBatch(true);
    try {
      await apiRequest('/batches/', {
        method: 'POST',
        body: JSON.stringify({
          regulation: selectedReg,
          programme: selectedProg,
          start_year: batchStartYear,
        }),
      });
      setIsBatchModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingBatch(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'reg') {
        await apiRequest(`/regulations/${deleteTarget.id}/`, { method: 'DELETE' });
      } else {
        await apiRequest(`/batches/${deleteTarget.id}/`, { method: 'DELETE' });
      }
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <LoadingState message="Loading Regulations and Batches..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Academic Structure</h1>
        <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
          Manage Anna University Regulations, Degree Batches, and Academic Semesters
        </p>
      </div>

      {/* Regulations Section */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Regulations</h2>
          <Button size="sm" onClick={() => setIsRegModalOpen(true)}>
            <Plus size={14} /> Add Regulation
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {regulations.map((reg) => (
            <div key={reg.id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--subtle-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{reg.code}</span>
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget({ type: 'reg', id: reg.id, label: reg.code })}>
                  <Trash2 size={12} />
                </Button>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{reg.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted-fg)', marginTop: '4px' }}>
                Effective from {reg.effective_from_year} • {reg.batches_count || 0} batches assigned
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batches Section */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Academic Batches</h2>
          <Button size="sm" onClick={() => setIsBatchModalOpen(true)}>
            <Plus size={14} /> Add Batch
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px 12px' }}>Batch Label</th>
                <th style={{ padding: '8px 12px' }}>Programme</th>
                <th style={{ padding: '8px 12px' }}>Regulation</th>
                <th style={{ padding: '8px 12px' }}>Semesters</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{batch.label}</td>
                  <td style={{ padding: '8px 12px' }}>{batch.programme_name}</td>
                  <td style={{ padding: '8px 12px' }}><Badge variant="neutral">{batch.regulation_code}</Badge></td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {batch.semesters?.map((sem) => (
                        <span key={sem.id} style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--subtle-bg)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          Y{sem.year_number}S{sem.semester_number}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget({ type: 'batch', id: batch.id, label: `${batch.programme_name} (${batch.label})` })}>
                      <Trash2 size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Regulation Modal */}
      <Modal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} title="Add Anna University Regulation">
        <form onSubmit={handleSaveRegulation}>
          <FormField label="Regulation Code (e.g. R2025)">
            <Input value={regCode} onChange={(e) => setRegCode(e.target.value)} required placeholder="R2025" />
          </FormField>
          <FormField label="Full Name">
            <Input value={regName} onChange={(e) => setRegName(e.target.value)} required placeholder="Anna University Regulation 2025" />
          </FormField>
          <FormField label="Effective From Year">
            <Input type="number" value={regYear} onChange={(e) => setRegYear(parseInt(e.target.value))} required />
          </FormField>
          <FormField label="Notes / Description">
            <Input value={regNotes} onChange={(e) => setRegNotes(e.target.value)} placeholder="CBCS Syllabus rules" />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsRegModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingReg}>Save Regulation</Button>
          </div>
        </form>
      </Modal>

      {/* Add Batch Modal */}
      <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="Add Academic Batch">
        <form onSubmit={handleSaveBatch}>
          <FormField label="Regulation">
            <Select value={selectedReg} onChange={(e) => setSelectedReg(parseInt(e.target.value))}>
              {regulations.map((r) => (
                <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Programme">
            <Select value={selectedProg} onChange={(e) => setSelectedProg(parseInt(e.target.value))}>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>{p.name} [{p.degree_type}]</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Start Year">
            <Input type="number" value={batchStartYear} onChange={(e) => setBatchStartYear(parseInt(e.target.value))} required />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsBatchModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingBatch}>Create Batch</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteTarget?.type === 'reg' ? 'Regulation' : 'Batch'}`}
        message={`Are you sure you want to delete ${deleteTarget?.label}?`}
      />
    </div>
  );
};
