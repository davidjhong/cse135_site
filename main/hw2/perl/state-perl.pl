#!/usr/bin/perl
use CGI;
use CGI::Session;

# Create a new Perl Session
$session = new CGI::Session("driver:File", undef, {Directory=>"/tmp"});

# Create CGI Object
$cgi = CGI->new;

# Create a new Cookie from the Session ID
$cookie = $cgi->cookie(CGISESSID => $session->id);
print $cgi->header( -cookie=>$cookie );

# Store Data in that Perl Session
my $name = $session->param('username') || $cgi->param('username');
if($cgi->param('username')) {
    $session->param("username", $name);
}

print "<html>";
print "<head><title>Perl Sessions State</title></head>";
print "<body>";

print "<h1>Perl State Page 1</h1>";

if ($name){
	print("<p><b>Name:</b> $name</p>");
} else {
	print "<p><b>Name:</b> You do not have a name set</p>";
}

print "<h3>Set Name:</h3>";
print "<form method='POST'>";
print "Name: <input type='text' name='username'>";
print "<input type='submit' value='Set Session Name'>";
print "</form>";

print "<br/><br/>";
print "<a href=\"state-perl-2.pl\">Go to Page 2 (Check State)</a><br/>";
print "<br />";
print "<form action=\"state-destroy.pl\" method=\"get\">";
print "<button type=\"submit\">Destroy Session</button>";
print "</form>";

print "</body>";
print "</html>";