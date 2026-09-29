from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import User, HODAssignment
from academics.models import Department, Programme, Regulation, Batch, Semester, Subject, SemesterSubject, FacultySubjectAssignment
from staff.models import StaffProfile
from students.models import StudentProfile

class Command(BaseCommand):
    help = 'Seeds initial KCET ERP institutional data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding KCET ERP database...")

        with transaction.atomic():
            # 1. Create Admin User
            admin_user, _ = User.objects.get_or_create(
                username='admin@kcet.edu.in',
                defaults={
                    'email': 'admin@kcet.edu.in',
                    'full_name': 'KCET System Administrator',
                    'role': 'admin',
                    'phone': '9876543210'
                }
            )
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write("Created Admin: admin@kcet.edu.in / admin123")

            # 2. Seed Departments
            dept_data = [
                ('Civil Engineering', 'CIVIL'),
                ('Computer Science and Engineering', 'CSE'),
                ('Artificial Intelligence and Data Science', 'AI&DS'),
                ('Electronics and Communication Engineering', 'ECE'),
                ('Electrical and Electronics Engineering', 'EEE'),
                ('Information Technology', 'IT'),
                ('Mechanical Engineering', 'MECH'),
                ('Master of Computer Applications', 'MCA'),
            ]
            departments = {}
            for name, code in dept_data:
                dept, _ = Department.objects.get_or_create(code=code, defaults={'name': name})
                departments[code] = dept
            self.stdout.write(f"Seeded {len(departments)} departments.")

            # 3. Seed Programmes
            programmes = {}
            for code, dept in departments.items():
                if code == 'MCA':
                    prog, _ = Programme.objects.get_or_create(
                        department=dept,
                        name='Master of Computer Applications',
                        defaults={
                            'degree_type': 'PG',
                            'duration_years': 2,
                            'total_semesters': 4
                        }
                    )
                else:
                    prog, _ = Programme.objects.get_or_create(
                        department=dept,
                        name=f'B.E. {dept.name}',
                        defaults={
                            'degree_type': 'UG',
                            'duration_years': 4,
                            'total_semesters': 8
                        }
                    )
                programmes[code] = prog
            self.stdout.write("Seeded Programmes for each department.")

            # 4. Seed Regulations
            r2021, _ = Regulation.objects.get_or_create(
                code='R2021',
                defaults={
                    'name': 'Anna University Regulation 2021',
                    'effective_from_year': 2021,
                    'notes': 'Choice Based Credit System (CBCS) Regulation 2021'
                }
            )
            r2025, _ = Regulation.objects.get_or_create(
                code='R2025',
                defaults={
                    'name': 'Anna University Regulation 2025',
                    'effective_from_year': 2025,
                    'notes': 'Outcome Based Education Regulation 2025'
                }
            )
            self.stdout.write("Seeded Regulations R2021 and R2025.")

            # 5. Seed Batches & Semesters
            batches_list = []
            for code, prog in programmes.items():
                if prog.degree_type == 'UG':
                    # R2021 batches
                    for start_yr in [2021, 2022, 2023, 2024]:
                        batch, _ = Batch.objects.get_or_create(
                            regulation=r2021,
                            programme=prog,
                            start_year=start_yr,
                            defaults={
                                'end_year': start_yr + 4,
                                'label': f"{start_yr}-{start_yr + 4}"
                            }
                        )
                        batches_list.append(batch)
                    # R2025 batches
                    for start_yr in [2025, 2026]:
                        batch, _ = Batch.objects.get_or_create(
                            regulation=r2025,
                            programme=prog,
                            start_year=start_yr,
                            defaults={
                                'end_year': start_yr + 4,
                                'label': f"{start_yr}-{start_yr + 4}"
                            }
                        )
                        batches_list.append(batch)
                else: # MCA
                    for start_yr in [2024, 2025]:
                        batch, _ = Batch.objects.get_or_create(
                            regulation=r2021 if start_yr == 2024 else r2025,
                            programme=prog,
                            start_year=start_yr,
                            defaults={
                                'end_year': start_yr + 2,
                                'label': f"{start_yr}-{start_yr + 2}"
                            }
                        )
                        batches_list.append(batch)

            self.stdout.write(f"Seeded Batches & Semesters across all programmes.")

            # 6. Seed HOD for CSE
            cse_dept = departments['CSE']
            hod_user, _ = User.objects.get_or_create(
                username='hod.cse@kcet.edu.in',
                defaults={
                    'email': 'hod.cse@kcet.edu.in',
                    'full_name': 'Dr. Arulmozhi V. (HOD CSE)',
                    'role': 'hod',
                    'phone': '9842012345'
                }
            )
            hod_user.set_password('hod123')
            hod_user.save()

            HODAssignment.objects.update_or_create(
                department=cse_dept,
                defaults={
                    'user': hod_user,
                    'staff_code': 'KCET-HOD-CSE-01'
                }
            )
            StaffProfile.objects.update_or_create(
                user=hod_user,
                defaults={
                    'department': cse_dept,
                    'staff_code': 'KCET-HOD-CSE-01',
                    'designation': 'Head of Department'
                }
            )
            self.stdout.write("Created HOD CSE: hod.cse@kcet.edu.in / hod123")

            # 7. Seed Staff / Teacher for CSE
            teacher_user, _ = User.objects.get_or_create(
                username='teacher.cse@kcet.edu.in',
                defaults={
                    'email': 'teacher.cse@kcet.edu.in',
                    'full_name': 'Prof. Rajesh Kumar K.',
                    'role': 'teacher',
                    'phone': '9842054321'
                }
            )
            teacher_user.set_password('teacher123')
            teacher_user.save()

            StaffProfile.objects.update_or_create(
                user=teacher_user,
                defaults={
                    'department': cse_dept,
                    'staff_code': 'KCET-FAC-CSE-02',
                    'designation': 'Assistant Professor'
                }
            )
            self.stdout.write("Created Teacher CSE: teacher.cse@kcet.edu.in / teacher123")

            # 8. Seed Subjects & Faculty Assignment for CSE Batch 2024-2028 (Year 3, Sem 5)
            cse_batch = Batch.objects.get(programme=programmes['CSE'], start_year=2024)
            sem5 = Semester.objects.get(batch=cse_batch, semester_number=5)

            sub1, _ = Subject.objects.get_or_create(
                department=cse_dept,
                code='CS3501',
                defaults={'name': 'Compiler Design', 'subject_type': 'Theory', 'credits': 3.0}
            )
            sub2, _ = Subject.objects.get_or_create(
                department=cse_dept,
                code='CS3591',
                defaults={'name': 'Computer Networks', 'subject_type': 'Theory', 'credits': 3.0}
            )
            sub3, _ = Subject.objects.get_or_create(
                department=cse_dept,
                code='CS3511',
                defaults={'name': 'Compiler Design Laboratory', 'subject_type': 'Lab', 'credits': 2.0}
            )

            sem_sub1, _ = SemesterSubject.objects.get_or_create(semester=sem5, subject=sub1)
            sem_sub2, _ = SemesterSubject.objects.get_or_create(semester=sem5, subject=sub2)
            sem_sub3, _ = SemesterSubject.objects.get_or_create(semester=sem5, subject=sub3)

            FacultySubjectAssignment.objects.get_or_create(semester_subject=sem_sub1, staff_user=teacher_user)
            FacultySubjectAssignment.objects.get_or_create(semester_subject=sem_sub2, staff_user=hod_user)
            FacultySubjectAssignment.objects.get_or_create(semester_subject=sem_sub3, staff_user=teacher_user)

            self.stdout.write("Seeded CSE Subjects & Faculty Assignments for Semester 5.")

            # 9. Seed Sample Students for CSE 2024-2028
            student_samples = [
                ('311824104001', 'Aravind Kumar S', 'aravind@gmail.com', 'O+'),
                ('311824104002', 'Bhavani R', 'bhavani@gmail.com', 'A+'),
                ('311824104003', 'Chandru M', 'chandru@gmail.com', 'B+'),
                ('311824104004', 'Divya P', 'divya@gmail.com', 'AB+'),
                ('311824104005', 'Elango K', 'elango@gmail.com', 'O-'),
            ]

            for reg_num, name, email, bg in student_samples:
                st_user, _ = User.objects.get_or_create(
                    username=reg_num,
                    defaults={
                        'email': email,
                        'full_name': name,
                        'role': 'student',
                        'phone': '9123456789'
                    }
                )
                st_user.set_password('student123')
                st_user.save()

                StudentProfile.objects.update_or_create(
                    register_number=reg_num,
                    defaults={
                        'user': st_user,
                        'blood_group': bg,
                        'department': cse_dept,
                        'programme': programmes['CSE'],
                        'batch': cse_batch,
                        'current_semester': sem5,
                        'is_active': True
                    }
                )

            self.stdout.write("Created Sample CSE Students (e.g. 311824104001 / student123)")

        self.stdout.write(self.style.SUCCESS("KCET ERP Database Seeding Complete!"))
