#!/usr/bin/perl
print "Cache-Control: no-cache\n";
print "Content-type: text/html \n\n";

print <<END;
<!DOCTYPE html>
<html><head><title>General Request Echo</title>
</head><body><h1 align="center">General Request Echo</h1>
<hr>
END

print "<p><b>HTTP Protocol:</b> $ENV{SERVER_PROTOCOL}</p>";
print "<p><b>HTTP Method:</b> $ENV{REQUEST_METHOD}</p>";
print "<p><b>Query String:</b> $ENV{QUERY_STRING}</p>";

# Read the Message Body from Standard Input
my $bytes_read = read STDIN, my $form_data, $ENV{CONTENT_LENGTH};

print "<p><b>Message Body:</b> $form_data</p>";

print "</body></html>\n";