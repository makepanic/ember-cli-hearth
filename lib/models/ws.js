'use strict';

var WebSocketServer = require('ws').Server;

class WS {
  constructor(opts){
    this._ws = new WebSocketServer({
      port: opts.port
    });
    this.__ws = undefined;
    this.project = opts.project;
    this._on = {};
    this.ui = opts;
    this.listen();
  }

  listen(){
    this._ws.on('connection', (ws) => {
      console.log('client connected to websocket');
      this.__ws = ws;
      ws.on('message', (messageString) => {
        let data = this.deserializeMessage(messageString);
        console.log('socket message', data);
        if (this._on[data.type]) {
          this._on[data.type].forEach(handler => handler(this, data.body));
        }
      });
    });
  }

  send(type, data) {
    this.__ws.send(this.serializeMessage(type, data));
  }

  on(type, fn) {
    this._on[type] = this._on[type] || [];
    this._on[type].push(fn);
  }

  serializeMessage(type, data) {
    return JSON.stringify({type: type, body: data});
  }

  deserializeMessage(messageString) {
    let data=  JSON.parse(messageString);
    return {type: data.type, body: data.body}
  }
}

module.exports = WS;
