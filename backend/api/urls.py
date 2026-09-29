from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    login_view, me_view, logout_view, dashboard_overview,
    DepartmentViewSet, ProgrammeViewSet, RegulationViewSet, BatchViewSet, SemesterViewSet,
    hod_assignment_view, StaffViewSet, StudentViewSet, SubjectViewSet, SemesterSubjectViewSet,
    attendance_grid_view, attendance_dashboard_view,
    student_my_subjects_view, teacher_assigned_subjects_view,
    marks_entry_v2_view, hod_publish_marks_view, student_results_view
)

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'programmes', ProgrammeViewSet, basename='programme')
router.register(r'regulations', RegulationViewSet, basename='regulation')
router.register(r'batches', BatchViewSet, basename='batch')
router.register(r'semesters', SemesterViewSet, basename='semester')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'students', StudentViewSet, basename='student')
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'semester-subjects', SemesterSubjectViewSet, basename='semester-subject')

urlpatterns = [
    # Auth
    path('auth/login/', login_view, name='api_login'),
    path('auth/me/', me_view, name='api_me'),
    path('auth/logout/', logout_view, name='api_logout'),

    # Dashboard
    path('dashboard/', dashboard_overview, name='api_dashboard'),

    # HOD Assignment
    path('hod-assignments/', hod_assignment_view, name='api_hod_assignments'),

    # Attendance
    path('attendance/', attendance_grid_view, name='api_attendance_base'),
    path('attendance/grid/', attendance_grid_view, name='api_attendance_grid'),
    path('attendance/dashboard/', attendance_dashboard_view, name='api_attendance_dashboard'),

    # Student Subjects & History
    path('student/my-subjects/', student_my_subjects_view, name='api_student_my_subjects'),

    # Teacher Assigned Subjects
    path('teacher/assigned-subjects/', teacher_assigned_subjects_view, name='api_teacher_assigned_subjects'),

    # Marks Management
    path('marks/v2/entry/', marks_entry_v2_view, name='api_marks_v2_entry'),
    path('marks/v2/publish/', hod_publish_marks_view, name='api_marks_v2_publish'),
    path('student/results/', student_results_view, name='api_student_results'),

    # Router endpoints
    path('', include(router.urls)),
]
