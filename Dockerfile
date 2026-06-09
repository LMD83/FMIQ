# VerifIQ marketing site — static hosting via Caddy.
# Serves the pre-built HTML in verifiq26/website/. No build step required.
# Works on Railway, Fly, Render, or any container host (reads $PORT).
FROM caddy:2-alpine

# The static site.
COPY verifiq26/website/ /srv/

# Server config (extensionless URLs, gzip, custom 404).
COPY Caddyfile /etc/caddy/Caddyfile

# Railway/most PaaS inject $PORT; Caddyfile binds to it (defaults to 8080 locally).
EXPOSE 8080

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
