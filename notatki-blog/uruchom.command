#!/bin/bash
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
(sleep 1; open "http://localhost:8765/") &
python3 server.py
