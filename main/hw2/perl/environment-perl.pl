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

print "</body></html>";