import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import type { Department } from '../types';
import { Button, FormField, Input, Select, LoadingState, ErrorState, Badge } from '../components/UIComponents';
import { UserCheck } from 'lucide-react';

export const HODAssignmentPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [hodName, setHodName] = useState('');
  const [hodEmail, setHodEmail] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [deptRes, assignRes] = await Promise.all([
        apiRequest<Department[]>('/departments/'),
        apiRequest<any[]>('/hod-assignments/'),
      ]);
      setDepartments(deptRes);
      setAssignments(assignRes);
      if (deptRes.length > 0) setSelectedDept(deptRes[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load HOD assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignHOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !hodName || !hodEmail || !staffCode || !password) return;

    setSaving(true);
    try {
      await apiRequest('/hod-assignments/', {
        method: 'POST',
        body: JSON.stringify({
          department: selectedDept,
          name: hodName,
          email: hodEmail,
          staff_code: staffCode,
          phone,
          password,
        }),
      });
      setHodName('');
      setHodEmail('');
      setStaffCode('');
      setPhone('');
      setPassword('');
      alert('HOD assigned successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading HOD Assignments..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>HOD Assignment</h1>
        <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
          Assign Head of Department (HOD) accounts for KCET Engineering & MCA Departments
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', alignItems: 'start' }}>
        {/* Form Panel */}
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={18} /> Assign / Change HOD
          </h2>
          <form onSubmit={handleAssignHOD}>
            <FormField label="Target Department">
              <Select value={selectedDept} onChange={(e) => setSelectedDept(parseInt(e.target.value))}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </Select>
            </FormField>

            <FormField label="HOD Full Name">
              <Input value={hodName} onChange={(e) => setHodName(e.target.value)} placeholder="Dr. Arulmozhi V." required />
            </FormField>

            <FormField label="HOD Login Email">
              <Input type="email" value={hodEmail} onChange={(e) => setHodEmail(e.target.value)} placeholder="hod.cse@kcet.edu.in" required />
            </FormField>

            <FormField label="Staff Code">
              <Input value={staffCode} onChange={(e) => setStaffCode(e.target.value)} placeholder="KCET-HOD-CSE-01" required />
            </FormField>

            <FormField label="Phone Number">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9842012345" />
            </FormField>

            <FormField label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </FormField>

            <Button type="submit" style={{ width: '100%', marginTop: '8px' }} loading={saving}>
              Create & Assign HOD
            </Button>
          </form>
        </div>

        {/* Assigned HODs List */}
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Active Department HODs</h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--subtle-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px' }}>Department</th>
                  <th style={{ padding: '8px 12px' }}>HOD Name</th>
                  <th style={{ padding: '8px 12px' }}>Email / Login</th>
                  <th style={{ padding: '8px 12px' }}>Staff Code</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const assign = assignments.find((a) => a.department_id === dept.id);
                  return (
                    <tr key={dept.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{dept.code}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {assign ? assign.hod_name : <span style={{ color: 'var(--muted-fg)', fontStyle: 'italic' }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{assign?.hod_email || '-'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {assign ? <Badge variant="warning">{assign.staff_code}</Badge> : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
