#!/usr/bin/env python3
import os
import sys
import json
import uuid
import http.cookies
import urllib.parse

# 1. SETUP SESSION
# Check if cookie exists
cookie = http.cookies.SimpleCookie(os.environ.get("HTTP_COOKIE"))
session_id = None
session_data = {}

if "CGISESSID" in cookie:
    session_id = cookie["CGISESSID"].value
else:
    # Create new Session ID
    session_id = str(uuid.uuid4())

# Session File Path (Store in /tmp like Perl does)
session_file = f"/tmp/cgisess_{session_id}.json"

# Load existing data if file exists
if os.path.exists(session_file):
    with open(session_file, 'r') as f:
        try:
            session_data = json.load(f)
        except:
            session_data = {}

# 2. HANDLE FORM SUBMISSION (POST)
request_method = os.environ.get("REQUEST_METHOD", "GET")
name = session_data.get("username") # Default to existing session name

if request_method == "POST":
    # Read POST data
    content_len = int(os.environ.get("CONTENT_LENGTH", 0))
    post_body = sys.stdin.read(content_len)
    
    # Parse data (e.g., username=David)
    params = urllib.parse.parse_qs(post_body)
    
    if "username" in params:
        name = params["username"][0]
        session_data["username"] = name
        
        # Save to file
        with open(session_file, 'w') as f:
            json.dump(session_data, f)

# 3. PRINT HEADERS (Set-Cookie is Critical)
print("Cache-Control: no-cache")
print(f"Set-Cookie: CGISESSID={session_id}; Path=/")
print("Content-type: text/html\n")

# 4. PRINT HTML
print("<html><head><title>Python Session Page 1</title></head><body>")
print("<h1>Python State Page 1</h1>")

if name:
    print(f"<p><b>Name:</b> {name}</p>")
else:
    print("<p><b>Name:</b> You do not have a name set</p>")

print("<h3>Set Name:</h3>")
print("<form method='POST'>")
print("Name: <input type='text' name='username'>")
print("<input type='submit' value='Set Session Name'>")
print("</form>")

print("<br/><a href='session-state-2.py'>Go to Page 2 (Check State)</a><br/>")
print("<form action='session-destroy.py' method='get'>")
print("<button type='submit'>Destroy Session</button>")
print("</form>")

print("<hr><a href='/index.html'>Home</a>")
print("</body></html>")