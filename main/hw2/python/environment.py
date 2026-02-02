#!/usr/bin/env python3
import os

print("Cache-Control: no-cache")
print("Content-type: text/html\n")

print("<!DOCTYPE html>")
print("<html><head><title>Environment Variables (Python)</title></head>")
print("<body><h1 align='center'>Environment Variables (Python)</h1><hr>")

# Loop through all environment variables
for key, value in sorted(os.environ.items()):
    print(f"<b>{key}:</b> {value}<br />")

# --- NAVIGATION ---
print("<hr>")
print("<div style='text-align:center;'>")
print("<a href='/index.html'>Home</a>")
print("</div>")

print("</body></html>")