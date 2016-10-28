[![Build Status](https://travis-ci.org/kuzzleio/kuzzle-plugin-websocket.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle-plugin-websocket) [![codecov.io](http://codecov.io/github/kuzzleio/kuzzle-plugin-websocket/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle-plugin-websocket?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/kuzzle-plugin-websocket.svg)](https://david-dm.org/kuzzleio/kuzzle-plugin-websocket)

# Protocol plugin: websocket

Protocol plugin adding websocket support to Kuzzle.

Requires Kuzzle 1.0.0-RC5 or higher.

# Manifest

This plugin doesn't need any right.

# Configuration

You can override the configuration usign the CLI utilitie in Kuzzle:

| Name | Default value | Type | Description                 |
|------|---------------|-----------|-----------------------------|
| ``port`` | ``7513`` | Integer > 1024 | Network port to open |

# How to use

Kuzzle may send a multitude of messages to a client, either to respond to multiple asynchronous requests, or to notify events on client's subscriptions.  
To allow a client to link a response to a request or to a subscription, Kuzzle normally features a room system for protocols allowing it.

Since WebSocket messages do not support this feature natively, all messages sent through this protocol contain an additional `room` attribute at the root of the message structure. Clients connecting to Kuzzle using this protocol must use this field to dispatch incoming messages to the right parts of an application.

This `room` attribute is either:

* a request `requestId`, for request responses
* a `channel` (see [Kuzzle subscriptions](http://kuzzle.io/api-reference/#on)), for notifications on subscriptions


# How to create a plugin

See [Kuzzle documentation](http://kuzzle.io/guide/#plugins) about plugin for more information about how to create your own plugin.

# About Kuzzle

For UI and linked objects developers, [Kuzzle](https://github.com/kuzzleio/kuzzle) is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc).

[Kuzzle](https://github.com/kuzzleio/kuzzle) features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols.
