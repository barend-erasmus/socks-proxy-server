import * as net from 'net';
import { Connection } from './connection';

const server: net.Server = net.createServer(onConnection);

server.listen(1337, '127.0.0.1');

function onConnection(socket: net.Socket): void {
    const connection: Connection = new Connection(socket);
}
