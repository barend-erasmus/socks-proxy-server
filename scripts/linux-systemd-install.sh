wget -O /lib/systemd/system/socks-proxy-server.service "https://raw.githubusercontent.com/barend-erasmus/socks-proxy-server/master/scripts/socks-proxy-server.service"

systemctl start socks-proxy-server

systemctl enable socks-proxy-server
