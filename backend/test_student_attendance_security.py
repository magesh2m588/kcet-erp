import os
import sys
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User, HODAssignment
from academics.models import Department, Programme, Regulation, Batch, Semester
from students.models import StudentProfile
from attendance.models import AttendanceSession, AttendanceRecord

def run_security_tests():
    print("==================================================")
    print("RUNNING STUDENT ATTENDANCE DATE STATUS & SECURITY TEST SUITE")
    print("==================================================")

    client = APIClient()

    # 1. Setup Test Infrastructure & Data
    dept_a = Department.objects.filter(code='AIDS_TEST').first() or Department.objects.create(name='AI & DS Test', code='AIDS_TEST')
    dept_b = Department.objects.filter(code='CIVIL_TEST').first() or Department.objects.create(name='Civil Test', code='CIVIL_TEST')

    prog_a = Programme.objects.filter(department=dept_a).first() or Programme.objects.create(department=dept_a, name='B.E. AI&DS Test')
    prog_b = Programme.objects.filter(department=dept_b).first() or Programme.objects.create(department=dept_b, name='B.E. Civil Test')

    reg_2021 = Regulation.objects.filter(code='R2021_TEST').first() or Regulation.objects.create(code='R2021_TEST', name='Reg 2021 Test', effective_from_year=2021)
    reg_2025 = Regulation.objects.filter(code='R2025_TEST').first() or Regulation.objects.create(code='R2025_TEST', name='Reg 2025 Test', effective_from_year=2025)

    batch_a = Batch.objects.filter(programme=prog_a, regulation=reg_2021, start_year=2024).first() or Batch.objects.create(programme=prog_a, regulation=reg_2021, start_year=2024, end_year=2028, label='2024-2028')
    batch_b = Batch.objects.filter(programme=prog_b, regulation=reg_2025, start_year=2024).first() or Batch.objects.create(programme=prog_b, regulation=reg_2025, start_year=2024, end_year=2028, label='2024-2028')

    sem_a = Semester.objects.filter(batch=batch_a, semester_number=1).first() or Semester.objects.create(batch=batch_a, year_number=1, semester_number=1, label='Semester 1')
    sem_b = Semester.objects.filter(batch=batch_b, semester_number=1).first() or Semester.objects.create(batch=batch_b, year_number=1, semester_number=1, label='Semester 1')

    # Student A (AI&DS)
    user_a, _ = User.objects.get_or_create(username='test_stud_a', defaults={'role': 'student', 'full_name': 'Student A', 'email': 'stud_a@test.com'})
    user_a.set_password('pass123')
    user_a.save()
    student_a, _ = StudentProfile.objects.get_or_create(user=user_a, defaults={
        'register_number': 'REG_TEST_A_901',
        'department': dept_a,
        'programme': prog_a,
        'batch': batch_a,
        'current_semester': sem_a
    })

    # Student B (Civil)
    user_b, _ = User.objects.get_or_create(username='test_stud_b', defaults={'role': 'student', 'full_name': 'Student B', 'email': 'stud_b@test.com'})
    user_b.set_password('pass123')
    user_b.save()
    student_b, _ = StudentProfile.objects.get_or_create(user=user_b, defaults={
        'register_number': 'REG_TEST_B_902',
        'department': dept_b,
        'programme': prog_b,
        'batch': batch_b,
        'current_semester': sem_b
    })

    # HOD A
    user_hod_a, _ = User.objects.get_or_create(username='test_hod_a_sec', defaults={'role': 'hod', 'full_name': 'HOD A', 'email': 'hoda@test.com'})
    user_hod_a.set_password('pass123')
    user_hod_a.save()
    HODAssignment.objects.get_or_create(user=user_hod_a, defaults={'department': dept_a})

    # Clean previous sessions for test dates
    today = date(2026, 9, 30)
    yesterday = date(2026, 9, 29)
    future = date(2026, 10, 1)
    missing_past = date(2026, 9, 25)
    absent_past = date(2026, 9, 27)

    AttendanceSession.objects.filter(semester=sem_a, date__in=[today, yesterday, future, missing_past, absent_past]).delete()

    # 1. Create entered session for Yesterday (2026-09-29) - 8 Present periods
    for p in range(1, 9):
        sess, _ = AttendanceSession.objects.get_or_create(semester=sem_a, date=yesterday, period_number=p, defaults={'taken_by': user_hod_a})
        AttendanceRecord.objects.get_or_create(session=sess, student=student_a, defaults={'status': 'present'})

    # 2. Create entered session for 2026-09-27 - 8 Absent periods
    for p in range(1, 9):
        sess, _ = AttendanceSession.objects.get_or_create(semester=sem_a, date=absent_past, period_number=p, defaults={'taken_by': user_hod_a})
        AttendanceRecord.objects.get_or_create(session=sess, student=student_a, defaults={'status': 'absent'})

    client.force_authenticate(user=user_a)

    # ----------------------------------------------------
    # TEST 1: 2026-09-29 has attendance -> ENTERED
    # ----------------------------------------------------
    res = client.get(f'/api/attendance/grid/?date={yesterday.strftime("%Y-%m-%d")}')
    assert res.status_code == 200, f"TEST 1 FAIL: {res.data}"
    assert res.data['date_status'] == 'ENTERED', f"TEST 1 FAIL: Expected ENTERED, got {res.data.get('date_status')}"
    assert len(res.data['students']) == 1, "TEST 1 FAIL: Expected student records"
    print("[PASS] TEST 1: 2026-09-29 has attendance -> ENTERED + P/A records.")

    # ----------------------------------------------------
    # TEST 2: 2026-09-30 (Today) has no attendance -> YET_TO_ENTER
    # ----------------------------------------------------
    res = client.get(f'/api/attendance/grid/?date={today.strftime("%Y-%m-%d")}')
    assert res.status_code == 200, f"TEST 2 FAIL: {res.data}"
    assert res.data['date_status'] == 'YET_TO_ENTER', f"TEST 2 FAIL: Expected YET_TO_ENTER, got {res.data.get('date_status')}"
    assert len(res.data['students']) == 0, "TEST 2 FAIL: Expected empty students list"
    print("[PASS] TEST 2: 2026-09-30 (Today) no attendance -> YET_TO_ENTER.")

    # ----------------------------------------------------
    # TEST 3: 2026-10-01 (Future date) has no attendance -> YET_TO_ENTER
    # ----------------------------------------------------
    res = client.get(f'/api/attendance/grid/?date={future.strftime("%Y-%m-%d")}')
    assert res.status_code == 200, f"TEST 3 FAIL: {res.data}"
    assert res.data['date_status'] == 'YET_TO_ENTER', f"TEST 3 FAIL: Expected YET_TO_ENTER, got {res.data.get('date_status')}"
    assert len(res.data['students']) == 0, "TEST 3 FAIL: Expected empty students list"
    print("[PASS] TEST 3: 2026-10-01 (Future) no attendance -> YET_TO_ENTER.")

    # ----------------------------------------------------
    # TEST 4: 2026-09-25 (Past date) has no attendance -> INVALID_DATE
    # ----------------------------------------------------
    res = client.get(f'/api/attendance/grid/?date={missing_past.strftime("%Y-%m-%d")}')
    assert res.status_code == 200, f"TEST 4 FAIL: {res.data}"
    assert res.data['date_status'] == 'INVALID_DATE', f"TEST 4 FAIL: Expected INVALID_DATE, got {res.data.get('date_status')}"
    assert len(res.data['students']) == 0, "TEST 4 FAIL: Expected empty students list"
    print("[PASS] TEST 4: 2026-09-25 (Past date) no attendance -> INVALID_DATE.")

    # ----------------------------------------------------
    # TEST 5 & 6: 2026-09-27 has 8 Absent periods -> ENTERED
    # ----------------------------------------------------
    res = client.get(f'/api/attendance/grid/?date={absent_past.strftime("%Y-%m-%d")}')
    assert res.status_code == 200, f"TEST 5/6 FAIL: {res.data}"
    assert res.data['date_status'] == 'ENTERED', f"TEST 5/6 FAIL: Expected ENTERED, got {res.data.get('date_status')}"
    assert res.data['students'][0]['periods'][1] == 'absent', "TEST 5/6 FAIL: Expected absent"
    print("[PASS] TEST 5 & 6: 2026-09-27 with 8 Absent periods -> ENTERED.")

    # ----------------------------------------------------
    # TEST 7: Missing past date does NOT alter attendance percentage
    # Total recorded periods = 16 (8 present on 29th + 8 absent on 27th) -> 50.0%
    # ----------------------------------------------------
    summary = res.data['summary']
    assert summary['total_periods'] == 16, f"TEST 7 FAIL: Expected 16 recorded periods, got {summary['total_periods']}"
    assert summary['present'] == 8, f"TEST 7 FAIL: Expected 8 present, got {summary['present']}"
    assert summary['absent'] == 8, f"TEST 7 FAIL: Expected 8 absent, got {summary['absent']}"
    assert summary['percentage'] == 50.0, f"TEST 7 FAIL: Expected 50.0%, got {summary['percentage']}"
    print("[PASS] TEST 7: Missing past dates do NOT alter attendance percentage.")

    # ----------------------------------------------------
    # TEST 8: Parameter tampering attack (Student A attempts Student B ID)
    # ----------------------------------------------------
    res = client.get(f'/api/attendance/grid/?student_id={student_b.id}')
    assert res.status_code == 403, f"TEST 8 FAIL: Expected 403, got {res.status_code}"
    print("[PASS] TEST 8: Parameter tampering attack blocked with 403 Forbidden.")

    print("\n==================================================")
    print("ALL 8 STUDENT ATTENDANCE DATE STATUS TESTS PASSED!")
    print("==================================================")

if __name__ == '__main__':
    run_security_tests()
