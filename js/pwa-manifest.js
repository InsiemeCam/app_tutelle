(function() {
    const iconUrl = new URL("https://insiemecam.github.io/app_tutelle/logo_tutelle.jpg", window.location.href).href;
    const manifest = {
        name: "Tutelle Méricienne — Application de Gestion",
        short_name: "Tutelle Méricienne",
        start_url: window.location.href,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#7f1d1d",
        icons: [
            { src: iconUrl, sizes: "192x192", type: "image/jpeg" },
            { src: iconUrl, sizes: "512x512", type: "image/jpeg" }
        ]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
})();
