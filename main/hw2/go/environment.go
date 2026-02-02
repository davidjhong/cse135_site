package main

import (
	"fmt"
	"net/http"
	"net/http/cgi"
	"os"
	"sort"
	"strings"
)

func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html")

	fmt.Fprintln(w, "<!DOCTYPE html><html><head><title>Environment Variables (Go)</title></head>")
	fmt.Fprintln(w, "<body><h1 align='center'>Environment Variables (Go)</h1><hr>")

	// Get all environment variables
	env := os.Environ()
	sort.Strings(env)

	for _, e := range env {
		pair := strings.SplitN(e, "=", 2)
		if len(pair) == 2 {
			fmt.Fprintf(w, "<b>%s:</b> %s<br />\n", pair[0], pair[1])
		}
	}

	fmt.Fprintln(w, "<hr><div style='text-align:center;'><a href='/index.html'>Home</a></div>")
	fmt.Fprintln(w, "</body></html>")
}

func main() {
	cgi.Serve(http.HandlerFunc(handler))
}