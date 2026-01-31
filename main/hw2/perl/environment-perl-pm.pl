#!/usr/bin/perl

# The below line includes the CGI.pm Perl library
use CGI qw/:standard/;     

# CGI.pm Method
print "Cache-Control: no-cache\n";
print header;

# CGI.pm Method
print start_html("Environment Variables");

print "<h1 align='center'>Environment Variables</h1><hr />";

# Loop through all of the environment variables, then print each variable and its value
foreach my $key (sort(keys(%ENV))) {
   print  "$key = $ENV{$key}<br />\n";
}

# --- NAVIGATION BLOCK ---
print "<hr>";
print "<div style='margin-top:20px; text-align:center;'>";
print "<a href='../../index.html' style='margin-right:20px;'>Home</a>";
print "</div>";
# ------------------------

# CGI.pm method
print end_html;
