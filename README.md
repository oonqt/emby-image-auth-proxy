# emby-image-auth-proxy

A simple service to fix Emby's image endpoint vulnerability (see https://www.reddit.com/r/emby/comments/1ob548i/can_we_get_some_attention_on_this_emby_forum_post/)

This service will sit in between users and Emby, acting as a proxy. Normal requests will be proxied through, but requests made to /Items/\<itemId>/Images/Primary will be denied unless the IP address can be associated with an authenticated Emby session. 

# Installation

### Via Docker Compose (ALL ENVIRONMENT VARIABLES REQUIRED UNLESS OTHERWISE SPECIFIED)

* Before installing, make sure to go to **network settings** on Emby and set "Secure connection mode" to "Reverse proxy". If Emby is running in docker, simply unbind port 443 so that emby-image-proxy can listen on it and proxy requests. If you aren't running in docker, change the Emby HTTPS port to something else. You can go ahead and remove your SSL certificate from Emby as well.

```yaml
services:
  emby-image-auth-proxy:
    container_name: emby-image-auth-proxy
    image: ghcr.io/oonqt/emby-image-auth-proxy:latest
    restart: unless-stopped
    environment:
      -  EMBY_BASE_URL=http://embyserver:8096
      -  EMBY_API_KEY=xxxxxxxxxxxxxxxxxxxx
      -  SESSION_CACHE_TTL=10m # Time to consider Emby sessions valid before polling and rechecking Emby API
      -  SSL_PFX_CERT_PATH=/path/to/cert.pfx # Path to PKCS#12 keyfile used by Emby
      -  SSL_PFX_CERT_PASSPHRASE=xxxxxxxxxxxxxxxxxxxx
      -  PORT=443
      -  DEBUG=false (optional)
```

# Changelog

**<span style="color:#56adda">1.0.0</span>**
- Initial Release