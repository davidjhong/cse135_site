#!/usr/bin/ruby
require 'json'

puts "Cache-Control: no-cache"
puts "Content-type: text/html\n\n"

puts "<!DOCTYPE html><html><head><title>Ruby Echo Response</title>"
puts "<style>body{font-family:sans-serif; max-width:800px; margin:20px auto; padding:20px; line-height:1.6;} b{color:#555;} .box{background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:5px;} pre{color:green; font-family:monospace;}</style>"
puts "</head><body>"

puts "<h1 align='center'>Ruby Echo Response</h1><hr>"

puts "<h3>Server & Client Info:</h3><div class='box'>"
puts "<p><b>1. Hostname:</b> #{ENV['HTTP_HOST']}</p>"
puts "<p><b>2. Date/Time:</b> #{Time.now}</p>"
puts "<p><b>3. User Agent:</b> #{ENV['HTTP_USER_AGENT']}</p>"
puts "<p><b>4. IP Address:</b> #{ENV['REMOTE_ADDR']}</p>"
puts "</div>"

puts "<h3>HTTP Details:</h3><div class='box'>"
puts "<p><b>HTTP Protocol:</b> #{ENV['SERVER_PROTOCOL']}</p>"
puts "<p><b>HTTP Method:</b> #{ENV['REQUEST_METHOD']}</p>"
puts "<p><b>Query String:</b> #{ENV['QUERY_STRING']}</p>"
puts "</div>"

puts "<h3>Message Body:</h3><div class='box'>"
# Read from Standard Input
body = STDIN.read(ENV['CONTENT_LENGTH'].to_i)
if body && !body.empty?
  puts "<pre>#{body}</pre>"
else
  puts "<p style='color:#999;'><i>(No body data received)</i></p>"
end
puts "</div>"

puts "<hr><div style='text-align:center; margin-top:20px;'>"
puts "<a href='/index.html' style='text-decoration:none; background:#444; color:white; padding:10px 15px; border-radius:5px; margin-right:10px;'>Home</a>"
puts "<a href='/hw2/echo_tester.html' style='text-decoration:none; background:#007bff; color:white; padding:10px 15px; border-radius:5px;'>Back to Tester</a>"
puts "</div></body></html>"