package main

import (
	"os"
	"path"

	"github.com/aerogo/aero"
	"github.com/akyoto/color"
)

func configureHTTPS(app *aero.Application) {
	fullCertPath := path.Join("security", "server.crt")
	fullKeyPath := path.Join("security", "server.key")

	if _, err := os.Stat(fullCertPath); os.IsNotExist(err) {
		defaultCertPath := path.Join("security", "default", "server.crt")
		err := os.Link(defaultCertPath, fullCertPath)

		if err != nil {
			// Do not panic here, multiple tests could be running this in parallel.
			// Therefore, races can occur (which test writes the link first).
			// Simply log the error and continue as the file should be present.
			color.Red(err.Error())
		}
	}

	if _, err := os.Stat(fullKeyPath); os.IsNotExist(err) {
		defaultKeyPath := path.Join("security", "default", "server.key")
		err := os.Link(defaultKeyPath, fullKeyPath)

		if err != nil {
			// Do not panic here, multiple tests could be running this in parallel.
			// Therefore, races can occur (which test writes the link first).
			// Simply log the error and continue as the file should be present.
			color.Red(err.Error())
		}
	}

	// HTTPS
	app.Security.Load(fullCertPath, fullKeyPath)
}
