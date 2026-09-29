from rest_framework import serializers
from accounts.models import User, HODAssignment
from academics.models import Department, Programme, Regulation, Batch, Semester, Subject, SemesterSubject, FacultySubjectAssignment
from staff.models import StaffProfile
from students.models import StudentProfile
from attendance.models import AttendanceSession, AttendanceRecord
from marks.models import Assessment, Mark

class UserSerializer(serializers.ModelSerializer):
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    department_code = serializers.SerializerMethodField()
    student_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'phone', 'role', 'department_id', 'department_name', 'department_code', 'student_profile']
        read_only_fields = ['id']

    def get_department_id(self, obj):
        if obj.role == 'hod' and hasattr(obj, 'hod_profile'):
            return obj.hod_profile.department.id
        elif obj.role == 'teacher' and hasattr(obj, 'staff_profile'):
            return obj.staff_profile.department.id
        elif obj.role == 'student' and hasattr(obj, 'student_profile'):
            return obj.student_profile.department.id
        return None

    def get_department_name(self, obj):
        if obj.role == 'hod' and hasattr(obj, 'hod_profile'):
            return obj.hod_profile.department.name
        elif obj.role == 'teacher' and hasattr(obj, 'staff_profile'):
            return obj.staff_profile.department.name
        elif obj.role == 'student' and hasattr(obj, 'student_profile'):
            return obj.student_profile.department.name
        return None

    def get_department_code(self, obj):
        if obj.role == 'hod' and hasattr(obj, 'hod_profile'):
            return obj.hod_profile.department.code
        elif obj.role == 'teacher' and hasattr(obj, 'staff_profile'):
            return obj.staff_profile.department.code
        elif obj.role == 'student' and hasattr(obj, 'student_profile'):
            return obj.student_profile.department.code
        return None

    def get_student_profile(self, obj):
        if obj.role == 'student' and hasattr(obj, 'student_profile'):
            sp = obj.student_profile
            return {
                'id': sp.id,
                'register_number': sp.register_number,
                'department_id': sp.department.id if sp.department else None,
                'department_name': sp.department.name if sp.department else '',
                'regulation_id': sp.batch.regulation.id if (sp.batch and sp.batch.regulation) else None,
                'regulation_code': sp.batch.regulation.code if (sp.batch and sp.batch.regulation) else '',
                'batch_id': sp.batch.id if sp.batch else None,
                'batch_label': sp.batch.label if sp.batch else '',
                'current_semester_id': sp.current_semester.id if sp.current_semester else None,
                'current_semester_number': sp.current_semester.semester_number if sp.current_semester else None,
                'current_semester_label': sp.current_semester.label if sp.current_semester else '',
                'current_year_number': sp.current_semester.year_number if sp.current_semester else None,
            }
        return None


class DepartmentSerializer(serializers.ModelSerializer):
    hod_name = serializers.SerializerMethodField()
    hod_email = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'hod_name', 'hod_email']

    def get_hod_name(self, obj):
        if hasattr(obj, 'hod_assignment'):
            return obj.hod_assignment.user.full_name or obj.hod_assignment.user.username
        return None

    def get_hod_email(self, obj):
        if hasattr(obj, 'hod_assignment'):
            return obj.hod_assignment.user.email
        return None


class ProgrammeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)

    class Meta:
        model = Programme
        fields = ['id', 'department', 'department_name', 'department_code', 'name', 'degree_type', 'duration_years', 'total_semesters']


class RegulationSerializer(serializers.ModelSerializer):
    batches_count = serializers.SerializerMethodField()

    class Meta:
        model = Regulation
        fields = ['id', 'code', 'name', 'effective_from_year', 'notes', 'batches_count']

    def get_batches_count(self, obj):
        return obj.batches.count()


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ['id', 'batch', 'year_number', 'semester_number', 'label']


