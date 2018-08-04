import * as net from 'net';
import { Connection } from './../connection';

export function start(
  allowedIPAddresses: string[],
  deniedIPAddresses: string[],
  hostname: string,
  port: number,
  requiresUserNamePasswordAuthentication: boolean,
  userNamePasswordPairs: string[][],
) {
  const server: net.Server = net.createServer((socket: net.Socket) =>
    onConnection(
      allowedIPAddresses,
      deniedIPAddresses,
      requiresUserNamePasswordAuthentication,
      socket,
      userNamePasswordPairs,
    ),
  );

  hostname = hostname ? hostname : '0.0.0.0';
  port = port ? port : 1337;

  server.listen(port, hostname, () => {
    console.log(`Listening on ${hostname}:${port}`);
  });
}

function onConnection(
  allowedIPAddresses: string[],
  deniedIPAddresses: string[],
  requiresUserNamePasswordAuthentication: boolean,
  socket: net.Socket,
  userNamePasswordPairs: string[][],
): void {
  const connection: Connection = new Connection(
    (password: string, userName: string) => {
      if (!requiresUserNamePasswordAuthentication) {
        return true;
      }

      if (!userNamePasswordPairs) {
        return false;
      }

      for (const userNamePasswordPair of userNamePasswordPairs) {
        if (userNamePasswordPair[0] === userName && userNamePasswordPair[1] === password) {
          return true;
        }
      }

      return false;
    },
    allowedIPAddresses,
    socket,
    deniedIPAddresses,
    requiresUserNamePasswordAuthentication,
  );
}
