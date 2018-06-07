package main

import (
	"github.com/aerogo/aero"
)

func main() {
	app := aero.New()
	configure(app).Run()
}

func configure(app *aero.Application) *aero.Application {
	app.Get("/", func(ctx *aero.Context) string {
		return ctx.Text("Konna Kanji")
	})

	return app
}
