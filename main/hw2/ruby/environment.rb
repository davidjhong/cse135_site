#!/usr/bin/ruby
puts "Cache-Control: no-cache"
puts "Content-type: text/html\n\n"

puts "<!DOCTYPE html><html><head><title>Environment Variables (Ruby)</title></head>"
puts "<body><h1 align='center'>Environment Variables (Ruby)</h1><hr>"

# Loop through ENV and sort keys
ENV.keys.sort.each do |key|
  puts "<b>#{key}:</b> #{ENV[key]}<br />"
end

puts "<hr><div style='text-align:center;'><a href='/index.html'>Home</a></div>"
puts "</body></html>"