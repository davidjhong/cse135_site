package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cgi"
	"os"
)

type SessionData struct {
	Username string `json:"username"`
}

func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html")

	fmt.Fprintln(w, "<html><head><title>Go Session Page 2</title></head><body>")
	fmt.Fprintln(w, "<h1>Go State Page 2</h1>")

	// 1. Get Cookie
	cookie, err := r.Cookie("CGISESSID")
	name := ""
	
	if err == nil && cookie.Value != "" {
		// 2. Read File
		sessionID := cookie.Value
		sessionFile := "/tmp/cgisess_" + sessionID + ".json"
		
		fileBytes, err := os.ReadFile(sessionFile)
		if err == nil {
			var data SessionData
			json.Unmarshal(fileBytes, &data)
			name = data.Username
		}
	}

	// 3. Display
	if name != "" {
		fmt.Fprintf(w, "<p><b>Name:</b> %s</p>", name)
	} else {
		fmt.Fprintln(w, "<p><b>Name:</b> You do not have a name set (or session expired).</p>")
	}

	fmt.Fprintln(w, "<br/><a href='session.cgi'>Back to Page 1</a><br/>")
	fmt.Fprintln(w, "<a href='/index.html'>Home</a></body></html>")
	fmt.Fprintln(w, "<form action='session-destroy.cgi' method='get'><button>Destroy Session</button></form>")
}

func main() {
	cgi.Serve(http.HandlerFunc(handler))
}