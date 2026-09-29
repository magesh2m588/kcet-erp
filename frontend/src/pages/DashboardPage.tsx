import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { StatCard, LoadingState, ErrorState, Badge } from '../components/UIComponents';
import { Users, UserCheck, BookOpen, CalendarCheck2, Building2, Layers, Award } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/dashboard/');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) return <LoadingState message="Loading KCET ERP Overview..." />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Welcome, {user?.full_name || user?.username}</h1>
        <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>
          {user?.role === 'admin'
            ? 'Institution-wide Academic Administration Overview'
            : user?.role === 'hod'
            ? `${user?.department_name} (${user?.department_code}) HOD Dashboard`
            : user?.role === 'teacher'
            ? 'Faculty Teaching & Marks Management Dashboard'
            : 'Student Academic Portal'}
        </p>
      </div>

      {/* Stats Cards */}
      {user?.role === 'admin' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard
            title="Total Students"
            value={data.stats.total_students}
            icon={<Users size={20} />}
            onClick={() => navigate('/students')}
          />
          <StatCard
            title="Total Teaching Staff"
            value={data.stats.total_staff}
            icon={<UserCheck size={20} />}
          />
          <StatCard
            title="Departments"
            value={data.stats.total_departments}
            icon={<Building2 size={20} />}
            onClick={() => navigate('/academic-structure')}
          />
          <StatCard
            title="Active Batches"
            value={data.stats.total_batches}
            icon={<Layers size={20} />}
            onClick={() => navigate('/academic-structure')}
          />
        </div>
      )}

      {user?.role === 'hod' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard
            title="Department Students"
            value={data.stats.total_students}
            icon={<Users size={20} />}
            onClick={() => navigate('/students')}
          />
          <StatCard
            title="Department Staff"
            value={data.stats.total_staff}
            icon={<UserCheck size={20} />}
            onClick={() => navigate('/staff')}
          />
          <StatCard
            title="Offered Subjects"
            value={data.stats.total_subjects}
            icon={<BookOpen size={20} />}
            onClick={() => navigate('/subjects')}
          />
          <StatCard
            title="Active Batches"
            value={data.stats.total_batches}
            icon={<Layers size={20} />}
          />
        </div>
      )}

      {user?.role === 'teacher' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard
            title="Assigned Subjects"
            value={data.stats.assigned_subjects_count}
            icon={<BookOpen size={20} />}
            onClick={() => navigate('/marks')}
          />
        </div>
      )}

      {user?.role === 'student' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard
            title="Semester Attendance"
            value={`${data.stats.attendance_percentage}%`}
            icon={<CalendarCheck2 size={20} />}
            onClick={() => navigate('/attendance')}
          />
          <StatCard
            title="Recorded Periods"
            value={data.stats.total_recorded_periods}
            icon={<Layers size={20} />}
            onClick={() => navigate('/attendance')}
          />
          <StatCard
            title="Published Marks"
            value={data.stats.published_assessments_count}
            icon={<Award size={20} />}
            onClick={() => navigate('/marks')}
          />
        </div>
      )}

      {/* Academic Hierarchy Model Panel */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Institutional Academic Model</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
          <Badge variant="neutral">REGULATION (e.g. R2021)</Badge>
          <span style={{ color: 'var(--muted-fg)' }}>→</span>
          <Badge variant="neutral">PROGRAMME (e.g. B.E. CSE)</Badge>
          <span style={{ color: 'var(--muted-fg)' }}>→</span>
          <Badge variant="neutral">BATCH (e.g. 2024–2028)</Badge>
          <span style={{ color: 'var(--muted-fg)' }}>→</span>
          <Badge variant="neutral">YEAR / SEMESTER (Year 3 • Sem 5)</Badge>
          <span style={{ color: 'var(--muted-fg)' }}>→</span>
          <Badge variant="neutral">SUBJECTS & ASSIGNMENTS</Badge>
        </div>
      </div>
    </div>
  );
};
