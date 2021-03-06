var
  should = require('should'),
  proxyquire = require('proxyquire'),
  sinon = require('sinon');

require('sinon-as-promised')(Promise);

describe('plugin implementation', function () {
  var
    Plugin,
    plugin,
    setPort,
    setBackend,
    onSpy = sinon.spy(),
    sendSpy = sinon.spy(),
    badId = 'aBadId',
    goodId = 'aGoodId',
    goodChannel = 'aGoodChannel',
    badChannel = 'aBadChannel';

  before(function () {
    // stubbing websocket
    Plugin = proxyquire('../lib/index', {
      'ws': {
        Server: function(config) {
          setPort = config.port;

          return {
            on: onSpy
          };
        }
      }
    });
  });

  beforeEach(function () {
    setPort = -1;
    setBackend = null;
    plugin = new Plugin();
    onSpy.reset();
    sendSpy.reset();
  });

  describe('#general', function () {
    it('should expose an init function', function () {
      should(plugin.init).be.a.Function();
    });
  });

  describe('#init', function () {
    var
      config = {port: 1234},
      context = {foo: 'bar'};

    it('should throw an error if no "config" argument has been provided', function (done) {
      try {
        plugin.init(undefined, {}, true);
        done(new Error('Expected a throw, but nothing happened'));
      }
      catch (e) {
        done();
      }
    });

    it('should fallback to dummy-mode if no port configuration has been provided', function () {
      var ret = plugin.init({}, {}, false);

      should(ret).be.false();
      should(plugin.isDummy).be.true();
    });

    it('should set internal properties correctly', function () {
      var
        ret = plugin.init(config, context, true);

      should(ret).be.eql(plugin);
      should(plugin.isDummy).be.true();
      should(plugin.config).be.eql(config);
      should(plugin.context).be.eql(context);
      should(setPort).be.eql(-1);
      should(setBackend).be.null();
    });

    it('should setup a websocket server if not in dummy mode', function () {
      var ret = plugin.init(config, context, false);

      should(ret).be.eql(plugin);
      should(plugin.isDummy).be.false();
      should(plugin.config).be.eql(config);
      should(plugin.context).be.eql(context);
      should(setPort).be.eql(1234);
      should(onSpy.firstCall.args[0]).be.eql('connection');
      should(onSpy.firstCall.args[1]).be.Function();
      should(onSpy.secondCall.args[0]).be.eql('error');
      should(onSpy.secondCall.args[1]).be.Function();
    });
  });

  describe('#onConnection', function () {
    var
      config = {port: 1234},
      onClientSpy = sinon.stub(),
      clientSocketMock = {
        on: onClientSpy,
        close: sinon.stub()
      },
      newConnectionSpy = sinon.stub(),
      context = {accessors: {router: {newConnection: newConnectionSpy}}};

    beforeEach(() => {
      onClientSpy.reset();
      clientSocketMock.close.reset();
      newConnectionSpy.reset();
    });

    it('should bind proper listeners', function (done) {
      var
        clientDisconnectionStub = sinon.stub(plugin, 'onClientDisconnection'),
        clientMessageStub = sinon.stub(plugin, 'onClientMessage');

      this.timeout(50);
      newConnectionSpy.resolves({a: 'connection'});
      plugin.init(config, context, false);

      plugin.onConnection(clientSocketMock);

      setTimeout(() => {
        should(onClientSpy.callCount).be.eql(3);
        should(onClientSpy.firstCall.args[0]).be.eql('close');
        should(onClientSpy.firstCall.args[1]).be.Function();
        should(onClientSpy.secondCall.args[0]).be.eql('error');
        should(onClientSpy.secondCall.args[1]).be.Function();
        should(onClientSpy.thirdCall.args[0]).be.eql('message');
        should(onClientSpy.thirdCall.args[1]).be.Function();

        should(clientDisconnectionStub.callCount).be.eql(0);
        should(clientMessageStub.callCount).be.eql(0);
        onClientSpy.firstCall.args[1]();
        should(clientDisconnectionStub.callCount).be.eql(1);
        should(clientMessageStub.callCount).be.eql(0);
        onClientSpy.secondCall.args[1]();
        should(clientDisconnectionStub.callCount).be.eql(2);
        should(clientMessageStub.callCount).be.eql(0);
        onClientSpy.thirdCall.args[1]();
        should(clientDisconnectionStub.callCount).be.eql(2);
        should(clientMessageStub.callCount).be.eql(1);

        clientDisconnectionStub.reset();
        clientMessageStub.reset();
        should(Object.keys(plugin.connectionPool).length).be.eql(1);
        done();
      }, 20);
    });

    it('should reject and close the socket if creating a connection fails', done => {
      this.timeout(50);
      newConnectionSpy.rejects({status: 666, message: 'foobar'});

      plugin.init(config, context, false);

      plugin.onConnection(clientSocketMock);

      setTimeout(() => {
        should(onClientSpy.callCount).be.eql(0);
        should(clientSocketMock.close.called).be.true();
        should(clientSocketMock.close.calledWith(4503, 'foobar'));
        done();
      });

    });
  });

  describe('#broadcast', function () {
    var
      config = {port: 1234},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init(config, {}, true);
      should(plugin.broadcast({})).be.false();
    });

    it('should do nothing if channel does not exist', function () {
      plugin.init(config, context, false);
      plugin.broadcast({
        channels: [badChannel],
        payload: {}
      });
      should(sendSpy.callCount).be.eql(0);
    });


    it('should call send if all conditions are met', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: {
          [goodId]: true
        }
      };
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          }
        }
      };

      plugin.broadcast({
        channels: [goodChannel],
        payload: {some: 'data'}
      });
      should(sendSpy.callCount).be.eql(1);
      should(sendSpy.firstCall.args[0]).be.eql(JSON.stringify({some: 'data', room: goodChannel}));
    });
  });

  describe('#notify', function () {
    var
      config = {port: 1234},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init(config, {}, true);
      should(plugin.notify({})).be.false();
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.notify({
        id: badId,
        payload: {},
        channels: [goodChannel]
      });
      should(sendSpy.callCount).be.eql(0);
    });

    it('should call send if all conditions are met', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          }
        }
      };

      plugin.notify({
        id: goodId,
        channels: [goodChannel],
        payload: {some: 'data'}
      });
      should(sendSpy.callCount).be.eql(1);
      should(sendSpy.firstCall.args[0]).be.eql(JSON.stringify({some: 'data', room: goodChannel}));
    });
  });

  describe('#joinChannel', function () {
    var
      config = {port: 1234},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init(config, {}, true);
      should(plugin.joinChannel({})).be.false();
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.joinChannel({
        id: badId
      });
      should(plugin.channels).be.deepEqual({});
    });

    it('should add clientId to the channel if conditions are met', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: { count: 0 }
      };
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      plugin.joinChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: { [goodId]: true, count: 1 }
      });
    });

    it('should create the channel entry add clientId to the channel if conditions are met and channel did not exist before', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      plugin.joinChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: { [goodId]: true, count: 1 }
      });
    });
  });

  describe('#leaveChannel', function () {
    var
      config = {port: 1234},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init({}, {}, true);
      should(plugin.leaveChannel({})).be.false();
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.leaveChannel({
        id: badId
      });
      should(plugin.channels).be.deepEqual({});
    });

    it('should do nothing if channel does not exist', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]:  {
          alive: true
        }
      };
      plugin.leaveChannel({
        id: goodId
      });
      should(plugin.channels).be.deepEqual({});
    });

    it('should do nothing if id is not in channel', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      plugin.channels = {
        [goodChannel]: {[badId]: true }
      };
      plugin.leaveChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: {[badId]: true}
      });
    });

    it('should remove id from channel if conditions are met', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };
      plugin.channels = {
        [goodChannel]: {[goodId]: true, [badId]: true, count: 2}
      };
      plugin.leaveChannel({
        id: goodId,
        channel: goodChannel
      });

      should(plugin.channels).be.deepEqual({
        [goodChannel]: {[badId]: true, count: 1}
      });
      should(plugin.connectionPool[goodId].channels.length).be.eql(0);
    });

    it('should remove id from channel if conditions are met and remove channel if it is empty', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      plugin.channels = {
        [goodChannel]: {[goodId]: true}
      };
      plugin.leaveChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({});
    });
  });

  describe('#onMessage', function () {
    var
      config = {port: 1234},
      fakeRequestObject = {aRequest: 'Object'},
      requestObjectStub = sinon.stub().returns(fakeRequestObject),
      executeStub = sinon.stub().callsArgWith(2, null, {requestId: 'foo'}),
      context = {constructors: {RequestObject: requestObjectStub}, accessors: {router: {execute: executeStub}}};

    beforeEach(() => {
      requestObjectStub.reset();
      executeStub.reset();
    });

    it('should do nothing if the data is undefined', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      plugin.onClientMessage(badId, undefined);
      should(executeStub.callCount).be.eql(0);
      should(requestObjectStub.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      plugin.onClientMessage(badId, JSON.stringify('aPayload'));
      should(executeStub.callCount).be.eql(0);
      should(requestObjectStub.callCount).be.eql(0);
    });

    it('should execute the request if client and packet are ok', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      plugin.onClientMessage(goodId, JSON.stringify('aPayload'));
      should(requestObjectStub.callCount).be.eql(1);
      should(requestObjectStub.firstCall.args).be.deepEqual(['aPayload', {}, 'websocket']);
      should(executeStub.callCount).be.eql(1);
      should(executeStub.firstCall.args[0]).be.deepEqual(fakeRequestObject);
      should(executeStub.firstCall.args[1]).be.eql('aConnection');
      should(executeStub.firstCall.args[2]).be.Function();
      should(sendSpy.callCount).be.eql(1);
      should(sendSpy.firstCall.args[0]).be.eql(JSON.stringify({requestId: 'foo', room: 'foo'}));
    });
  });

  describe('#onServerError', function () {
    var
      config = {port: 1234},
      context = {foo: 'bar'};

    it('should switch the plugin in dummy-mode if called', function () {
      plugin.init(config, context, false);
      should(plugin.isDummy).be.false();
      plugin.onServerError('anError');
      should(plugin.isDummy).be.true();
    });
  });

  describe('#onClientDisconnection', function () {
    var
      config = {port: 1234},
      removeConnectionSpy = sinon.stub().resolves({a: 'connection'}),
      context = {accessors: {router: {removeConnection: removeConnectionSpy}}};

    beforeEach(() => {
      removeConnectionSpy.reset();
    });

    it('should do nothing if the client is unknown', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: []
      };
      plugin.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      plugin.socketPool = {
        [goodId]: true
      };
      plugin.onClientDisconnection(badId);
      should(removeConnectionSpy.callCount).be.eql(0);
      should(plugin.connectionPool[goodId].alive).be.true();
      should(plugin.socketPool[goodId]).be.true();
    });

    it('should remove the client connection if it exists', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: {[goodId]: true, 'foobar': true, count: 2}
      };
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };

      plugin.onClientDisconnection(goodId);
      should(removeConnectionSpy.callCount).be.eql(1);
      should(plugin.connectionPool).be.deepEqual({});
      should(plugin.channels).be.deepEqual({[goodChannel]: {foobar: true, count: 1}});
    });

    it('should remove a channel entirely if the last connection leaves', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: {[goodId]: true}
      };
      plugin.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };

      plugin.onClientDisconnection(goodId);
      should(removeConnectionSpy.callCount).be.eql(1);
      should(plugin.connectionPool).be.deepEqual({});
      should(plugin.channels).be.deepEqual({});
    });
  });
});
