# Warehouse IPAM Internal HTTPS Deployment Examples

This folder contains examples for serving Warehouse IPAM to phones over HTTPS.

- `caddy/Caddyfile.example`: simplest reverse proxy option. Caddy can issue an internal certificate.
- `nginx/warehouse-ipam.conf.example`: Nginx reverse proxy option using supplied certificate files.
- `windows/allow-warehouse-ipam-firewall.ps1`: Windows Firewall rules for LAN access on ports 443 and optionally 80.

Recommended production shape:

1. Run the Next.js app locally on the server at `127.0.0.1:3000`.
2. Put Caddy or Nginx in front of it.
3. Expose only HTTPS port `443` to warehouse phones.
4. Use an internal DNS name such as `ipam.warehouse.local`.
5. Install/trust the local certificate authority on phones.

Phone camera scanning needs a secure browser context. `https://ipam.warehouse.local` works when the phone trusts the certificate. `http://server-ip:3000` usually blocks camera access.
