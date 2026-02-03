#!/usr/bin/ruby
puts "Cache-Control: no-cache"
puts "Content-type: text/html\n\n"

puts "<!DOCTYPE html>"
puts "<html><head><title>Hello Ruby World</title></head>"
puts "<body>"
puts "<h1 align='center'>Hello HTML World from Ruby</h1><hr/>"
puts "<p>Hello World</p>"
puts "<p>This page was generated with the Ruby programming language</p>"

# Current Date
puts "<p>This program was generated at: #{Time.now.strftime('%a, %d %b %Y %H:%M:%S')}</p>"

# IP Address
ip = ENV['REMOTE_ADDR'] || 'Unknown'
puts "<p>Your current IP Address is: #{ip}</p>"

puts "<hr><div style='text-align:center;'><a href='/index.html'>Home</a></div>"
puts "</body></html>"