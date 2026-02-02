package main

import (
	"fmt"
	"io"
	"net/http"
	"net/http/cgi"
	"os"
	"time"
)

func handler(w http.ResponseWriter, r *http.Request) {
	// 1. Headers
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html")

	// 2. HTML Start
	fmt.Fprintln(w, "<!DOCTYPE html><html><head><title>Go Echo Response</title>")
	fmt.Fprintln(w, "<style>body{font-family:sans-serif; max-width:800px; margin:20px auto; padding:20px; line-height:1.6;} b{color:#555;} .box{background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:5px;} pre{color:green; font-family:monospace;}</style>")
	fmt.Fprintln(w, "</head><body>")

	fmt.Fprintln(w, "<h1 align='center'>Go Echo Response</h1><hr>")

	// 3. Server & Client Info
	fmt.Fprintln(w, "<h3>Server & Client Info:</h3><div class='box'>")
	fmt.Fprintf(w, "<p><b>1. Hostname:</b> %s</p>", r.Host)
	fmt.Fprintf(w, "<p><b>2. Date/Time:</b> %s</p>", time.Now().Format(time.RFC1123))
	fmt.Fprintf(w, "<p><b>3. User Agent:</b> %s</p>", r.UserAgent())
	fmt.Fprintf(w, "<p><b>4. IP Address:</b> %s</p>", r.RemoteAddr)
	fmt.Fprintln(w, "</div>")

	// 4. HTTP Details
	fmt.Fprintln(w, "<h3>HTTP Details:</h3><div class='box'>")
	fmt.Fprintf(w, "<p><b>HTTP Protocol:</b> %s</p>", r.Proto)
	fmt.Fprintf(w, "<p><b>HTTP Method:</b> %s</p>", r.Method)
	fmt.Fprintf(w, "<p><b>Query String:</b> %s</p>", r.URL.RawQuery)
	fmt.Fprintln(w, "</div>")

	// 5. Message Body
	fmt.Fprintln(w, "<h3>Message Body:</h3><div class='box'>")
	body, err := io.ReadAll(r.Body)
	if err == nil && len(body) > 0 {
		fmt.Fprintf(w, "<pre>%s</pre>", string(body))
	} else {
		fmt.Fprintln(w, "<p style='color:#999;'><i>(No body data received)</i></p>")
	}
	fmt.Fprintln(w, "</div>")

	// 6. Navigation
	fmt.Fprintln(w, "<hr><div style='text-align:center; margin-top:20px;'>")
	fmt.Fprintln(w, "<a href='/index.html' style='text-decoration:none; background:#444; color:white; padding:10px 15px; border-radius:5px; margin-right:10px;'>Home</a>")
	fmt.Fprintln(w, "<a href='/hw2/echo_tester.html' style='text-decoration:none; background:#007bff; color:white; padding:10px 15px; border-radius:5px;'>Back to Tester</a>")
	fmt.Fprintln(w, "</div></body></html>")
}

func main() {
	// This magically turns standard HTTP logic into CGI logic
	if err := cgi.Serve(http.HandlerFunc(handler)); err != nil {
		fmt.Println("Internal Server Error")
	}
}