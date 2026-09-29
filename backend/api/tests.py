from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, HODAssignment
from academics.models import Department, Programme, Regulation, Batch, Semester, Subject, SemesterSubject, FacultySubjectAssignment
from staff.models import StaffProfile
from students.models import StudentProfile
from attendance.models import AttendanceSession, AttendanceRecord
from marks.models import Assessment, Mark

class KCETERPPermissionAndLogicTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Departments
        self.cse = Department.objects.create(name='Computer Science and Engineering', code='CSE')
        self.ece = Department.objects.create(name='Electronics and Communication Engineering', code='ECE')

        # Programme & Batch
        self.prog_cse = Programme.objects.create(department=self.cse, name='B.E. CSE', degree_type='UG', duration_years=4, total_semesters=8)
        self.reg2021 = Regulation.objects.create(code='R2021', name='Regulation 2021', effective_from_year=2021)
        self.batch = Batch.objects.create(regulation=self.reg2021, programme=self.prog_cse, start_year=2024)

        self.sem1 = Semester.objects.get(batch=self.batch, semester_number=1)
        self.sem2 = Semester.objects.get(batch=self.batch, semester_number=2)

        # Users
        self.admin = User.objects.create_user(username='admin@kcet.edu.in', email='admin@kcet.edu.in', password='password123', role='admin')
        
        self.hod_cse_user = User.objects.create_user(username='hod.cse@kcet.edu.in', email='hod.cse@kcet.edu.in', password='password123', role='hod')
        HODAssignment.objects.create(department=self.cse, user=self.hod_cse_user, staff_code='HOD01')
        StaffProfile.objects.create(user=self.hod_cse_user, department=self.cse, staff_code='HOD01')

        self.teacher_user = User.objects.create_user(username='teacher.cse@kcet.edu.in', email='teacher.cse@kcet.edu.in', password='password123', role='teacher')
        StaffProfile.objects.create(user=self.teacher_user, department=self.cse, staff_code='FAC01')

        self.student_user = User.objects.create_user(username='311824104001', email='st@kcet.edu.in', password='password123', role='student')
        self.student = StudentProfile.objects.create(
            user=self.student_user, register_number='311824104001', department=self.cse,
            programme=self.prog_cse, batch=self.batch, current_semester=self.sem1
        )

        # Subject & Assignment
        self.subject = Subject.objects.create(department=self.cse, code='CS3501', name='Compiler Design', subject_type='Theory')
        self.sem_subject = SemesterSubject.objects.create(semester=self.sem1, subject=self.subject)
        FacultySubjectAssignment.objects.create(semester_subject=self.sem_subject, staff_user=self.teacher_user)

    def test_admin_can_create_regulation(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post('/api/regulations/', {'code': 'R2026', 'name': 'Regulation 2026', 'effective_from_year': 2026})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_hod_can_take_attendance(self):
        self.client.force_authenticate(user=self.hod_cse_user)
        payload = {
            'semester_id': self.sem1.id,
            'date': '2026-09-30',
            'attendance': {
                str(self.student.id): {'periods': {1: 'present', 2: 'absent', 3: 'present', 4: 'present', 5: 'present', 6: 'present', 7: 'present', 8: 'present'}}
            }
        }
        res = self.client.post('/api/attendance/grid/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(AttendanceRecord.objects.count(), 8)

    def test_teacher_cannot_take_attendance(self):
        self.client.force_authenticate(user=self.teacher_user)
        payload = {
            'semester_id': self.sem1.id,
            'date': '2026-09-30',
            'attendance': {
                str(self.student.id): {'periods': {1: 'present'}}
            }
        }
        res = self.client.post('/api/attendance/grid/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_promotion(self):
        self.client.force_authenticate(user=self.hod_cse_user)
        res = self.client.post('/api/students/promote/', {'batch': self.batch.id, 'semester': self.sem1.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.current_semester, self.sem2)

    def test_student_sees_only_published_marks(self):
        assessment = Assessment.objects.create(semester_subject=self.sem_subject, name='IAT 1', max_marks=100, status='draft', created_by=self.teacher_user)
        Mark.objects.create(assessment=assessment, student=self.student, obtained_marks=85)

        self.client.force_authenticate(user=self.student_user)
        res = self.client.get(f'/api/marks/?assessment_id={assessment.id}')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Publish assessment
        assessment.status = 'published'
        assessment.save()

        res2 = self.client.get(f'/api/marks/?assessment_id={assessment.id}')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
