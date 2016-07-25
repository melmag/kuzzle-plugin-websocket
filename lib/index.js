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
          connection,
          socket: clientSocket,
          channels: []
        };
      });

    clientSocket.on('close', () => {
      this.onClientDisconnection(clientId);
    });

    clientSocket.on('error', () => {
      this.onClientDisconnection(clientId);
    });

    clientSocket.on('message', data => {
      this.onClientMessage(clientId, data);
    });
  };

  this.onClientDisconnection = function (clientId) {
    if (this.connectionPool[clientId]) {
      this.context.accessors.router.removeConnection(this.connectionPool[clientId].connection);
      this.connectionPool[clientId].channels.forEach(channel => this.leaveChannel({id: clientId, channel}));
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

          // Connection may have been closed before sending this response
          if (this.connectionPool[clientId] && this.connectionPool[clientId].socket) {
            this.connectionPool[clientId].socket.send(JSON.stringify(response));
          }
        }
      );
    }
  };

  this.broadcast = function (data) {
    var payload;

    if (this.isDummy) {
      return false;
    }

    if (this.channels[data.channel]) {
      payload = data.payload;
      payload.room = data.channel;
      payload = JSON.stringify(payload);

      Object.keys(this.channels[data.channel]).forEach(clientId => {
        this.connectionPool[clientId].socket.send(payload);
      });
    }
  };

  this.notify = function (data) {
    var payload;

    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      payload = data.payload;
      payload.room = data.channel;
      this.connectionPool[data.id].socket.send(JSON.stringify(payload));
    }
  };

  this.joinChannel = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      if (!this.channels[data.channel]) {
        this.channels[data.channel] = {};
      }

      this.channels[data.channel][data.id] = true;
      this.connectionPool[data.id].channels.push(data.channel);
    }
  };

  this.leaveChannel = function (data) {
    var index;

    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id] && this.channels[data.channel] && this.channels[data.channel][data.id]) {
      if (Object.keys(this.channels[data.channel]).length > 1) {
        delete this.channels[data.channel][data.id];
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

module.exports = WebsocketProtocol;
