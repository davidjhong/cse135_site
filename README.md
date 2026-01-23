## Compression (compression-verify)
- I verified compression in Incognito mode to exclude browser extensions. The total resource size was ~6.7kB, and the transferred size was ~3.2kB, confirming that mod_deflate is successfully compressing my HTML and CSS.

## Server name (header-verify)
- Modifiying ServerTokens in apache2.conf was insufficient because ServerTokens does not accept custom strings; it only allows predefined keywords (e.g., Prod, Minimal, OS).
- So, I installed `libapache2-mod-security2`. Then, I configured the `SecServerSignature` directive in `/etc/apache2/mods-enabled/security2.conf` to rewrite the header to "CSE135 Server". Finally, I ensured `ServerTokens` was set to `Full` in `security.conf` so the security module could properly intercept and replace the header.

