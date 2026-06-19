import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GestiónPro",
    short_name: "GestiónPro",
    description: "Sistema profesional de gestión de inventarios y ventas",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    lang: "es",
    dir: "ltr",
    icons: [
      {
        src: "/logonuevo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
