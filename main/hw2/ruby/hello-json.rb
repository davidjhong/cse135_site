#!/usr/bin/ruby
require 'json'

puts "Cache-Control: no-cache"
puts "Content-type: application/json\n\n"

data = {
  "message" => "Hello JSON World from Ruby",
  "date" => Time.now.strftime('%Y-%m-%d %H:%M:%S'),
  "ip_address" => ENV['REMOTE_ADDR']
}

puts JSON.generate(data)