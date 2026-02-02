package main

import (
	"fmt"
	"net/http"
	"net/http/cgi"
	"os"
	"time"
)

func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html")

	fmt.Fprintln(w, "<!DOCTYPE html>")
	fmt.Fprintln(w, "<html><head><title>Hello Go World</title></head>")
	fmt.Fprintln(w, "<body>")
	fmt.Fprintln(w, "<h1 align='center'>Hello HTML World from Go</h1><hr/>")
	fmt.Fprintln(w, "<p>Hello World</p>")
	fmt.Fprintln(w, "<p>This page was generated with the Go programming language</p>")

	// Current Date
	fmt.Fprintf(w, "<p>This program was generated at: %s</p>", time.Now().Format(time.RFC1123))

	// IP Address
	ip := os.Getenv("REMOTE_ADDR")
	if ip == "" {
		ip = "Unknown"
	}
	fmt.Fprintf(w, "<p>Your current IP Address is: %s</p>", ip)

	// Navigation
	fmt.Fprintln(w, "<hr><div style='text-align:center;'><a href='/index.html'>Home</a></div>")
	fmt.Fprintln(w, "</body></html>")
}

func main() {
	cgi.Serve(http.HandlerFunc(handler))
}