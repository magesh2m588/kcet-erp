from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db import transaction
from datetime import datetime
from django.utils import timezone
from django.db.models import Count, Q, Avg, Sum

from accounts.models import User, HODAssignment
from academics.models import Department, Programme, Regulation, Batch, Semester, Subject, SemesterSubject, FacultySubjectAssignment
from staff.models import StaffProfile
from students.models import StudentProfile
from attendance.models import AttendanceSession, AttendanceRecord
from marks.models import Assessment, Mark

from .serializers import (
    UserSerializer, DepartmentSerializer, ProgrammeSerializer, RegulationSerializer,
    BatchSerializer, SemesterSerializer, SubjectSerializer, SemesterSubjectSerializer,
    FacultyAssignmentSerializer, StaffProfileSerializer, StudentProfileSerializer,
    AttendanceRecordSerializer, AssessmentSerializer, MarkSerializer
)
from .permissions import IsAdminUserRole, IsHODUserRole, IsTeacherUserRole, IsStudentUserRole, IsAdminOrHOD, IsStaffUserRole

# ================================
# AUTHENTICATION VIEWS
# ================================

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    Authenticate user by username/email/register_number + password.
    Returns user details and authentication token.
    NO ACCOUNT LOCKOUT IS ENFORCED.
    """
    identifier = request.data.get('identifier') or request.data.get('username') or request.data.get('email')
    password = request.data.get('password')

    if not identifier or not password:
        return Response({'error': 'Please provide both username/email/register number and password.'}, status=status.HTTP_400_BAD_REQUEST)

    # Try matching username directly
    user = authenticate(request, username=identifier, password=password)

    if not user:
        # Try matching email
        try:
            matched_user = User.objects.filter(email=identifier).first()
            if matched_user:
                user = authenticate(request, username=matched_user.username, password=password)
        except Exception:
            pass

    if not user:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

    token, _ = Token.objects.get_or_create(user=user)
    serializer = UserSerializer(user)
    return Response({
        'token': token.key,
        'user': serializer.data
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'message': 'Logged out successfully.'})


# ================================
# DASHBOARD OVERVIEW VIEW
# ================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_overview(request):
    user = request.user
    role = user.role

    if role == 'admin':
        total_students = StudentProfile.objects.count()
        total_staff = StaffProfile.objects.count()
        total_departments = Department.objects.count()
        total_subjects = Subject.objects.count()
        total_batches = Batch.objects.count()
        
        departments = DepartmentSerializer(Department.objects.all(), many=True).data

        return Response({
            'role': 'admin',
            'stats': {
                'total_students': total_students,
                'total_staff': total_staff,
                'total_departments': total_departments,
                'total_subjects': total_subjects,
                'total_batches': total_batches,
            },
            'departments': departments,
        })

    elif role == 'hod':
        if not hasattr(user, 'hod_profile'):
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        dept = user.hod_profile.department
        dept_students = StudentProfile.objects.filter(department=dept).count()
        dept_staff = StaffProfile.objects.filter(department=dept).count()
        dept_subjects = Subject.objects.filter(department=dept).count()
        dept_batches = Batch.objects.filter(programme__department=dept).count()

        return Response({
            'role': 'hod',
            'department': DepartmentSerializer(dept).data,
            'stats': {
                'total_students': dept_students,
                'total_staff': dept_staff,
                'total_subjects': dept_subjects,
                'total_batches': dept_batches,
            }
        })

    elif role == 'teacher':
        if not hasattr(user, 'staff_profile'):
            return Response({'error': 'Teacher staff profile not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        dept = user.staff_profile.department
        assigned_subjects_count = FacultySubjectAssignment.objects.filter(staff_user=user).count()

        return Response({
            'role': 'teacher',
            'department': DepartmentSerializer(dept).data,
            'stats': {
                'assigned_subjects_count': assigned_subjects_count,
            }
        })

    elif role == 'student':
        if not hasattr(user, 'student_profile'):
            return Response({'error': 'Student profile not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        student = user.student_profile
        
        # Calculate student's overall attendance % for current semester
        current_sem = student.current_semester
        total_records = AttendanceRecord.objects.filter(student=student, session__semester=current_sem).count()
        present_records = AttendanceRecord.objects.filter(student=student, session__semester=current_sem, status='present').count()
        
        att_percentage = round((present_records / total_records * 100), 1) if total_records > 0 else 0.0

        # Published assessments for current semester
        published_marks_count = Mark.objects.filter(
            student=student,
            assessment__status='published',
            assessment__semester_subject__semester=current_sem
        ).count()

        return Response({
            'role': 'student',
            'student_info': StudentProfileSerializer(student).data,
            'stats': {
                'attendance_percentage': att_percentage,
                'total_recorded_periods': total_records,
                'present_periods': present_records,
                'published_assessments_count': published_marks_count,
            }
        })

    return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)


# ================================
# ACADEMIC STRUCTURE VIEWS
# ================================

class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProgrammeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProgrammeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Programme.objects.all()
        # STRICT HOD ISOLATION: HODs only see their own department's programmes
        if user.role == 'hod' and hasattr(user, 'hod_profile'):
            qs = qs.filter(department=user.hod_profile.department)
        return qs


class RegulationViewSet(viewsets.ModelViewSet):
    queryset = Regulation.objects.all()
    serializer_class = RegulationSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUserRole()]
        return [permissions.IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.batches.exists():
            return Response({'error': f'Cannot delete regulation {instance.code} because it is referenced by existing batches.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class BatchViewSet(viewsets.ModelViewSet):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUserRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Batch.objects.all()

        # STRICT HOD ISOLATION: HODs only see their own department's batches
        if user.role == 'hod' and hasattr(user, 'hod_profile'):
            qs = qs.filter(programme__department=user.hod_profile.department)

        dept_id = self.request.query_params.get('department')
        reg_id = self.request.query_params.get('regulation')
        if dept_id:
            qs = qs.filter(programme__department_id=dept_id)
        if reg_id:
            qs = qs.filter(regulation_id=reg_id)
        return qs


class SemesterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Semester.objects.all()
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        return qs


# ================================
# HOD ASSIGNMENT (ADMIN ONLY)
# ================================

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUserRole])
def hod_assignment_view(request):
    if request.method == 'GET':
        assignments = HODAssignment.objects.select_related('department', 'user').all()
        data = []
        for assign in assignments:
            data.append({
                'id': assign.id,
                'department_id': assign.department.id,
                'department_name': assign.department.name,
                'department_code': assign.department.code,
                'hod_name': assign.user.full_name,
                'hod_email': assign.user.email,
                'staff_code': assign.staff_code,
                'created_at': assign.created_at
            })
        return Response(data)

    elif request.method == 'POST':
        dept_id = request.data.get('department')
        full_name = request.data.get('name')
        email = request.data.get('email')
        staff_code = request.data.get('staff_code')
        phone = request.data.get('phone', '')
        password = request.data.get('password')

        if not all([dept_id, full_name, email, staff_code, password]):
            return Response({'error': 'Please fill all required fields.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            department = Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            return Response({'error': 'Invalid department.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # If an active HOD exists for this department, safely remove HOD assignment/role
            existing_hod_assign = HODAssignment.objects.filter(department=department).first()
            if existing_hod_assign:
                old_user = existing_hod_assign.user
                old_user.role = 'teacher' # Revert to teacher or inactive HOD
                old_user.save()
                existing_hod_assign.delete()

            # Create or update user account
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    'email': email,
                    'full_name': full_name,
                    'phone': phone,
                    'role': 'hod'
                }
            )
            user.full_name = full_name
            user.phone = phone
            user.role = 'hod'
            user.set_password(password)
            user.save()

            # Create HOD assignment
            assign = HODAssignment.objects.create(
                department=department,
                user=user,
                staff_code=staff_code
            )

            # Ensure StaffProfile exists
            StaffProfile.objects.update_or_create(
                user=user,
                defaults={
                    'department': department,
                    'staff_code': staff_code,
                    'designation': 'Head of Department'
                }
            )

        return Response({'message': f'HOD {full_name} assigned to {department.code} successfully.'}, status=status.HTTP_201_CREATED)


# ================================
# STAFF MANAGEMENT
# ================================

class StaffViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.all()
    serializer_class = StaffProfileSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHODUserRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = StaffProfile.objects.all()
        if user.role == 'hod' and hasattr(user, 'hod_profile'):
            dept = user.hod_profile.department
            qs = qs.filter(department=dept)
        elif user.role == 'teacher' and hasattr(user, 'staff_profile'):
            qs = qs.filter(department=user.staff_profile.department)
        
        dept_id = self.request.query_params.get('department')
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not hasattr(user, 'hod_profile'):
            return Response({'error': 'Only HODs can create staff members.'}, status=status.HTTP_403_FORBIDDEN)

        dept = user.hod_profile.department
        name = request.data.get('full_name')
        email = request.data.get('email')
        staff_code = request.data.get('staff_code')
        designation = request.data.get('designation', 'Assistant Professor')
        phone = request.data.get('phone', '')
        password = request.data.get('password')

        if not all([name, email, staff_code, password]):
            return Response({'error': 'Please fill all required fields.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=email).exists():
            return Response({'error': f'User with email {email} already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            new_user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                full_name=name,
                phone=phone,
                role='teacher'
            )
            staff = StaffProfile.objects.create(
                user=new_user,
                department=dept,
                staff_code=staff_code,
                designation=designation
            )

        serializer = self.get_serializer(staff)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if user.role == 'hod' and instance.department != user.hod_profile.department:
            return Response({'error': 'You can only update staff members in your department.'}, status=status.HTTP_403_FORBIDDEN)

        name = request.data.get('full_name')
        email = request.data.get('email')
        phone = request.data.get('phone')
        designation = request.data.get('designation')
        password = request.data.get('password')

        with transaction.atomic():
            if name:
                instance.user.full_name = name
            if email:
                instance.user.email = email
                instance.user.username = email
            if phone is not None:
                instance.user.phone = phone
            if password:
                instance.user.set_password(password)
            instance.user.save()

            if designation:
                instance.designation = designation
            instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ================================
# STUDENT MANAGEMENT & PROMOTION
# ================================

class StudentViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.all()
    serializer_class = StudentProfileSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'promote', 'demote']:
            return [IsHODUserRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = StudentProfile.objects.all()
        
        if user.role == 'hod' and hasattr(user, 'hod_profile'):
            qs = qs.filter(department=user.hod_profile.department)
        elif user.role == 'student' and hasattr(user, 'student_profile'):
            qs = qs.filter(id=user.student_profile.id)

        dept_id = self.request.query_params.get('department')
        batch_id = self.request.query_params.get('batch')
        sem_id = self.request.query_params.get('semester')

        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if sem_id:
            qs = qs.filter(current_semester_id=sem_id)

        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not hasattr(user, 'hod_profile'):
            return Response({'error': 'Only HODs can add students.'}, status=status.HTTP_403_FORBIDDEN)

        dept = user.hod_profile.department
        name = request.data.get('full_name')
        reg_num = request.data.get('register_number')
        email = request.data.get('email')
        phone = request.data.get('phone', '')
        blood_group = request.data.get('blood_group', 'O+')
        prog_id = request.data.get('programme')
        batch_id = request.data.get('batch')
        sem_id = request.data.get('current_semester')
        password = request.data.get('password')

        if not all([name, reg_num, email, prog_id, batch_id, sem_id, password]):
            return Response({'error': 'Please fill all required fields.'}, status=status.HTTP_400_BAD_REQUEST)

        if StudentProfile.objects.filter(register_number=reg_num).exists():
            return Response({'error': f'Student with Register Number {reg_num} already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            programme = Programme.objects.get(id=prog_id)
            batch = Batch.objects.get(id=batch_id)
            semester = Semester.objects.get(id=sem_id)
        except Exception as e:
            return Response({'error': f'Invalid academic parameters: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            new_user = User.objects.create_user(
                username=reg_num, # Student login identifier is Register Number!
                email=email,
                password=password,
                full_name=name,
                phone=phone,
                role='student'
            )
            student = StudentProfile.objects.create(
                user=new_user,
                register_number=reg_num,
                blood_group=blood_group,
                department=dept,
                programme=programme,
                batch=batch,
                current_semester=semester,
                is_active=True
            )

        serializer = self.get_serializer(student)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if user.role == 'hod' and instance.department != user.hod_profile.department:
            return Response({'error': 'You can only manage students in your department.'}, status=status.HTTP_403_FORBIDDEN)

        name = request.data.get('full_name')
        email = request.data.get('email')
        phone = request.data.get('phone')
        reg_num = request.data.get('register_number')
        blood_group = request.data.get('blood_group')
        sem_id = request.data.get('current_semester')
        password = request.data.get('password')

        with transaction.atomic():
            if name:
                instance.user.full_name = name
            if email:
                instance.user.email = email
            if reg_num:
                instance.register_number = reg_num
                instance.user.username = reg_num
            if phone is not None:
                instance.user.phone = phone
            if password:
                instance.user.set_password(password)
            instance.user.save()

            if blood_group:
                instance.blood_group = blood_group
            if sem_id:
                instance.current_semester_id = sem_id
            instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['POST'], permission_classes=[IsHODUserRole])
    def promote(self, request):
        """
        Promote all students in a batch from current_semester to current_semester + 1
        """
        user = request.user
        dept = user.hod_profile.department
        batch_id = request.data.get('batch')
        from_sem_id = request.data.get('semester')

        if not batch_id or not from_sem_id:
            return Response({'error': 'Batch and current semester are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            current_sem = Semester.objects.get(id=from_sem_id, batch_id=batch_id)
        except Semester.DoesNotExist:
            return Response({'error': 'Invalid batch or semester.'}, status=status.HTTP_400_BAD_REQUEST)

        target_sem_num = current_sem.semester_number + 1
        target_sem = Semester.objects.filter(batch_id=batch_id, semester_number=target_sem_num).first()

        if not target_sem:
            return Response({'error': f'Semester {current_sem.semester_number} is the final semester. Promotion not allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        students = StudentProfile.objects.filter(department=dept, batch_id=batch_id, current_semester=current_sem, is_active=True)
        count = students.count()

        if count == 0:
            return Response({'message': 'No active students found in the selected semester to promote.'}, status=status.HTTP_200_OK)

        students.update(current_semester=target_sem)

        return Response({
            'message': f'Successfully promoted {count} student(s) from {current_sem.label} to {target_sem.label}.',
            'promoted_count': count,
            'new_semester_id': target_sem.id,
            'new_semester_label': target_sem.label
        })

    @action(detail=False, methods=['POST'], permission_classes=[IsHODUserRole])
    def demote(self, request):
        """
        Demote all students in a batch from current_semester to current_semester - 1
        """
        user = request.user
        dept = user.hod_profile.department
        batch_id = request.data.get('batch')
        from_sem_id = request.data.get('semester')

        if not batch_id or not from_sem_id:
            return Response({'error': 'Batch and current semester are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            current_sem = Semester.objects.get(id=from_sem_id, batch_id=batch_id)
        except Semester.DoesNotExist:
            return Response({'error': 'Invalid batch or semester.'}, status=status.HTTP_400_BAD_REQUEST)

        if current_sem.semester_number <= 1:
            return Response({'error': 'Semester 1 cannot be demoted further.'}, status=status.HTTP_400_BAD_REQUEST)

        target_sem_num = current_sem.semester_number - 1
        target_sem = Semester.objects.filter(batch_id=batch_id, semester_number=target_sem_num).first()

        students = StudentProfile.objects.filter(department=dept, batch_id=batch_id, current_semester=current_sem, is_active=True)
        count = students.count()

        if count == 0:
            return Response({'message': 'No active students found in the selected semester to demote.'}, status=status.HTTP_200_OK)

        students.update(current_semester=target_sem)

        return Response({
            'message': f'Successfully demoted {count} student(s) from {current_sem.label} to {target_sem.label}.',
            'demoted_count': count,
            'new_semester_id': target_sem.id,
            'new_semester_label': target_sem.label
        })


# ================================
# SUBJECTS & FACULTY ASSIGNMENT
# ================================

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHODUserRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Subject.objects.all()
        if user.role == 'hod' and hasattr(user, 'hod_profile'):
            qs = qs.filter(department=user.hod_profile.department)
        
        dept_id = self.request.query_params.get('department')
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not hasattr(user, 'hod_profile'):
            return Response({'error': 'Only HODs can create subjects.'}, status=status.HTTP_403_FORBIDDEN)

        dept = user.hod_profile.department
        code = request.data.get('code')
        name = request.data.get('name')
        subject_type = request.data.get('subject_type', 'Theory')
        credits_val = request.data.get('credits', 3.0)
        semester_id = request.data.get('semester_id')

        if not code or not name:
            return Response({'error': 'Subject code and name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            subject = Subject.objects.create(
                department=dept,
                code=code,
                name=name,
                subject_type=subject_type,
                credits=credits_val
            )

            if semester_id:
                semester = Semester.objects.get(id=semester_id)
                SemesterSubject.objects.get_or_create(semester=semester, subject=subject)

        serializer = self.get_serializer(subject)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SemesterSubjectViewSet(viewsets.ModelViewSet):
    queryset = SemesterSubject.objects.all()
    serializer_class = SemesterSubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SemesterSubject.objects.all()
        sem_id = self.request.query_params.get('semester')
        if sem_id:
            qs = qs.filter(semester_id=sem_id)
        return qs

    @action(detail=True, methods=['POST'], permission_classes=[IsHODUserRole])
    def assign_faculty(self, request, pk=None):
        sem_subject = self.get_object()
        staff_user_id = request.data.get('staff_user_id')

        if not staff_user_id:
            return Response({'error': 'Staff user ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            staff_user = User.objects.get(id=staff_user_id, role__in=['teacher', 'hod'])
        except User.DoesNotExist:
            return Response({'error': 'Invalid faculty staff user.'}, status=status.HTTP_400_BAD_REQUEST)

        assignment, created = FacultySubjectAssignment.objects.get_or_create(
            semester_subject=sem_subject,
            staff_user=staff_user
        )

        return Response({
            'message': f'Assigned {staff_user.full_name} to {sem_subject.subject.code}.',
            'assignment_id': assignment.id
        })

    @action(detail=True, methods=['POST'], permission_classes=[IsHODUserRole])
    def unassign_faculty(self, request, pk=None):
        sem_subject = self.get_object()
        staff_user_id = request.data.get('staff_user_id')
        FacultySubjectAssignment.objects.filter(semester_subject=sem_subject, staff_user_id=staff_user_id).delete()
        return Response({'message': 'Faculty assignment removed.'})


# ================================
# ATTENDANCE MANAGEMENT
# ================================

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def attendance_grid_view(request):
    """
    GET: Returns attendance grid or personal student attendance.
         If user is STUDENT:
           - Derived strictly from authenticated student profile (request.user.student_profile).
           - Returns ONLY the authenticated student's attendance & info.
           - Rejects unauthorized parameter tampering (student_id, register_number, department_id, batch_id, regulation_id).
         If user is HOD:
           - Enforces HOD department isolation.
    POST:
         - ONLY HOD can save daily P1-P8 attendance for students in their department.
         - Non-HOD users (including students) receive 403 Forbidden.
    """
    user = request.user

    if request.method == 'GET':
        query = request.query_params

        # --- STUDENT ROLE SECURITY BRANCH ---
        if user.role == 'student':
            if not hasattr(user, 'student_profile'):
                return Response({'error': 'Student profile not found.'}, status=status.HTTP_403_FORBIDDEN)

            student = user.student_profile

            # SECURITY: Check for parameter tampering attempts targeting another student/dept/batch/regulation
            req_student_id = query.get('student_id') or query.get('studentId') or query.get('student')
            if req_student_id and str(req_student_id).strip() != str(student.id):
                return Response({'error': 'PERMISSION DENIED: You cannot view another student\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

            req_reg_num = query.get('register_number') or query.get('registerNumber') or query.get('reg_no')
            if req_reg_num and str(req_reg_num).strip().lower() != str(student.register_number).strip().lower():
                return Response({'error': 'PERMISSION DENIED: You cannot view another student\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

            req_dept_id = query.get('department_id') or query.get('departmentId') or query.get('department')
            if req_dept_id and str(req_dept_id).strip() != str(student.department_id):
                return Response({'error': 'PERMISSION DENIED: You cannot access another department\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

            req_batch_id = query.get('batch_id') or query.get('batchId') or query.get('batch')
            if req_batch_id and str(req_batch_id).strip() != str(student.batch_id):
                return Response({'error': 'PERMISSION DENIED: You cannot access another batch\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

            req_reg_id = query.get('regulation_id') or query.get('regulationId') or query.get('regulation')
            if req_reg_id and (not student.batch or str(req_reg_id).strip() != str(student.batch.regulation_id)):
                return Response({'error': 'PERMISSION DENIED: You cannot access another regulation\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

            req_sem_id = query.get('semester_id') or query.get('semesterId') or query.get('semester')
            if req_sem_id:
                try:
                    semester = Semester.objects.get(id=req_sem_id)
                    if semester.batch_id != student.batch_id:
                        return Response({'error': 'PERMISSION DENIED: You cannot access another batch\'s semester.'}, status=status.HTTP_403_FORBIDDEN)
                except Semester.DoesNotExist:
                    return Response({'error': 'Invalid semester.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                semester = student.current_semester

            today_date = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()
            date_str = query.get('date') or today_date.strftime('%Y-%m-%d')

            try:
                sel_date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                sel_date_obj = today_date
                date_str = today_date.strftime('%Y-%m-%d')

            # Check if attendance sessions exist for this semester & date
            sessions = AttendanceSession.objects.filter(semester=semester, date=date_str)
            has_sessions = sessions.exists()

            if has_sessions:
                date_status = "ENTERED"
                has_attendance = True
                records = AttendanceRecord.objects.filter(session__in=sessions, student=student)

                periods = {p: 'present' for p in range(1, 9)}
                for rec in records:
                    periods[rec.session.period_number] = rec.status

                student_list = [{
                    'id': student.id,
                    'register_number': student.register_number,
                    'full_name': student.user.full_name,
                    'periods': periods
                }]
            else:
                has_attendance = False
                student_list = []
                if sel_date_obj < today_date:
                    date_status = "INVALID_DATE"
                else:
                    date_status = "YET_TO_ENTER"

            # Percentage calculation: ONLY count actual entered attendance records
            total_recorded = AttendanceRecord.objects.filter(student=student, session__semester=semester).count()
            present_recorded = AttendanceRecord.objects.filter(student=student, session__semester=semester, status='present').count()
            absent_recorded = total_recorded - present_recorded
            att_pct = round((present_recorded / total_recorded * 100), 1) if total_recorded > 0 else 0.0

            # History breakdown: ONLY include distinct dates where AttendanceSession records exist
            sem_sessions = AttendanceSession.objects.filter(semester=semester)
            entered_dates = sem_sessions.values_list('date', flat=True).distinct().order_by('-date')
            all_records = AttendanceRecord.objects.filter(session__semester=semester, student=student).select_related('session')

            history_map = {}
            for rec in all_records:
                d_key = str(rec.session.date)
                if d_key not in history_map:
                    history_map[d_key] = {p: 'present' for p in range(1, 9)}
                history_map[d_key][rec.session.period_number] = rec.status

            history_list = []
            for d_val in entered_dates:
                d_key = str(d_val)
                d_periods = history_map.get(d_key, {p: 'present' for p in range(1, 9)})
                d_present = sum(1 for v in d_periods.values() if v == 'present')
                d_absent = sum(1 for v in d_periods.values() if v == 'absent')
                history_list.append({
                    'date': d_key,
                    'periods': d_periods,
                    'present_count': d_present,
                    'absent_count': d_absent
                })

            return Response({
                'date_status': date_status,
                'has_attendance': has_attendance,
                'date': date_str,
                'student_info': {
                    'name': student.user.full_name,
                    'register_number': student.register_number,
                    'department': student.department.name if student.department else '',
                    'regulation': student.batch.regulation.code if (student.batch and student.batch.regulation) else '',
                    'batch': student.batch.label if student.batch else '',
                    'year': student.current_semester.year_number if student.current_semester else 1,
                    'semester': student.current_semester.semester_number if student.current_semester else 1,
                    'semester_label': student.current_semester.label if student.current_semester else ''
                },
                'semester': SemesterSerializer(semester).data if semester else None,
                'students': student_list,
                'summary': {
                    'total_periods': total_recorded,
                    'present': present_recorded,
                    'absent': absent_recorded,
                    'percentage': att_pct
                },
                'history': history_list
            })

        # --- NON-STUDENT USERS (HOD, ADMIN, TEACHER) ---
        sem_id = query.get('semester_id')
        date_str = query.get('date')

        if not sem_id or not date_str:
            return Response({'error': 'Semester ID and date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            semester = Semester.objects.get(id=sem_id)
        except Semester.DoesNotExist:
            return Response({'error': 'Invalid semester.'}, status=status.HTTP_400_BAD_REQUEST)

        # Strictly enforce HOD department isolation
        if user.role == 'hod' and hasattr(user, 'hod_profile'):
            hod_dept = user.hod_profile.department
            if semester.batch.programme.department != hod_dept:
                return Response({'error': 'PERMISSION DENIED: Cannot view attendance for another department.'}, status=status.HTTP_403_FORBIDDEN)

        students = StudentProfile.objects.filter(current_semester=semester, is_active=True).select_related('user')
        sessions = AttendanceSession.objects.filter(semester=semester, date=date_str)
        records = AttendanceRecord.objects.filter(session__in=sessions).select_related('student', 'session')

        grid_data = {}
        for st in students:
            grid_data[st.id] = {
                'id': st.id,
                'register_number': st.register_number,
                'full_name': st.user.full_name,
                'periods': {p: 'present' for p in range(1, 9)}
            }

        for rec in records:
            p_num = rec.session.period_number
            if rec.student_id in grid_data:
                grid_data[rec.student_id]['periods'][p_num] = rec.status

        return Response({
            'semester': SemesterSerializer(semester).data,
            'date': date_str,
            'students': list(grid_data.values())
        })

    elif request.method == 'POST':
        # STRICT HOD PERMISSION ENFORCEMENT: Only HOD can record/modify attendance
        if user.role != 'hod' or not hasattr(user, 'hod_profile'):
            return Response({'error': 'PERMISSION DENIED: Only HODs can record attendance.'}, status=status.HTTP_403_FORBIDDEN)

        hod_dept = user.hod_profile.department
        sem_id = request.data.get('semester_id')
        date_str = request.data.get('date')
        attendance_payload = request.data.get('attendance')

        if not sem_id or not date_str or not attendance_payload:
            return Response({'error': 'Semester ID, date, and attendance grid data are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            semester = Semester.objects.get(id=sem_id)
        except Semester.DoesNotExist:
            return Response({'error': 'Invalid semester.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify semester belongs to HOD department
        if semester.batch.programme.department != hod_dept:
            return Response({'error': 'PERMISSION DENIED: Cannot manage attendance for another department.'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            session_objs = {}
            for p in range(1, 9):
                sess, _ = AttendanceSession.objects.get_or_create(
                    semester=semester,
                    date=date_str,
                    period_number=p,
                    defaults={'taken_by': user}
                )
                session_objs[p] = sess

            for student_id_str, student_data in attendance_payload.items():
                try:
                    student = StudentProfile.objects.get(id=student_id_str, department=hod_dept)
                except StudentProfile.DoesNotExist:
                    continue

                periods_dict = student_data.get('periods', {})
                for p_num in range(1, 9):
                    p_status = periods_dict.get(str(p_num)) or periods_dict.get(p_num) or 'present'
                    AttendanceRecord.objects.update_or_create(
                        session=session_objs[p_num],
                        student=student,
                        defaults={'status': p_status}
                    )

        return Response({'message': f'Daily attendance saved successfully for {date_str}.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def attendance_dashboard_view(request):
    """
    Returns total attendance percentage per student for a selected semester.
    For STUDENT role: returns ONLY the authenticated student's summary.
    For HOD role: enforces department isolation.
    """
    user = request.user
    query = request.query_params

    if user.role == 'student':
        if not hasattr(user, 'student_profile'):
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_403_FORBIDDEN)

        student = user.student_profile

        # SECURITY: Parameter tampering checks
        req_student_id = query.get('student_id') or query.get('studentId') or query.get('student')
        if req_student_id and str(req_student_id).strip() != str(student.id):
            return Response({'error': 'PERMISSION DENIED: You cannot view another student\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

        req_reg_num = query.get('register_number') or query.get('registerNumber') or query.get('reg_no')
        if req_reg_num and str(req_reg_num).strip().lower() != str(student.register_number).strip().lower():
            return Response({'error': 'PERMISSION DENIED: You cannot view another student\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

        req_dept_id = query.get('department_id') or query.get('departmentId') or query.get('department')
        if req_dept_id and str(req_dept_id).strip() != str(student.department_id):
            return Response({'error': 'PERMISSION DENIED: You cannot access another department\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

        req_batch_id = query.get('batch_id') or query.get('batchId') or query.get('batch')
        if req_batch_id and str(req_batch_id).strip() != str(student.batch_id):
            return Response({'error': 'PERMISSION DENIED: You cannot access another batch\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

        req_reg_id = query.get('regulation_id') or query.get('regulationId') or query.get('regulation')
        if req_reg_id and (not student.batch or str(req_reg_id).strip() != str(student.batch.regulation_id)):
            return Response({'error': 'PERMISSION DENIED: You cannot access another regulation\'s attendance.'}, status=status.HTTP_403_FORBIDDEN)

        req_sem_id = query.get('semester_id') or query.get('semesterId') or query.get('semester')
        if req_sem_id:
            try:
                semester = Semester.objects.get(id=req_sem_id)
                if semester.batch_id != student.batch_id:
                    return Response({'error': 'PERMISSION DENIED: You cannot access another batch\'s semester.'}, status=status.HTTP_403_FORBIDDEN)
            except Semester.DoesNotExist:
                return Response({'error': 'Invalid semester.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            semester = student.current_semester

        sessions_count = AttendanceSession.objects.filter(semester=semester).count()
        total_recs = AttendanceRecord.objects.filter(student=student, session__semester=semester).count()
        present_recs = AttendanceRecord.objects.filter(student=student, session__semester=semester, status='present').count()
        absent_recs = total_recs - present_recs
        percentage = round((present_recs / total_recs * 100), 1) if total_recs > 0 else 0.0

        return Response({
            'semester': SemesterSerializer(semester).data if semester else None,
            'total_sessions': sessions_count,
            'student_summaries': [{
                'student_id': student.id,
                'register_number': student.register_number,
                'full_name': student.user.full_name,
                'total_recorded_periods': total_recs,
                'present_periods': present_recs,
                'absent_periods': absent_recs,
                'percentage': percentage
            }]
        })

    # --- NON-STUDENT USERS ---
    sem_id = query.get('semester_id')
    if not sem_id:
        return Response({'error': 'Semester ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        semester = Semester.objects.get(id=sem_id)
    except Semester.DoesNotExist:
        return Response({'error': 'Invalid semester.'}, status=status.HTTP_400_BAD_REQUEST)

    if user.role == 'hod' and hasattr(user, 'hod_profile'):
        hod_dept = user.hod_profile.department
        if semester.batch.programme.department != hod_dept:
            return Response({'error': 'PERMISSION DENIED: Cannot view attendance for another department.'}, status=status.HTTP_403_FORBIDDEN)

    students = StudentProfile.objects.filter(current_semester=semester, is_active=True).select_related('user')
    sessions_count = AttendanceSession.objects.filter(semester=semester).count()

    results = []
    for st in students:
        total_recs = AttendanceRecord.objects.filter(student=st, session__semester=semester).count()
        present_recs = AttendanceRecord.objects.filter(student=st, session__semester=semester, status='present').count()
        absent_recs = total_recs - present_recs
        percentage = round((present_recs / total_recs * 100), 1) if total_recs > 0 else 0.0

        results.append({
            'student_id': st.id,
            'register_number': st.register_number,
            'full_name': st.user.full_name,
            'total_recorded_periods': total_recs,
            'present_periods': present_recs,
            'absent_periods': absent_recs,
            'percentage': percentage
        })

    return Response({
        'semester': SemesterSerializer(semester).data,
        'total_sessions': sessions_count,
        'student_summaries': results
    })


# ================================
# MARKS MANAGEMENT & STUDENT SUBJECTS
# ================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_my_subjects_view(request):
    """
    Returns current semester subjects and previous semester subjects for logged-in student.
    Read-only view with faculty assignment details.
    """
    user = request.user
    if user.role != 'student' or not hasattr(user, 'student_profile'):
        return Response({'error': 'Only students can access My Subjects.'}, status=status.HTTP_403_FORBIDDEN)

    student = user.student_profile
    curr_sem = student.current_semester

    # 1. Current Semester Subjects
    curr_sem_subs = SemesterSubject.objects.filter(semester=curr_sem).select_related('subject')
    curr_list = []
    for ss in curr_sem_subs:
        assignment = FacultySubjectAssignment.objects.filter(semester_subject=ss).select_related('staff_user').first()
        faculty_name = assignment.staff_user.full_name if assignment else "Not Assigned"
        curr_list.append({
            'id': ss.id,
            'subject_id': ss.subject.id,
            'code': ss.subject.code,
            'name': ss.subject.name,
            'subject_type': ss.subject.subject_type,
            'credits': float(ss.subject.credits),
            'faculty_name': faculty_name,
        })

    # 2. Previous Semesters Subjects
    prev_semesters = Semester.objects.filter(
        batch=student.batch,
        semester_number__lt=curr_sem.semester_number
    ).order_by('semester_number')

    prev_list = []
    for sem in prev_semesters:
        sem_subs = SemesterSubject.objects.filter(semester=sem).select_related('subject')
        subs_data = []
        for ss in sem_subs:
            assignment = FacultySubjectAssignment.objects.filter(semester_subject=ss).select_related('staff_user').first()
            faculty_name = assignment.staff_user.full_name if assignment else "Not Assigned"
            subs_data.append({
                'id': ss.id,
                'subject_id': ss.subject.id,
                'code': ss.subject.code,
                'name': ss.subject.name,
                'subject_type': ss.subject.subject_type,
                'credits': float(ss.subject.credits),
                'faculty_name': faculty_name,
            })
        prev_list.append({
            'semester_id': sem.id,
            'year_number': sem.year_number,
            'semester_number': sem.semester_number,
            'label': sem.label,
            'subjects': subs_data,
        })

    return Response({
        'student': {
            'register_number': student.register_number,
            'full_name': user.full_name,
            'programme': student.programme.name,
            'regulation': student.batch.regulation.code,
            'batch': student.batch.label,
            'current_year': curr_sem.year_number,
            'current_semester': curr_sem.semester_number,
            'current_semester_label': curr_sem.label,
        },
        'current_semester_subjects': curr_list,
        'previous_semesters': prev_list,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_assigned_subjects_view(request):
    """
    Returns subjects assigned to the logged-in teacher via FacultySubjectAssignment.
    STRICT ENFORCEMENT: Teachers ONLY see subjects assigned to them.
    HODs see subjects in their department.
    """
    user = request.user
    batch_id = request.query_params.get('batch')
    sem_id = request.query_params.get('semester')
    reg_id = request.query_params.get('regulation')

    if user.role == 'teacher':
        assignments = FacultySubjectAssignment.objects.filter(staff_user=user).select_related(
            'semester_subject__semester__batch__regulation',
            'semester_subject__semester__batch__programme',
            'semester_subject__subject'
        )
        if batch_id:
            assignments = assignments.filter(semester_subject__semester__batch_id=batch_id)
        if sem_id:
            assignments = assignments.filter(semester_subject__semester_id=sem_id)
        if reg_id:
            assignments = assignments.filter(semester_subject__semester__batch__regulation_id=reg_id)

        results = []
        for a in assignments:
            ss = a.semester_subject
            results.append({
                'semester_subject_id': ss.id,
                'subject_id': ss.subject.id,
                'code': ss.subject.code,
                'name': ss.subject.name,
                'subject_type': ss.subject.subject_type,
                'credits': float(ss.subject.credits),
                'batch_id': ss.semester.batch.id,
                'batch_label': ss.semester.batch.label,
                'regulation_code': ss.semester.batch.regulation.code,
                'semester_id': ss.semester.id,
                'year_number': ss.semester.year_number,
                'semester_number': ss.semester.semester_number,
                'semester_label': ss.semester.label,
            })
        return Response(results)

    elif user.role == 'hod' and hasattr(user, 'hod_profile'):
        dept = user.hod_profile.department
        qs = SemesterSubject.objects.filter(
            semester__batch__programme__department=dept
        ).select_related('semester__batch__regulation', 'semester__batch__programme', 'subject')

        if batch_id:
            qs = qs.filter(semester__batch_id=batch_id)
        if sem_id:
            qs = qs.filter(semester_id=sem_id)
        if reg_id:
            qs = qs.filter(semester__batch__regulation_id=reg_id)

        results = []
        for ss in qs:
            assignment = FacultySubjectAssignment.objects.filter(semester_subject=ss).select_related('staff_user').first()
            faculty_name = assignment.staff_user.full_name if assignment else "Not Assigned"
            results.append({
                'semester_subject_id': ss.id,
                'subject_id': ss.subject.id,
                'code': ss.subject.code,
                'name': ss.subject.name,
                'subject_type': ss.subject.subject_type,
                'credits': float(ss.subject.credits),
                'batch_id': ss.semester.batch.id,
                'batch_label': ss.semester.batch.label,
                'regulation_code': ss.semester.batch.regulation.code,
                'semester_id': ss.semester.id,
                'year_number': ss.semester.year_number,
                'semester_number': ss.semester.semester_number,
                'semester_label': ss.semester.label,
                'faculty_name': faculty_name,
            })
        return Response(results)

    elif user.role == 'admin':
        qs = SemesterSubject.objects.all().select_related('semester__batch__regulation', 'semester__batch__programme', 'subject')
        if batch_id:
            qs = qs.filter(semester__batch_id=batch_id)
        if sem_id:
            qs = qs.filter(semester_id=sem_id)
        if reg_id:
            qs = qs.filter(semester__batch__regulation_id=reg_id)

        results = []
        for ss in qs:
            assignment = FacultySubjectAssignment.objects.filter(semester_subject=ss).select_related('staff_user').first()
            faculty_name = assignment.staff_user.full_name if assignment else "Not Assigned"
            results.append({
                'semester_subject_id': ss.id,
                'subject_id': ss.subject.id,
                'code': ss.subject.code,
                'name': ss.subject.name,
                'subject_type': ss.subject.subject_type,
                'credits': float(ss.subject.credits),
                'batch_id': ss.semester.batch.id,
                'batch_label': ss.semester.batch.label,
                'regulation_code': ss.semester.batch.regulation.code,
                'semester_id': ss.semester.id,
                'year_number': ss.semester.year_number,
                'semester_number': ss.semester.semester_number,
                'semester_label': ss.semester.label,
                'faculty_name': faculty_name,
            })
        return Response(results)

    return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def marks_entry_v2_view(request):
    """
    GET: Retrieve student list and existing marks for a specific semester_subject & exam_name (IAT 1, IAT 2, ANNA UNIVERSITY).
    POST: Save marks/grades for students.
    STRICT SECURITY: Teachers can ONLY enter marks for subjects assigned to them via FacultySubjectAssignment.
    """
    user = request.user

    if request.method == 'GET':
        sem_sub_id = request.query_params.get('semester_subject_id')
        exam_name = request.query_params.get('exam_name') # IAT 1, IAT 2, ANNA UNIVERSITY

        if not sem_sub_id or not exam_name:
            return Response({'error': 'Semester Subject ID and Exam Name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sem_subject = SemesterSubject.objects.select_related(
                'semester__batch__programme__department',
                'semester__batch__regulation',
                'subject'
            ).get(id=sem_sub_id)
        except SemesterSubject.DoesNotExist:
            return Response({'error': 'Invalid semester subject.'}, status=status.HTTP_400_BAD_REQUEST)

        # Security Checks
        if user.role == 'teacher':
            is_assigned = FacultySubjectAssignment.objects.filter(semester_subject=sem_subject, staff_user=user).exists()
            if not is_assigned:
                return Response({'error': 'PERMISSION DENIED: You are not assigned to teach this subject.'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'hod' and hasattr(user, 'hod_profile'):
            if sem_subject.semester.batch.programme.department != user.hod_profile.department:
                return Response({'error': 'PERMISSION DENIED: Cannot view marks for another department.'}, status=status.HTTP_403_FORBIDDEN)

        # Get or create assessment
        assessment, _ = Assessment.objects.get_or_create(
            semester_subject=sem_subject,
            name=exam_name,
            defaults={'created_by': user, 'status': 'draft', 'max_marks': 100.0}
        )

        # Retrieve active students in this batch & semester
        semester = sem_subject.semester
        students = StudentProfile.objects.filter(
            batch=semester.batch,
            current_semester=semester,
            is_active=True
        ).select_related('user').order_by('register_number')

        marks_map = {m.student_id: m for m in Mark.objects.filter(assessment=assessment)}

        results = []
        for st in students:
            m = marks_map.get(st.id)
            results.append({
                'student_id': st.id,
                'register_number': st.register_number,
                'full_name': st.user.full_name,
                'obtained_marks': float(m.obtained_marks) if m and m.obtained_marks is not None else None,
                'grade': m.grade if m else None,
            })

        assignment = FacultySubjectAssignment.objects.filter(semester_subject=sem_subject).select_related('staff_user').first()
        faculty_name = assignment.staff_user.full_name if assignment else "Not Assigned"

        return Response({
            'assessment': {
                'id': assessment.id,
                'name': assessment.name,
                'status': assessment.status,
                'published_date': assessment.published_date,
                'created_by_name': assessment.created_by.full_name if assessment.created_by else None,
                'published_by_name': assessment.published_by.full_name if assessment.published_by else None,
            },
            'subject': {
                'code': sem_subject.subject.code,
                'name': sem_subject.subject.name,
                'subject_type': sem_subject.subject.subject_type,
                'credits': float(sem_subject.subject.credits),
                'faculty_name': faculty_name,
            },
            'academic_context': {
                'regulation_code': semester.batch.regulation.code,
                'batch_label': semester.batch.label,
                'year_number': semester.year_number,
                'semester_number': semester.semester_number,
                'semester_label': semester.label,
            },
            'exam_type': 'grade' if exam_name == 'ANNA UNIVERSITY' else 'numeric',
            'students': results,
        })

    elif request.method == 'POST':
        if user.role not in ['teacher', 'hod', 'admin']:
            return Response({'error': 'PERMISSION DENIED: Students cannot enter marks.'}, status=status.HTTP_403_FORBIDDEN)

        sem_sub_id = request.data.get('semester_subject_id')
        exam_name = request.data.get('exam_name')
        marks_payload = request.data.get('marks') # list of { student_id, mark_value, grade_value }

        if not sem_sub_id or not exam_name or marks_payload is None:
            return Response({'error': 'Semester Subject ID, Exam Name, and Marks payload are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sem_subject = SemesterSubject.objects.select_related('semester__batch__programme__department').get(id=sem_sub_id)
        except SemesterSubject.DoesNotExist:
            return Response({'error': 'Invalid semester subject.'}, status=status.HTTP_400_BAD_REQUEST)

        # Security Check
        if user.role == 'teacher':
            is_assigned = FacultySubjectAssignment.objects.filter(semester_subject=sem_subject, staff_user=user).exists()
            if not is_assigned:
                return Response({'error': 'PERMISSION DENIED: You can only enter marks for assigned subjects.'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'hod' and hasattr(user, 'hod_profile'):
            if sem_subject.semester.batch.programme.department != user.hod_profile.department:
                return Response({'error': 'PERMISSION DENIED: Cannot enter marks for another department.'}, status=status.HTTP_403_FORBIDDEN)

        # Get or create assessment
        assessment, _ = Assessment.objects.get_or_create(
            semester_subject=sem_subject,
            name=exam_name,
            defaults={'created_by': user, 'status': 'draft', 'max_marks': 100.0}
        )

        valid_grades = {'O', 'A+', 'A', 'B+', 'B', 'C', 'AR'}

        with transaction.atomic():
            for item in marks_payload:
                st_id = item.get('student_id')
                mark_val = item.get('mark_value')
                grade_val = item.get('grade_value')

                if not st_id:
                    continue

                if exam_name in ['IAT 1', 'IAT 2']:
                    # Must be numeric mark 0 - 100, no grade
                    if mark_val is None or mark_val == '':
                        Mark.objects.filter(assessment=assessment, student_id=st_id).delete()
                    else:
                        try:
                            val = float(mark_val)
                            if val < 0.0 or val > 100.0:
                                return Response({'error': f'Mark for student must be between 0 and 100. Invalid value: {val}'}, status=status.HTTP_400_BAD_REQUEST)
                            Mark.objects.update_or_create(
                                assessment=assessment,
                                student_id=st_id,
                                defaults={'obtained_marks': val, 'grade': None}
                            )
                        except (ValueError, TypeError):
                            return Response({'error': f'Invalid mark value: {mark_val}'}, status=status.HTTP_400_BAD_REQUEST)

                elif exam_name == 'ANNA UNIVERSITY':
                    # Must be Grade, no numeric mark
                    if not grade_val or grade_val == '':
                        Mark.objects.filter(assessment=assessment, student_id=st_id).delete()
                    else:
                        clean_grade = str(grade_val).strip().upper()
                        if clean_grade not in valid_grades:
                            return Response({'error': f'Invalid grade for Anna University: {clean_grade}. Allowed: O, A+, A, B+, B, C, AR'}, status=status.HTTP_400_BAD_REQUEST)
                        Mark.objects.update_or_create(
                            assessment=assessment,
                            student_id=st_id,
                            defaults={'obtained_marks': None, 'grade': clean_grade}
                        )

        return Response({'message': f'Marks for {exam_name} saved successfully.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def hod_publish_marks_view(request):
    """
    HOD publishes marks for a specific semester_subject & exam_name.
    STRICT SECURITY: HOD can ONLY publish marks for their own department.
    """
    user = request.user
    if user.role != 'hod' or not hasattr(user, 'hod_profile'):
        return Response({'error': 'PERMISSION DENIED: Only HODs can publish marks.'}, status=status.HTTP_403_FORBIDDEN)

    sem_sub_id = request.data.get('semester_subject_id')
    exam_name = request.data.get('exam_name')

    if not sem_sub_id or not exam_name:
        return Response({'error': 'Semester Subject ID and Exam Name are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        sem_subject = SemesterSubject.objects.select_related('semester__batch__programme__department').get(id=sem_sub_id)
    except SemesterSubject.DoesNotExist:
        return Response({'error': 'Invalid semester subject.'}, status=status.HTTP_400_BAD_REQUEST)

    # HOD department check
    if sem_subject.semester.batch.programme.department != user.hod_profile.department:
        return Response({'error': 'PERMISSION DENIED: Cannot publish marks for another department.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        assessment = Assessment.objects.get(semester_subject=sem_subject, name=exam_name)
    except Assessment.DoesNotExist:
        return Response({'error': 'No marks entered for this exam yet.'}, status=status.HTTP_400_BAD_REQUEST)

    assessment.status = 'published'
    assessment.published_by = user
    assessment.published_date = timezone.now()
    assessment.save()

    return Response({'message': f'{exam_name} marks for {sem_subject.subject.code} published successfully!'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_results_view(request):
    """
    Student views published marks for a selected Year, Semester, and Exam Name.
    STRICT SECURITY: Returns ONLY published marks for the authenticated student.
    If unpublished: returns status 'unpublished' with message 'Yet to be published'.
    """
    user = request.user
    if user.role != 'student' or not hasattr(user, 'student_profile'):
        return Response({'error': 'Only students can view Student Results.'}, status=status.HTTP_403_FORBIDDEN)

    student = user.student_profile
    sem_number = request.query_params.get('semester_number')
    exam_name = request.query_params.get('exam_name') # IAT 1, IAT 2, ANNA UNIVERSITY

    if not sem_number or not exam_name:
        return Response({'error': 'Semester Number and Exam Name are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        semester = Semester.objects.get(batch=student.batch, semester_number=sem_number)
    except Semester.DoesNotExist:
        return Response({'error': 'Invalid semester selection.'}, status=status.HTTP_400_BAD_REQUEST)

    sem_subjects = SemesterSubject.objects.filter(semester=semester).select_related('subject')

    results = []
    published_count = 0
    total_subjects = sem_subjects.count()

    for ss in sem_subjects:
        assessment = Assessment.objects.filter(semester_subject=ss, name=exam_name, status='published').first()
        if assessment:
            published_count += 1
            mark = Mark.objects.filter(assessment=assessment, student=student).first()
            if exam_name in ['IAT 1', 'IAT 2']:
                m_val = float(mark.obtained_marks) if mark and mark.obtained_marks is not None else None
                res_str = 'PASS' if m_val is not None and m_val >= 50.0 else ('FAIL' if m_val is not None else 'AB')
                results.append({
                    'subject_code': ss.subject.code,
                    'subject_name': ss.subject.name,
                    'subject_type': ss.subject.subject_type,
                    'credits': float(ss.subject.credits),
                    'mark': m_val,
                    'grade': None,
                    'result': res_str,
                })
            elif exam_name == 'ANNA UNIVERSITY':
                g_val = mark.grade if mark else None
                res_str = 'ARREAR' if g_val == 'AR' else ('PASS' if g_val else 'AB')
                results.append({
                    'subject_code': ss.subject.code,
                    'subject_name': ss.subject.name,
                    'subject_type': ss.subject.subject_type,
                    'credits': float(ss.subject.credits),
                    'mark': None,
                    'grade': g_val,
                    'result': res_str,
                })

    if published_count == 0:
        return Response({
            'status': 'unpublished',
            'message': 'Yet to be published',
            'student_info': {
                'full_name': user.full_name,
                'register_number': student.register_number,
                'programme_name': student.programme.name,
                'regulation_code': student.batch.regulation.code,
                'batch_label': student.batch.label,
                'year_number': semester.year_number,
                'semester_number': semester.semester_number,
                'semester_label': semester.label,
                'exam_name': exam_name,
            }
        })

    return Response({
        'status': 'published',
        'student_info': {
            'full_name': user.full_name,
            'register_number': student.register_number,
            'programme_name': student.programme.name,
            'regulation_code': student.batch.regulation.code,
            'batch_label': student.batch.label,
            'year_number': semester.year_number,
            'semester_number': semester.semester_number,
            'semester_label': semester.label,
            'exam_name': exam_name,
        },
        'exam_type': 'grade' if exam_name == 'ANNA UNIVERSITY' else 'numeric',
        'results': results,
    })

