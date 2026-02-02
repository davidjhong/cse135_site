package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cgi"
	"os"
	"time"
)

type ResponseData struct {
	Message   string `json:"message"`
	Date      string `json:"date"`
	IPAddress string `json:"ip_address"`
}

func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "application/json")

	// Prepare Data
	data := ResponseData{
		Message:   "Hello JSON World from Go",
		Date:      time.Now().Format(time.RFC1123),
		IPAddress: os.Getenv("REMOTE_ADDR"),
	}

	// Print JSON
	jsonBytes, err := json.Marshal(data)
	if err == nil {
		fmt.Fprintln(w, string(jsonBytes))
	}
}

func main() {
	cgi.Serve(http.HandlerFunc(handler))
}