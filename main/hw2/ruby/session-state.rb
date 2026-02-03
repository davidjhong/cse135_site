#!/usr/bin/ruby
require 'cgi'
require 'json'
require 'securerandom'

cgi = CGI.new
cookie_name = "CGISESSID"
session_id = cgi.cookies[cookie_name].first

# 1. Create ID if missing
if session_id.nil? || session_id.empty?
  session_id = SecureRandom.hex(16)
end

session_file = "/tmp/cgisess_#{session_id}.json"
data = {}

# 2. Load existing data
if File.exist?(session_file)
  begin
    data = JSON.parse(File.read(session_file))
  rescue
    data = {}
  end
end

# 3. Handle POST
if ENV['REQUEST_METHOD'] == 'POST'
  # CGI.new parses parameters automatically
  new_name = cgi['username']
  if new_name && !new_name.empty?
    data['username'] = new_name
    File.write(session_file, data.to_json)
  end
end

# 4. Headers & Output
puts "Cache-Control: no-cache"
# Set-Cookie manually (Ruby CGI can be verbose)
puts "Set-Cookie: #{cookie_name}=#{session_id}; Path=/"
puts "Content-type: text/html\n\n"

puts "<html><head><title>Ruby Session Page 1</title></head><body>"
puts "<h1>Ruby State Page 1</h1>"

if data['username']
  puts "<p><b>Name:</b> #{data['username']}</p>"
else
  puts "<p><b>Name:</b> You do not have a name set</p>"
end

puts "<h3>Set Name:</h3>"
puts "<form method='POST'>"
puts "Name: <input type='text' name='username'>"
puts "<input type='submit' value='Set Session Name'>"
puts "</form>"

puts "<br/><a href='session-state-2.rb'>Go to Page 2</a><br/>"
puts "<form action='session-destroy.rb' method='get'><button>Destroy Session</button></form>"
puts "<hr><a href='/index.html'>Home</a></body></html>"