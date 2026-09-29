import requests

BASE_URL = 'http://127.0.0.1:8000/api'

def get_token(username, password):
    res = requests.post(f'{BASE_URL}/auth/login/', json={'username': username, 'password': password})
    if res.status_code != 200:
        print(f"Login failed for {username}:", res.status_code, res.text)
        return None
    return res.json().get('token')

admin_token = get_token('admin@kcet.edu.in', 'admin123')
hod_token = get_token('hod.cse@kcet.edu.in', 'hod123')
teacher_token = get_token('teacher.cse@kcet.edu.in', 'teacher123')
student_token = get_token('311824104001', 'student123')

print("1. Authentication Test:")
print("Tokens obtained:", {
    'admin': bool(admin_token),
    'hod': bool(hod_token),
    'teacher': bool(teacher_token),
    'student': bool(student_token)
})

# 2. Test Student My Subjects View
print("\n2. Test Student My Subjects View:")
st_headers = {'Authorization': f'Token {student_token}'}
st_sub_res = requests.get(f'{BASE_URL}/student/my-subjects/', headers=st_headers)
print("Status:", st_sub_res.status_code)
if st_sub_res.status_code == 200:
    st_data = st_sub_res.json()
    print("Student Profile:", st_data['student']['register_number'], st_data['student']['full_name'])
    print("Current Semester Subjects Count:", len(st_data['current_semester_subjects']))
    print("Previous Semesters Count:", len(st_data['previous_semesters']))
    if st_data['current_semester_subjects']:
        print("Sample Subject:", st_data['current_semester_subjects'][0])

# 3. Test Teacher Assigned Subjects View
print("\n3. Test Teacher Assigned Subjects View:")
t_headers = {'Authorization': f'Token {teacher_token}'}
t_sub_res = requests.get(f'{BASE_URL}/teacher/assigned-subjects/', headers=t_headers)
print("Teacher Assigned Subjects Status:", t_sub_res.status_code)
assigned_subs = t_sub_res.json()
print("Assigned Subjects Count:", len(assigned_subs))
sem_sub_id = None
if len(assigned_subs) > 0:
    sem_sub_id = assigned_subs[0]['semester_subject_id']
    print("Assigned Subject:", assigned_subs[0]['code'], assigned_subs[0]['name'])

# If teacher has no assigned subject, let me assign one via HOD
if not sem_sub_id:
    print("Assigning subject to teacher via HOD for testing...")
    hod_headers = {'Authorization': f'Token {hod_token}'}
    sem_subs = requests.get(f'{BASE_URL}/semester-subjects/', headers=hod_headers).json()
    if len(sem_subs) > 0:
        target_ss_id = sem_subs[0]['id']
        teacher_me = requests.get(f'{BASE_URL}/auth/me/', headers=t_headers).json()
        assign_res = requests.post(f'{BASE_URL}/semester-subjects/{target_ss_id}/assign_faculty/', headers=hod_headers, json={'staff_user_id': teacher_me['user']['id']})
        print("Faculty Assignment Result:", assign_res.status_code, assign_res.json())
        t_sub_res = requests.get(f'{BASE_URL}/teacher/assigned-subjects/', headers=t_headers)
        assigned_subs = t_sub_res.json()
        if len(assigned_subs) > 0:
            sem_sub_id = assigned_subs[0]['semester_subject_id']

# 4. Test Teacher IAT 1 Mark Entry (Valid vs Invalid)
print("\n4. Test Teacher IAT 1 Mark Entry:")
if sem_sub_id:
    # Fetch students in assessment
    entry_get = requests.get(f'{BASE_URL}/marks/v2/entry/?semester_subject_id={sem_sub_id}&exam_name=IAT 1', headers=t_headers)
    print("Get Entry Context Status:", entry_get.status_code)
    students_list = entry_get.json().get('students', [])
    print("Students count for mark entry:", len(students_list))

    if students_list:
        st_id = students_list[0]['student_id']
        
        # Test Invalid Mark (>100) -> Expect 400
        bad_payload = {'semester_subject_id': sem_sub_id, 'exam_name': 'IAT 1', 'marks': [{'student_id': st_id, 'mark_value': 105.0, 'grade_value': None}]}
        bad_res = requests.post(f'{BASE_URL}/marks/v2/entry/', headers=t_headers, json=bad_payload)
        print("Invalid Mark >100 Response (Expected 400):", bad_res.status_code, bad_res.json())

        # Test Valid Mark (85.0) -> Expect 200
        good_payload = {'semester_subject_id': sem_sub_id, 'exam_name': 'IAT 1', 'marks': [{'student_id': st_id, 'mark_value': 85.0, 'grade_value': None}]}
        good_res = requests.post(f'{BASE_URL}/marks/v2/entry/', headers=t_headers, json=good_payload)
        print("Valid Mark Entry Response (Expected 200):", good_res.status_code, good_res.json())

# 5. Test Anna University Grade Entry (Valid vs Invalid)
print("\n5. Test Anna University Grade Entry:")
if sem_sub_id and students_list:
    st_id = students_list[0]['student_id']
    
    # Test Invalid Grade ('XYZ') -> Expect 400
    bad_grade_payload = {'semester_subject_id': sem_sub_id, 'exam_name': 'ANNA UNIVERSITY', 'marks': [{'student_id': st_id, 'mark_value': None, 'grade_value': 'XYZ'}]}
    bad_g_res = requests.post(f'{BASE_URL}/marks/v2/entry/', headers=t_headers, json=bad_grade_payload)
    print("Invalid Grade Response (Expected 400):", bad_g_res.status_code, bad_g_res.json())

    # Test Valid Grade ('A+') -> Expect 200
    good_grade_payload = {'semester_subject_id': sem_sub_id, 'exam_name': 'ANNA UNIVERSITY', 'marks': [{'student_id': st_id, 'mark_value': None, 'grade_value': 'A+'}]}
    good_g_res = requests.post(f'{BASE_URL}/marks/v2/entry/', headers=t_headers, json=good_grade_payload)
    print("Valid Grade Entry Response (Expected 200):", good_g_res.status_code, good_g_res.json())

# 6. Test Student View UNPUBLISHED Mark (Expect "Yet to be published")
print("\n6. Test Student View UNPUBLISHED Mark:")
st_res_unpub = requests.get(f'{BASE_URL}/student/results/?semester_number=1&exam_name=IAT 1', headers=st_headers)
print("Student Results Status:", st_res_unpub.status_code)
print("Student Results Payload:", st_res_unpub.json())

# 7. Test HOD Publish Marks
print("\n7. Test HOD Publish Marks:")
hod_headers = {'Authorization': f'Token {hod_token}'}
if sem_sub_id:
    pub_res = requests.post(f'{BASE_URL}/marks/v2/publish/', headers=hod_headers, json={'semester_subject_id': sem_sub_id, 'exam_name': 'IAT 1'})
    print("HOD Publish Response:", pub_res.status_code, pub_res.json())

# 8. Test Student View PUBLISHED Mark (Expect Status 'published' and Results)
print("\n8. Test Student View PUBLISHED Mark:")
curr_sem_num = st_data['student']['current_semester']
st_res_pub = requests.get(f'{BASE_URL}/student/results/?semester_number={curr_sem_num}&exam_name=IAT 1', headers=st_headers)
print("Student Published Results Status:", st_res_pub.status_code)
print("Student Published Results Payload:", st_res_pub.json())
