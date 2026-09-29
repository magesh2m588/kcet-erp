from django.db import models
from django.conf import settings

class StudentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile')
    register_number = models.CharField(max_length=50, unique=True)
    blood_group = models.CharField(max_length=10, blank=True, default='O+')
    department = models.ForeignKey('academics.Department', on_delete=models.CASCADE, related_name='students')
    programme = models.ForeignKey('academics.Programme', on_delete=models.CASCADE, related_name='students')
    batch = models.ForeignKey('academics.Batch', on_delete=models.CASCADE, related_name='students')
    current_semester = models.ForeignKey('academics.Semester', on_delete=models.CASCADE, related_name='current_students')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['register_number']
        indexes = [
            models.Index(fields=['register_number']),
            models.Index(fields=['department']),
            models.Index(fields=['batch']),
            models.Index(fields=['current_semester']),
        ]

    def __str__(self):
        return f"{self.user.full_name} ({self.register_number})"
