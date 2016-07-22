var
  WebSocketServer = require('ws').Server,
  async = require('async'),
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
  this.socketPool = {};
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

    this.server = new WebSocketServer({port: config.port});

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
    this.socketPool[clientId] = clientSocket;

    this.context.accessors.router.newConnection(this.protocol, clientId)
      .then(connection => {
        this.connectionPool[clientId] = connection;
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
      this.context.accessors.router.removeConnection(this.connectionPool[clientId]);
      delete this.connectionPool[clientId];
      delete this.socketPool[clientId];
    }
  };

  this.onClientMessage = function (clientId, data) {
    var
      requestObject,
      payload;

    if (data) {
      payload = JSON.parse(data);

      if (this.connectionPool[clientId]) {
        requestObject = new this.context.constructors.RequestObject(payload, {}, this.protocol);

        this.context.accessors.router.execute(
          requestObject,
          this.connectionPool[clientId],
          (error, response) => {
            response.room = response.requestId;
            this.socketPool[clientId].send(JSON.stringify(response));
          }
        );
      }
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

      this.channels[data.channel].forEach(clientId => {
        if (this.connectionPool[clientId] && this.socketPool[clientId]) {
          this.socketPool[clientId].send(JSON.stringify(payload));
        }
      });
    }
  };

  this.notify = function (data) {
    var payload;

    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id] && this.socketPool[data.id]) {
      payload = data.payload;
      payload.room = data.channel;
      this.socketPool[data.id].send(JSON.stringify(payload));
    }
  };

  this.joinChannel = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      if (!this.channels[data.channel]) {
        this.channels[data.channel] = [];
      }

      this.channels[data.channel].push(data.id);
    }
  };

  this.leaveChannel = function (data) {
    var index;

    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      if (this.channels[data.channel]) {
        index = this.channels[data.channel].indexOf(data.id);
        if (index !== -1) {
          this.channels[data.channel].splice(index, 1);

          if (this.channels[data.channel].length === 0) {
            delete this.channels[data.channel];
          }
        }
      }
    }
  };
}

module.exports = WebsocketProtocol;
