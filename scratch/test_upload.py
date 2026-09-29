import requests
from io import BytesIO
from PIL import Image

BASE_URL = 'http://127.0.0.1:8000/api'

# 1. Obtain admin token
login_res = requests.post(f'{BASE_URL}/auth/login/', json={
    'username': 'admin@kcet.edu.in',
    'password': 'admin123'
})
print('Admin Login Status:', login_res.status_code)
admin_token = login_res.json().get('token')
print('Admin Token:', admin_token[:10] + '...' if admin_token else None)

# 2. Create a test JPG image in memory (simulating KCET JPG)
img = Image.new('RGB', (800, 600), color=(15, 30, 60))
img_io = BytesIO()
img.save(img_io, 'JPEG')
img_bytes = img_io.getvalue()

# 3. Test upload background with Admin token
headers = {'Authorization': f'Token {admin_token}'}
files = {'background': ('kcet_bg.jpg', img_bytes, 'image/jpeg')}

upload_res = requests.post(f'{BASE_URL}/admin/website-settings/background/', headers=headers, files=files)
print('Admin Upload Status:', upload_res.status_code)
print('Admin Upload Response:', upload_res.json())

bg_url = upload_res.json().get('background_url')
if bg_url:
    # 4. Verify URL is accessible from browser / HTTP GET
    fetch_res = requests.get(bg_url)
    print('Fetch Uploaded Background Status:', fetch_res.status_code, 'Content-Length:', len(fetch_res.content))

# 5. Test Non-Admin User (HOD) receiving 403
hod_login = requests.post(f'{BASE_URL}/auth/login/', json={
    'username': 'hod.cse@kcet.edu.in',
    'password': 'hod123'
})
if hod_login.status_code == 200:
    hod_token = hod_login.json().get('token')
    hod_headers = {'Authorization': f'Token {hod_token}'}
    hod_upload = requests.post(f'{BASE_URL}/admin/website-settings/background/', headers=hod_headers, files=files)
    print('HOD Upload Status (Expected 403):', hod_upload.status_code, hod_upload.json())
