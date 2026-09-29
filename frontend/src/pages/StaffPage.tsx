import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type { StaffProfile } from '../types';
import { Button, FormField, Input, Select, Modal, ConfirmModal, Badge, LoadingState, ErrorState } from '../components/UIComponents';
import { Plus, Trash2, Edit } from 'lucide-react';

export const StaffPage: React.FC = () => {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StaffProfile | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<StaffProfile[]>('/staff/');
      setStaffList(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFullName('');
    setEmail('');
    setStaffCode('');
    setDesignation('Assistant Professor');
    setPhone('');
    setPassword('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffProfile) => {
    setEditingStaff(staff);
    setFullName(staff.full_name);
    setEmail(staff.email);
    setStaffCode(staff.staff_code);
    setDesignation(staff.designation);
    setPhone(staff.phone || '');
    setPassword('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingStaff) {
        await apiRequest(`/staff/${editingStaff.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            designation,
            password: password || undefined,
          }),
        });
      } else {
        await apiRequest('/staff/', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            staff_code: staffCode,
            designation,
            phone,
            password,
          }),
        });
      }
      setIsModalOpen(false);
      loadStaff();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/staff/${deleteTarget.id}/`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadStaff();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <LoadingState message="Loading Teaching Staff..." />;
  if (error) return <ErrorState message={error} onRetry={loadStaff} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Faculty Staff Management</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
            Teaching faculty list for {user?.department_name || 'Department'}
          </p>
        </div>
        {user?.role === 'hod' && (
          <Button onClick={handleOpenAdd}>
            <Plus size={16} /> Add Teaching Staff
          </Button>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px 12px' }}>Staff Code</th>
                <th style={{ padding: '8px 12px' }}>Name</th>
                <th style={{ padding: '8px 12px' }}>Email</th>
                <th style={{ padding: '8px 12px' }}>Designation</th>
                <th style={{ padding: '8px 12px' }}>Phone</th>
                {user?.role === 'hod' && <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {staffList.map((staff) => (
                <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{staff.staff_code}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{staff.full_name}</td>
                  <td style={{ padding: '8px 12px' }}>{staff.email}</td>
                  <td style={{ padding: '8px 12px' }}><Badge variant="neutral">{staff.designation}</Badge></td>
                  <td style={{ padding: '8px 12px' }}>{staff.phone || '-'}</td>
                  {user?.role === 'hod' && (
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(staff)}>
                          <Edit size={12} /> Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(staff)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStaff ? `Edit Staff: ${editingStaff.full_name}` : 'Add New Teaching Staff'}
      >
        <form onSubmit={handleSubmit}>
          <FormField label="Full Name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Prof. Rajesh Kumar K." />
          </FormField>
          <FormField label="Email / Login Identifier">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="teacher.cse@kcet.edu.in" />
          </FormField>
          <FormField label="Staff Code">
            <Input value={staffCode} onChange={(e) => setStaffCode(e.target.value)} required disabled={!!editingStaff} placeholder="KCET-FAC-CSE-02" />
          </FormField>
          <FormField label="Designation">
            <Select value={designation} onChange={(e) => setDesignation(e.target.value)}>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Professor">Professor</option>
            </Select>
          </FormField>
          <FormField label="Phone Number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9842054321" />
          </FormField>
          <FormField label={editingStaff ? "New Password (leave blank to keep unchanged)" : "Password"}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editingStaff} placeholder="••••••••" />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Staff Member</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Staff Member"
        message={`Are you sure you want to delete ${deleteTarget?.full_name} (${deleteTarget?.staff_code})?`}
      />
    </div>
  );
};
