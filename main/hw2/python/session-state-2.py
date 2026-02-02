#!/usr/bin/env python3
import os
import json
import http.cookies

# 1. RETRIEVE SESSION
cookie = http.cookies.SimpleCookie(os.environ.get("HTTP_COOKIE"))
session_id = None
name = None

if "CGISESSID" in cookie:
    session_id = cookie["CGISESSID"].value
    session_file = f"/tmp/cgisess_{session_id}.json"
    
    if os.path.exists(session_file):
        with open(session_file, 'r') as f:
            data = json.load(f)
            name = data.get("username")

# 2. PRINT OUTPUT
print("Cache-Control: no-cache")
print("Content-type: text/html\n")

print("<html><head><title>Python Session Page 2</title></head><body>")
print("<h1>Python State Page 2</h1>")

if name:
    print(f"<p><b>Name:</b> {name}</p>")
else:
    print("<p><b>Name:</b> You do not have a name set (or session expired).</p>")

print("<br/><a href='session-state.py'>Back to Page 1</a><br/>")
print("<a href='/index.html'>Home</a>")
print("</body></html>")