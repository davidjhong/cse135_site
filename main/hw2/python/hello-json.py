#!/usr/bin/env python3
import json
import os
import datetime

# Headers
print("Cache-Control: no-cache")
print("Content-type: application/json\n")

# Data Dictionary
data = {
    "message": "Hello JSON World from Python",
    "date": str(datetime.datetime.now()),
    "ip_address": os.environ.get('REMOTE_ADDR', 'Unknown')
}

# Print JSON
print(json.dumps(data))