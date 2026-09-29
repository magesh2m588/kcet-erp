import requests
from io import BytesIO
from PIL import Image

BASE_URL = 'http://127.0.0.1:8000/api'

# 1. Obtain admin token
login_res = requests.post(f'{BASE_URL}/auth/login/', json={
    'username': 'admin@kcet.edu.in',
    'password': 'admin123'
})
admin_token = login_res.json().get('token')
print('Admin Token:', admin_token[:10] + '...' if admin_token else None)

# 2. Create a test logo image in memory
img = Image.new('RGB', (200, 200), color=(255, 100, 50))
img_io = BytesIO()
img.save(img_io, 'PNG')
img_bytes = img_io.getvalue()

# 3. Test upload logo with Admin token
headers = {'Authorization': f'Token {admin_token}'}
files = {'logo': ('kcet_logo.png', img_bytes, 'image/png')}

upload_res = requests.post(f'{BASE_URL}/admin/website-settings/logo/', headers=headers, files=files)
print('Admin Logo Upload Status:', upload_res.status_code)
print('Admin Logo Upload Response:', upload_res.json())

logo_url = upload_res.json().get('logo_url')
if logo_url:
    # 4. Verify URL is accessible from browser / HTTP GET
    fetch_res = requests.get(logo_url)
    print('Fetch Uploaded Logo Status:', fetch_res.status_code, 'Content-Length:', len(fetch_res.content))

# 5. Verify Public settings endpoint returns the logo URL
pub_res = requests.get(f'{BASE_URL}/website-settings/')
print('Public Website Settings Logo URL:', pub_res.json().get('logo_url'))

# 6. Test Non-Admin User (HOD) receiving 403 on logo upload
hod_login = requests.post(f'{BASE_URL}/auth/login/', json={
    'username': 'hod.cse@kcet.edu.in',
    'password': 'hod123'
})
if hod_login.status_code == 200:
    hod_token = hod_login.json().get('token')
    hod_headers = {'Authorization': f'Token {hod_token}'}
    hod_upload = requests.post(f'{BASE_URL}/admin/website-settings/logo/', headers=hod_headers, files=files)
    print('HOD Logo Upload Status (Expected 403):', hod_upload.status_code, hod_upload.json())
