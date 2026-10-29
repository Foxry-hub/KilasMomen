import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Happy Click",
    short_name: "Happy Click",
    description: "Photobooth interaktif offline-first. Jepret, cetak, bagikan!",
    start_url: "/kiosk",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#FFFBEB",
    theme_color: "#FFDE00",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
