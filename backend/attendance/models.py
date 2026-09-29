from django.db import models
from django.conf import settings

class AttendanceSession(models.Model):
    semester = models.ForeignKey('academics.Semester', on_delete=models.CASCADE, related_name='attendance_sessions')
    date = models.DateField()
    period_number = models.IntegerField() # 1 to 8
    taken_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='taken_attendance_sessions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'period_number']
        unique_together = ('semester', 'date', 'period_number')
        indexes = [
            models.Index(fields=['semester', 'date']),
            models.Index(fields=['date', 'period_number']),
        ]

    def __str__(self):
        return f"{self.semester} | {self.date} | P{self.period_number}"


class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
    )
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey('students.StudentProfile', on_delete=models.CASCADE, related_name='attendance_records')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='present')

    class Meta:
        unique_together = ('session', 'student')
        indexes = [
            models.Index(fields=['session', 'student']),
            models.Index(fields=['student', 'status']),
        ]

    def __str__(self):
        return f"{self.student.register_number} - P{self.session.period_number}: {self.status}"