class BatchSerializer(serializers.ModelSerializer):
    regulation_code = serializers.CharField(source='regulation.code', read_only=True)
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    department_id = serializers.IntegerField(source='programme.department.id', read_only=True)
    department_name = serializers.CharField(source='programme.department.name', read_only=True)
    semesters = SemesterSerializer(many=True, read_only=True)

    class Meta:
        model = Batch
        fields = ['id', 'regulation', 'regulation_code', 'programme', 'programme_name', 'department_id', 'department_name', 'start_year', 'end_year', 'label', 'semesters']


class SubjectSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source='department.code', read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'department', 'department_code', 'code', 'name', 'subject_type', 'credits']


class FacultyAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff_user.full_name', read_only=True)
    staff_code = serializers.SerializerMethodField()
    staff_department = serializers.SerializerMethodField()

    class Meta:
        model = FacultySubjectAssignment
        fields = ['id', 'semester_subject', 'staff_user', 'staff_name', 'staff_code', 'staff_department']

    def get_staff_code(self, obj):
        if hasattr(obj.staff_user, 'staff_profile'):
            return obj.staff_user.staff_profile.staff_code
        return ""

    def get_staff_department(self, obj):
        if hasattr(obj.staff_user, 'staff_profile'):
            return obj.staff_user.staff_profile.department.code
        return ""


class SemesterSubjectSerializer(serializers.ModelSerializer):
    subject_details = SubjectSerializer(source='subject', read_only=True)
    assigned_faculty = FacultyAssignmentSerializer(source='faculty_assignments', many=True, read_only=True)

    class Meta:
        model = SemesterSubject
        fields = ['id', 'semester', 'subject', 'subject_details', 'assigned_faculty']


class StaffProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name')
    email = serializers.CharField(source='user.email')
    phone = serializers.CharField(source='user.phone')
    department_code = serializers.CharField(source='department.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = StaffProfile
        fields = ['id', 'user', 'staff_code', 'full_name', 'email', 'phone', 'designation', 'department', 'department_code', 'department_name']
        read_only_fields = ['user']


class StudentProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name')
    email = serializers.CharField(source='user.email')
    phone = serializers.CharField(source='user.phone')
    department_code = serializers.CharField(source='department.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    batch_label = serializers.CharField(source='batch.label', read_only=True)
    regulation_code = serializers.CharField(source='batch.regulation.code', read_only=True)
    current_year = serializers.IntegerField(source='current_semester.year_number', read_only=True)
    current_semester_number = serializers.IntegerField(source='current_semester.semester_number', read_only=True)
    current_semester_label = serializers.CharField(source='current_semester.label', read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user', 'register_number', 'full_name', 'email', 'phone', 'blood_group',
            'department', 'department_code', 'department_name',
            'programme', 'programme_name',
            'batch', 'batch_label', 'regulation_code',
            'current_semester', 'current_year', 'current_semester_number', 'current_semester_label',
            'is_active'
        ]
        read_only_fields = ['user']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_register_number = serializers.CharField(source='student.register_number', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'student', 'student_register_number', 'student_name', 'status']


class AssessmentSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source='semester_subject.subject.code', read_only=True)
    subject_name = serializers.CharField(source='semester_subject.subject.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    published_by_name = serializers.CharField(source='published_by.full_name', read_only=True)

    class Meta:
        model = Assessment
        fields = [
            'id', 'semester_subject', 'subject_code', 'subject_name',
            'name', 'max_marks', 'status',
            'created_by', 'created_by_name',
            'published_by', 'published_by_name', 'published_date',
            'created_at'
        ]
        read_only_fields = ['created_by', 'published_by', 'published_date']


class MarkSerializer(serializers.ModelSerializer):
    register_number = serializers.CharField(source='student.register_number', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    subject_code = serializers.CharField(source='assessment.semester_subject.subject.code', read_only=True)
    subject_name = serializers.CharField(source='assessment.semester_subject.subject.name', read_only=True)
    assessment_name = serializers.CharField(source='assessment.name', read_only=True)

    class Meta:
        model = Mark
        fields = [
            'id', 'assessment', 'assessment_name', 'student',
            'register_number', 'student_name',
            'subject_code', 'subject_name',
            'obtained_marks', 'grade'
        ]
