from django.db import models
from django.conf import settings

class Assessment(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
    )
    EXAM_CHOICES = (
        ('IAT 1', 'IAT 1'),
        ('IAT 2', 'IAT 2'),
        ('ANNA UNIVERSITY', 'Anna University'),
    )

    semester_subject = models.ForeignKey('academics.SemesterSubject', on_delete=models.CASCADE, related_name='assessments')
    name = models.CharField(max_length=100) # IAT 1, IAT 2, ANNA UNIVERSITY
    max_marks = models.DecimalField(max_digits=5, decimal_places=2, default=100.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_assessments')
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='published_assessments')
    published_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('semester_subject', 'name')
        indexes = [
            models.Index(fields=['semester_subject', 'status']),
            models.Index(fields=['semester_subject', 'name']),
        ]

    def __str__(self):
        return f"{self.semester_subject.subject.code} - {self.name} [{self.status.upper()}]"


class Mark(models.Model):
    GRADE_CHOICES = (
        ('O', 'O'),
        ('A+', 'A+'),
        ('A', 'A'),
        ('B+', 'B+'),
        ('B', 'B'),
        ('C', 'C'),
        ('AR', 'AR'),
    )

    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='marks')
    student = models.ForeignKey('students.StudentProfile', on_delete=models.CASCADE, related_name='marks')
    obtained_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    grade = models.CharField(max_length=10, choices=GRADE_CHOICES, null=True, blank=True)

    class Meta:
        unique_together = ('assessment', 'student')
        indexes = [
            models.Index(fields=['assessment', 'student']),
            models.Index(fields=['student']),
        ]

    def __str__(self):
        val = self.grade if self.grade else self.obtained_marks
        return f"{self.student.register_number} - {self.assessment.name}: {val}"
