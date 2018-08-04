# SOCKS Proxy Server

![Travis CI](https://api.travis-ci.org/barend-erasmus/socks-proxy-server.svg?branch=master)

## Getting Started

## Quick Install

`curl -s https://raw.githubusercontent.com/barend-erasmus/socks-proxy-server/master/scripts/linux-systemd-install.sh | bash`

### Installing

`npm install -g socks-proxy-server`

### Usage

`socks-proxy-server start --hostname 0.0.0.0  --port 1080`

```
Usage: start [options]

  Options:

    -c --config <config>      Config
    -h --hostname <hostname>  Hostname
    -p --port <port>          Port
    -h, --help                output usage information
```

### Uninstalling

`npm uninstall -g socks-proxy-server`

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
port: 1080
requiresUsernamePasswordAuthentication: true
userNamePasswordPairs:
- - admin
  - 123456
- - userName
  - password
```
