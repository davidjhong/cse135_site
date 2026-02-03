#!/usr/bin/ruby
require 'cgi'

cgi = CGI.new
session_id = cgi.cookies["CGISESSID"].first

# 1. Delete File
if session_id
  session_file = "/tmp/cgisess_#{session_id}.json"
  File.delete(session_file) if File.exist?(session_file)
end

# 2. Expire Cookie
puts "Set-Cookie: CGISESSID=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"
puts "Cache-Control: no-cache"
puts "Content-type: text/html\n\n"

puts "<html><head><title>Session Destroyed</title></head><body>"
puts "<h1>Session Destroyed</h1>"
puts "<p>File deleted and cookie expired.</p>"
puts "<a href='session-state.rb'>Start New Session</a>"
puts "<br><a href='/index.html'>Home</a></body></html>"