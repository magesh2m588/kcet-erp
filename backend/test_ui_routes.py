import urllib.request
import json

def test_endpoints():
    print("Testing local dev server availability...")
    
    # 1. Test Frontend Vite App on http://127.0.0.1:5173/
    try:
        req = urllib.request.urlopen("http://127.0.0.1:5173/")
        html = req.read().decode('utf-8')
        print(f"Frontend index.html fetched successfully (HTTP {req.status}).")
        assert "KCET ERP" in html
        print("Frontend contains correct institutional title.")
    except Exception as e:
        print(f"Frontend check failed: {e}")

    # 2. Test Backend API on http://127.0.0.1:8000/api/departments/
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8000/api/departments/")
        data = json.loads(req.read().decode('utf-8'))
        print(f"Backend API fetched successfully (HTTP {req.status}). Found {len(data)} departments.")
    except Exception as e:
        print(f"Backend API check failed: {e}")

    # 3. Test Admin Login API
    try:
        login_data = json.dumps({"identifier": "admin@kcet.edu.in", "password": "admin123"}).encode('utf-8')
        headers = {'Content-Type': 'application/json'}
        req = urllib.request.Request("http://127.0.0.1:8000/api/auth/login/", data=login_data, headers=headers)
        res = urllib.request.urlopen(req)
        login_res = json.loads(res.read().decode('utf-8'))
        print(f"Admin Login API success! User: {login_res['user']['full_name']} ({login_res['user']['role']})")
    except Exception as e:
        print(f"Admin Login API failed: {e}")

if __name__ == '__main__':
    test_endpoints()
