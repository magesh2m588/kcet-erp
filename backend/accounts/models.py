from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('hod', 'HOD'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.full_name or self.username} ({self.role.upper()})"


class HODAssignment(models.Model):
    department = models.OneToOneField('academics.Department', on_delete=models.CASCADE, related_name='hod_assignment')
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hod_profile')
    staff_code = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"HOD {self.user.full_name} - {self.department.code}"
