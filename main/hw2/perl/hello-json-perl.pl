#!/usr/bin/perl
# In Perl, you must first install the JSON package from CPAN (libjson-perl)
use JSON;

print "Cache-Control: no-cache\n";
print "Content-type: application/json\n\n";

$date = localtime();
$address = $ENV{REMOTE_ADDR};

# Customized for Team Ibius
my %message = (
    'title' => 'Hello, Perl!', 
    'heading' => 'Hello from Team Ibius!', 
    'message' => 'This page was generated with the Perl programming language by Team Ibius', 
    'time' => $date, 
    'IP' => $address
);

my $json = encode_json \%message;
print "$json\n";