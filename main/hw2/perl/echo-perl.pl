#!/usr/bin/perl
print "Cache-Control: no-cache\n";
print "Content-type: text/html \n\n";

print "<!DOCTYPE html>";
print "<html><head><title>Perl Echo Response</title>";
print "<style>body{font-family:sans-serif; max-width:800px; margin:20px auto; padding:20px; line-height:1.6;} b{color:#555;} .box{background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:5px;}</style>";
print "</head><body>";

print "<h1 align='center'>Perl Echo Response</h1><hr>";

print "<h3>Server & Client Info:</h3>";
print "<div class='box'>";
print "<p><b>1. Hostname:</b> $ENV{HTTP_HOST}</p>";
print "<p><b>2. Date/Time:</b> " . localtime() . "</p>";
print "<p><b>3. User Agent:</b> $ENV{HTTP_USER_AGENT}</p>";
print "<p><b>4. IP Address:</b> $ENV{REMOTE_ADDR}</p>";
print "</div>";

print "<h3>HTTP Details:</h3>";
print "<div class='box'>";
print "<p><b>HTTP Protocol:</b> $ENV{SERVER_PROTOCOL}</p>";
print "<p><b>HTTP Method:</b> $ENV{REQUEST_METHOD}</p>";
print "<p><b>Query String:</b> $ENV{QUERY_STRING}</p>";
print "</div>";

print "<h3>Message Body:</h3>";
print "<div class='box'>";

# Read from STDIN (Standard Input)
read(STDIN, $buffer, $ENV{'CONTENT_LENGTH'});

if ($buffer) {
    print "<p style='color:green;'>$buffer</p>";
} else {
    print "<p style='color:#999;'><i>(No body data received)</i></p>";
}
print "</div>";

print "<hr>";
print "<div style='text-align:center; margin-top:20px;'>";
print "<a href='/index.html' style='text-decoration:none; background:#444; color:white; padding:10px 15px; border-radius:5px; margin-right:10px;'>Home</a>";print "<a href='/echo_tester.html' style='text-decoration:none; background:#007bff; color:white; padding:10px 15px; border-radius:5px;'>Back to Tester</a>";
print "<a href='/hw2/echo_tester.html' style='text-decoration:none; background:#007bff; color:white; padding:10px 15px; border-radius:5px;'>Back to Tester</a>";
print "</div>";

print "</body></html>";