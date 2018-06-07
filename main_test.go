package main

import (
	"net/http"
	"net/http/httptest"
	"syscall"
	"testing"
	"time"

	"github.com/aerogo/aero"
	"github.com/stretchr/testify/assert"
)

func TestAppRun(t *testing.T) {
	go main()
	time.Sleep(1 * time.Second)
	syscall.Kill(syscall.Getpid(), syscall.SIGINT)
}

func TestFrontPage(t *testing.T) {
	app := configure(aero.New())

	request, _ := http.NewRequest("GET", "/", nil)
	request.Header.Set("Accept-Encoding", "gzip")

	response := httptest.NewRecorder()
	app.Handler().ServeHTTP(response, request)

	assert.Equal(t, http.StatusOK, response.Code)
}
