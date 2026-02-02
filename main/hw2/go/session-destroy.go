package main

import (
	"fmt"
	"net/http"
	"net/http/cgi"
	"os"
	"time"
)

func handler(w http.ResponseWriter, r *http.Request) {
	// 1. Get Cookie to find file
	cookie, err := r.Cookie("CGISESSID")
	if err == nil && cookie.Value != "" {
		sessionID := cookie.Value
		sessionFile := "/tmp/cgisess_" + sessionID + ".json"
		
		// 2. Delete File
		if _, err := os.Stat(sessionFile); err == nil {
			os.Remove(sessionFile)
		}
	}

	// 3. Expire Cookie
	http.SetCookie(w, &http.Cookie{
		Name:    "CGISESSID",
		Value:   "deleted",
		Expires: time.Unix(0, 0), // Set to past date
		Path:    "/",
	})

	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html")

	fmt.Fprintln(w, "<html><head><title>Session Destroyed</title></head><body>")
	fmt.Fprintln(w, "<h1>Session Destroyed</h1>")
	fmt.Fprintln(w, "<p>Your session file has been deleted and cookie expired.</p>")
	fmt.Fprintln(w, "<a href='session.cgi'>Start New Session</a>")
	fmt.Fprintln(w, "<br><a href='/index.html'>Home</a></body></html>")
}

func main() {
	cgi.Serve(http.HandlerFunc(handler))
}