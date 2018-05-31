# SOCKS Proxy Server

## Installation

`npm install -g socks-proxy-server`

`socks-proxy-server install`

`sudo systemctl daemon-reload`

`sudo systemctl enable socks-proxy-server`

`sudo systemctl start socks-proxy-server`

## Running

`socks-proxy-server start --hostname 0.0.0.0 --log ./ --port 1337`

`socks-proxy-server start --config my-config.yaml`

**Example**

```yaml
---
allow:
- 93.184.216.34 # example.com
- 185.60.219.6 # www.facebook.com
- 185.60.219.16 # www.facebook.com
- 185.60.219.35 # www.facebook.com
- 185.60.219.38 # www.facebook.com
deny:
- 93.184.216.34 # example.com
- 185.60.219.6 # www.facebook.com
- 185.60.219.16 # www.facebook.com
- 185.60.219.35 # www.facebook.com
- 185.60.219.38 # www.facebook.com
hostname: 0.0.0.0
log: D:/temp
port: 1080
requiresUsernamePasswordAuthentication: true
userNamePasswordPairs:
- - admin
  - 123456
- - userName
  - password
```
