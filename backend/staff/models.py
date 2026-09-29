from django.db import models
from django.conf import settings

class StaffProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile')
    department = models.ForeignKey('academics.Department', on_delete=models.CASCADE, related_name='staff_members')
    staff_code = models.CharField(max_length=50, unique=True)
    designation = models.CharField(max_length=100, default='Assistant Professor')

    class Meta:
        ordering = ['department', 'staff_code']
        indexes = [
            models.Index(fields=['department']),
            models.Index(fields=['staff_code']),
        ]

    def __str__(self):
        return f"{self.user.full_name} ({self.staff_code}) - {self.department.code}"
