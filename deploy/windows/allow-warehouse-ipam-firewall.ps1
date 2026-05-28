# Run PowerShell as Administrator.
# Opens inbound LAN access for HTTPS reverse proxy traffic.

New-NetFirewallRule `
  -DisplayName "Warehouse IPAM HTTPS" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 443 `
  -Profile Private,Domain

# Optional: only needed if your reverse proxy listens on port 80 to redirect HTTP to HTTPS.
New-NetFirewallRule `
  -DisplayName "Warehouse IPAM HTTP Redirect" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 80 `
  -Profile Private,Domain

# Do not expose port 3000 to the LAN when using a reverse proxy.
# Keep Next.js bound behind the proxy and expose only 443.
