package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/cgi"
	"os"
	"time"
)

// Define the session structure
type SessionData struct {
	Username string `json:"username"`
}

func handler(w http.ResponseWriter, r *http.Request) {
	// 1. Get or Create Session ID
	cookie, err := r.Cookie("CGISESSID")
	sessionID := ""
	
	if err != nil || cookie.Value == "" {
		// Generate random ID
		rand.Seed(time.Now().UnixNano())
		chars := "abcdefghijklmnopqrstuvwxyz0123456789"
		b := make([]byte, 16)
		for i := range b {
			b[i] = chars[rand.Intn(len(chars))]
		}
		sessionID = string(b)
	} else {
		sessionID = cookie.Value
	}

	// 2. Load Session Data from File
	sessionFile := "/tmp/cgisess_" + sessionID + ".json"
	data := SessionData{}

	fileBytes, err := os.ReadFile(sessionFile)
	if err == nil {
		json.Unmarshal(fileBytes, &data)
	}

	// 3. Handle POST (Set Name)
	if r.Method == "POST" {
		r.ParseForm()
		newName := r.FormValue("username")
		if newName != "" {
			data.Username = newName
			// Save to File
			jsonData, _ := json.Marshal(data)
			os.WriteFile(sessionFile, jsonData, 0644)
		}
	}

	// 4. Set Cookie and Headers
	http.SetCookie(w, &http.Cookie{
		Name:  "CGISESSID",
		Value: sessionID,
		Path:  "/",
	})
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html")

	// 5. Render HTML
	fmt.Fprintln(w, "<html><head><title>Go Session Page 1</title></head><body>")
	fmt.Fprintln(w, "<h1>Go State Page 1</h1>")

	if data.Username != "" {
		fmt.Fprintf(w, "<p><b>Name:</b> %s</p>", data.Username)
	} else {
		fmt.Fprintln(w, "<p><b>Name:</b> You do not have a name set</p>")
	}

	fmt.Fprintln(w, "<h3>Set Name:</h3>")
	fmt.Fprintln(w, "<form method='POST'>")
	fmt.Fprintln(w, "Name: <input type='text' name='username'>")
	fmt.Fprintln(w, "<input type='submit' value='Set Session Name'>")
	fmt.Fprintln(w, "</form>")

	fmt.Fprintln(w, "<br/><a href='session-read.cgi'>Go to Page 2 (Check State)</a><br/>")
	fmt.Fprintln(w, "<form action='session-destroy.cgi' method='get'><button>Destroy Session</button></form>")
	fmt.Fprintln(w, "<hr><a href='/index.html'>Home</a></body></html>")
}

func main() {
	cgi.Serve(http.HandlerFunc(handler))
}