from django.db import models
from django.conf import settings

class Department(models.Model):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Programme(models.Model):
    DEGREE_CHOICES = (
        ('UG', 'Undergraduate (4 Years / 8 Semesters)'),
        ('PG', 'Postgraduate (2 Years / 4 Semesters)'),
    )
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='programmes')
    name = models.CharField(max_length=150)
    degree_type = models.CharField(max_length=10, choices=DEGREE_CHOICES, default='UG')
    duration_years = models.IntegerField(default=4)
    total_semesters = models.IntegerField(default=8)

    class Meta:
        ordering = ['department', 'name']

    def __str__(self):
        return f"{self.name} [{self.degree_type}]"


class Regulation(models.Model):
    code = models.CharField(max_length=20, unique=True) # e.g. R2021, R2025
    name = models.CharField(max_length=100) # e.g. Anna University Regulation 2021
    effective_from_year = models.IntegerField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-effective_from_year', 'code']

    def __str__(self):
        return self.code


class Batch(models.Model):
    regulation = models.ForeignKey(Regulation, on_delete=models.PROTECT, related_name='batches')
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name='batches')
    start_year = models.IntegerField()
    end_year = models.IntegerField()
    label = models.CharField(max_length=50) # e.g. 2024-2028

    class Meta:
        ordering = ['-start_year', 'programme']
        unique_together = ('regulation', 'programme', 'start_year')
        indexes = [
            models.Index(fields=['regulation', 'programme']),
            models.Index(fields=['start_year', 'end_year']),
        ]

    def save(self, *args, **kwargs):
        if not self.end_year:
            self.end_year = self.start_year + self.programme.duration_years
        if not self.label:
            self.label = f"{self.start_year}-{self.end_year}"
        super().save(*args, **kwargs)
        
        # Auto-create semesters for batch
        for sem_num in range(1, self.programme.total_semesters + 1):
            year_num = (sem_num + 1) // 2
            Semester.objects.get_or_create(
                batch=self,
                semester_number=sem_num,
                defaults={
                    'year_number': year_num,
                    'label': f"Semester {sem_num}"
                }
            )

    def __str__(self):
        return f"{self.programme.name} ({self.label} - {self.regulation.code})"


class Semester(models.Model):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='semesters')
    year_number = models.IntegerField() # 1, 2, 3, 4
    semester_number = models.IntegerField() # 1 to 8
    label = models.CharField(max_length=50) # "Semester 5"

    class Meta:
        ordering = ['batch', 'semester_number']
        unique_together = ('batch', 'semester_number')
        indexes = [
            models.Index(fields=['batch', 'semester_number']),
        ]

    def __str__(self):
        return f"{self.batch.label} - Year {self.year_number} Sem {self.semester_number}"


class Subject(models.Model):
    TYPE_CHOICES = (
        ('Theory', 'Theory'),
        ('Lab', 'Lab'),
    )
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='subjects')
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=150)
    subject_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Theory')
    credits = models.DecimalField(max_digits=4, decimal_places=1, default=3.0)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name} ({self.subject_type})"


class SemesterSubject(models.Model):
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='semester_subjects')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='semester_usages')

    class Meta:
        unique_together = ('semester', 'subject')
        indexes = [
            models.Index(fields=['semester', 'subject']),
        ]

    def __str__(self):
        return f"{self.semester} | {self.subject.code}"


class FacultySubjectAssignment(models.Model):
    semester_subject = models.ForeignKey(SemesterSubject, on_delete=models.CASCADE, related_name='faculty_assignments')
    staff_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_subjects')

    class Meta:
        unique_together = ('semester_subject', 'staff_user')

    def __str__(self):
        return f"{self.staff_user.full_name} -> {self.semester_subject.subject.code}"
