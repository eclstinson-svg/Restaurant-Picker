import type { MetadataRoute } from "next";

// Tells phones how to treat the app when it's added to the home screen
// (name under the icon, opens full-screen without browser bars).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinner Dice",
    short_name: "Dinner Dice",
    description: "Roll for tonight's table.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: "#f6f8fa",
  };
}
