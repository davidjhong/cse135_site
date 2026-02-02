#!/usr/bin/env python3
import os
import sys
import datetime

# 1. Print Headers
print("Cache-Control: no-cache")
print("Content-type: text/html\n")

# 2. Start HTML
print("<!DOCTYPE html>")
print("<html><head><title>Python Echo Response</title>")
print("<style>body{font-family:sans-serif; max-width:800px; margin:20px auto; padding:20px; line-height:1.6;} b{color:#555;} .box{background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:5px;} pre{color:green; font-family:monospace;}</style>")
print("</head><body>")

print("<h1 align='center'>Python Echo Response</h1><hr>")

# --- 3. SERVER & CLIENT INFO ---
print("<h3>Server & Client Info:</h3>")
print("<div class='box'>")
print(f"<p><b>1. Hostname:</b> {os.environ.get('HTTP_HOST', 'Unknown')}</p>")
print(f"<p><b>2. Date/Time:</b> {datetime.datetime.now()}</p>")
print(f"<p><b>3. User Agent:</b> {os.environ.get('HTTP_USER_AGENT', 'Unknown')}</p>")
print(f"<p><b>4. IP Address:</b> {os.environ.get('REMOTE_ADDR', 'Unknown')}</p>")
print("</div>")

# --- 4. HTTP DETAILS ---
print("<h3>HTTP Details:</h3>")
print("<div class='box'>")
print(f"<p><b>HTTP Protocol:</b> {os.environ.get('SERVER_PROTOCOL', 'Unknown')}</p>")
print(f"<p><b>HTTP Method:</b> {os.environ.get('REQUEST_METHOD', 'Unknown')}</p>")
print(f"<p><b>Query String:</b> {os.environ.get('QUERY_STRING', '')}</p>")
print("</div>")

# --- 5. MESSAGE BODY (STDIN) ---
print("<h3>Message Body:</h3>")
print("<div class='box'>")

# Safely read content length
content_length = os.environ.get('CONTENT_LENGTH', 0)
if content_length:
    content_length = int(content_length)
    # Read exactly that many bytes from Standard Input
    body_data = sys.stdin.read(content_length)
    if body_data:
        print(f"<pre>{body_data}</pre>")
    else:
        print("<p style='color:#999;'><i>(No body data received)</i></p>")
else:
    print("<p style='color:#999;'><i>(No content length provided)</i></p>")

print("</div>")

# --- 6. NAVIGATION ---
print("<hr>")
print("<div style='text-align:center; margin-top:20px;'>")
print("<a href='/index.html' style='text-decoration:none; background:#444; color:white; padding:10px 15px; border-radius:5px; margin-right:10px;'>Home</a>")
print("<a href='/hw2/echo_tester.html' style='text-decoration:none; background:#007bff; color:white; padding:10px 15px; border-radius:5px;'>Back to Tester</a>")
print("</div>")

print("</body></html>")