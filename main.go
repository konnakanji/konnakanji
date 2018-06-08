package main

import (
	"github.com/aerogo/aero"
	"github.com/konnakanji/konnakanji/components"
	"github.com/konnakanji/konnakanji/components/css"
	"github.com/konnakanji/konnakanji/components/js"
)

var mainApp = aero.New()

func main() {
	configure(mainApp).Run()
}

func configure(app *aero.Application) *aero.Application {
	app.Security.Load(
		"security/default/server.crt",
		"security/default/server.key",
	)

	app.Get("/", func(ctx *aero.Context) string {
		return ctx.HTML(components.Layout(ctx))
	})

	app.Get("/scripts", func(ctx *aero.Context) string {
		return ctx.JavaScript(js.Bundle())
	})

	app.Get("/styles", func(ctx *aero.Context) string {
		return ctx.CSS(css.Bundle())
	})

	app.Get("/manifest.json", func(ctx *aero.Context) string {
		return ctx.JSON(app.Config.Manifest)
	})

	app.Get("/words/*file", func(ctx *aero.Context) string {
		return ctx.File("words/" + ctx.Get("file"))
	})

	return app
}
