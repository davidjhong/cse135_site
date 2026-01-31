#!/usr/bin/perl

print "Cache-Control: no-cache\n";
print "Content-Type: text/html\n\n";

print "<!DOCTYPE html>";
print "<html>";
print "<head>";
print "<title>Hello CGI World</title>";
print "</head>";
print "<body>";

print "<h1 align=center>Hello HTML World from Team Ibius</h1><hr/>";
print "<p>Hello World</p>";
print "<p>This page was generated with the Perl programming language</p>";

$date = localtime();
print "<p>This program was generated at: $date</p>";
print "<p>Edited by David Hong</p>";

# IP Address is an environment variable when using CGI
$address = $ENV{REMOTE_ADDR};
print "<p>Your current IP Address is: $address</p>";

# --- NAVIGATION BLOCK ---
print "<hr>";
print "<div style='margin-top:20px; text-align:center;'>";
print "<a href='../../index.html' style='margin-right:20px;'>Home</a>";
print "</div>";
# ------------------------

print "</body>";
print "</html>";