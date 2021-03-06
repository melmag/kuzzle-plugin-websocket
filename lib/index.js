var
  WebSocketServer = require('ws').Server,
  uuid = require('node-uuid');

/**
 * @constructor
 */
function WebsocketProtocol () {
  this.config = {};
  this.protocol = 'websocket';
  this.isDummy = false;
  this.context = null;
  this.channels = {};
  this.connectionPool = {};
  this.server = {};

  this.init = function (config, context, isDummy) {
    if (!config) {
      throw new Error('[plugin-websocket] A configuration parameter is required');
    }

    if (!config.port) {
      this.isDummy = true;
      console.error(new Error('[plugin-websocket] The \'port\' attribute, with the port to listen to, is required'));
      return false;
    }

    this.isDummy = isDummy;
    this.config = config;
    this.context = context;

    if (this.isDummy) {
      return this;
    }

    this.server = new WebSocketServer({port: config.port}, {perMessageDeflate: false});

    this.server.on('connection', this.onConnection.bind(this));
    this.server.on('error', this.onServerError.bind(this));

    return this;
  };

  this.onServerError = function (error) {
    console.error('[plugin-websocket] An error has occured:', error);
    this.isDummy = true;
  };

  this.onConnection = function (clientSocket) {
    var clientId = uuid.v4();

    this.context.accessors.router.newConnection(this.protocol, clientId)
      .then(connection => {
        this.connectionPool[clientId] = {
          alive: true,
          connection,
          socket: clientSocket,
          channels: []
        };

        clientSocket.on('close', () => {
          this.onClientDisconnection(clientId);
        });

        clientSocket.on('error', () => {
          this.onClientDisconnection(clientId);
        });

        clientSocket.on('message', data => {
          this.onClientMessage(clientId, data);
        });
      })
      .catch(err => {
        // Using the 4xxx code range, as the current implementation of
        // the "ws" library does not support the 1013 (Try Again Later)
        // error event
        clientSocket.close(4000 + err.status, err.message);
      });
  };

  this.onClientDisconnection = function (clientId) {
    if (this.connectionPool[clientId]) {
      this.connectionPool[clientId].alive = false;
      this.context.accessors.router.removeConnection(this.connectionPool[clientId].connection);

      this.connectionPool[clientId].channels.forEach(channel => {
        if (this.channels[channel] && this.channels[channel].count > 1) {
          delete this.channels[channel][clientId];
          this.channels[channel].count--;
        }
        else {
          delete this.channels[channel];
        }
      });

      delete this.connectionPool[clientId];
    }
  };

  this.onClientMessage = function (clientId, data) {
    var
      requestObject,
      payload;

    if (data && this.connectionPool[clientId]) {
      payload = JSON.parse(data);
      requestObject = new this.context.constructors.RequestObject(payload, {}, this.protocol);

      this.context.accessors.router.execute(
        requestObject,
        this.connectionPool[clientId].connection,
        (error, response) => {
          response.room = response.requestId;
          send(this.connectionPool, clientId, JSON.stringify(response));
        }
      );
    }
  };

  this.broadcast = function (data) {
    var
      payload;

    if (this.isDummy) {
      return false;
    }

    /*
     Avoids stringifying the payload multiple times just to update the room:
      - we start deleting the last character, which is the closing JSON bracket ('}')
      - we then only have to inject the following string to each channel:
        ,"room":"<roomID"}

      So, instead of stringifying the payload for each channel, we only concat
      a new substring to the original payload.
     */
    payload = JSON.stringify(data.payload).slice(0, -1);

    data.channels.forEach(channel => {
      var channelPayload;

      if (this.channels[channel]) {
        channelPayload = payload + ',"room":"' + channel + '"}';

        Object.keys(this.channels[channel]).forEach(clientId => {
          send(this.connectionPool, clientId, channelPayload);
        });
      }
    });
  };

  this.notify = function (data) {
    var payload;

    if (this.isDummy) {
      return false;
    }

    payload = data.payload;

    data.channels.forEach(channel => {
      payload.room = channel;
      send(this.connectionPool, data.id, JSON.stringify(payload));
    });
  };

  this.joinChannel = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id] && this.connectionPool[data.id].alive) {
      if (!this.channels[data.channel]) {
        this.channels[data.channel] = {
          count: 0
        };
      }

      this.channels[data.channel][data.id] = true;
      this.channels[data.channel].count++;
      this.connectionPool[data.id].channels.push(data.channel);
    }
  };

  this.leaveChannel = function (data) {
    var index;

    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id] && this.connectionPool[data.id].alive && this.channels[data.channel] && this.channels[data.channel][data.id]) {
      if (this.channels[data.channel].count > 1) {
        delete this.channels[data.channel][data.id];
        this.channels[data.channel].count--;
      }
      else {
        delete this.channels[data.channel];
      }

      index = this.connectionPool[data.id].channels.indexOf(data.channel);

      if (index !== -1) {
        this.connectionPool[data.id].channels.splice(index, 1);
      }
    }
  };
}

function send(pool, id, data) {
  if (pool[id] && pool[id].alive && pool[id].socket.readyState === pool[id].socket.OPEN) {
    pool[id].socket.send(data);
  }
}

module.exports = WebsocketProtocol;
