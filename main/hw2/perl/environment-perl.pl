#!/usr/bin/perl
print "Cache-Control: no-cache\n";
print "Content-type: text/html \n\n";

print <<END;
<!DOCTYPE html>
<html><head><title>Environment Variables</title>
</head><body><h1 align="center">Environment Variables</h1>
<hr>
END

# Loop over the environment variables and print each variable and its value
foreach $variable (sort keys %ENV) {
  print "<b>$variable:</b> $ENV{$variable}<br />\n";
}

# --- NAVIGATION BLOCK ---
print "<hr>";
print "<div style='margin-top:20px; text-align:center;'>";
print "<a href='../../index.html' style='margin-right:20px;'>🏠 Home</a>";
print "<a href='../echo_tester.html'>📝 Echo Tester</a>";
print "</div>";
# ------------------------

print "</body></html>";