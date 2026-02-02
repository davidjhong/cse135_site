#!/usr/bin/env python3
import os
import datetime

print("Cache-Control: no-cache")
print("Content-type: text/html\n")

print("<!DOCTYPE html>")
print("<html><head><title>Hello Python World</title></head>")
print("<body>")

print("<h1 align='center'>Hello HTML World from Python</h1><hr/>")
print("<p>Hello World</p>")
print("<p>This page was generated with the Python programming language</p>")

# Current Date
print(f"<p>This program was generated at: {datetime.datetime.now()}</p>")

# IP Address
remote_addr = os.environ.get('REMOTE_ADDR', 'Unknown')
print(f"<p>Your current IP Address is: {remote_addr}</p>")

# --- NAVIGATION ---
print("<hr>")
print("<div style='text-align:center;'>")
print("<a href='/index.html'>Home</a>")
print("</div>")

print("</body>")
print("</html>")