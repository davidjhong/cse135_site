#!/usr/bin/env python3
import os
import http.cookies

# 1. GET SESSION ID
cookie = http.cookies.SimpleCookie(os.environ.get("HTTP_COOKIE"))

# 2. DELETE SESSION FILE
if "CGISESSID" in cookie:
    session_id = cookie["CGISESSID"].value
    session_file = f"/tmp/cgisess_{session_id}.json"
    
    if os.path.exists(session_file):
        os.remove(session_file)

# 3. EXPIRE COOKIE (Tell browser to delete it)
print("Set-Cookie: CGISESSID=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/")
print("Cache-Control: no-cache")
print("Content-type: text/html\n")

print("<html><head><title>Session Destroyed</title></head><body>")
print("<h1>Session Destroyed</h1>")
print("<p>Your session file has been deleted and cookie expired.</p>")
print("<a href='session-state.py'>Start New Session</a>")
print("<br/><a href='session-state.py'>Back to Page 1</a><br/>")
print("<br/><a href='session-state-2.py'>Back to Page 2</a><br/>")
print("<br><a href='/index.html'>Home</a>")
print("</body></html>")