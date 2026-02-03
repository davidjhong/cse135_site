#!/usr/bin/ruby
require 'cgi'
require 'json'

cgi = CGI.new
session_id = cgi.cookies["CGISESSID"].first
name = nil

if session_id
  session_file = "/tmp/cgisess_#{session_id}.json"
  if File.exist?(session_file)
    data = JSON.parse(File.read(session_file))
    name = data['username']
  end
end

puts "Cache-Control: no-cache"
puts "Content-type: text/html\n\n"

puts "<html><head><title>Ruby Session Page 2</title></head><body>"
puts "<h1>Ruby State Page 2</h1>"

if name
  puts "<p><b>Name:</b> #{name}</p>"
else
  puts "<p><b>Name:</b> Session not found or no name set.</p>"
end

puts "<br/><a href='session-state.rb'>Back to Page 1</a><br/>"
puts "<a href='/index.html'>Home</a></body></html>"
puts "<form action='session-destroy.rb' method='get'><button>Destroy Session</button></form>"
