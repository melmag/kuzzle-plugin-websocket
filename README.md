[![Build Status](https://travis-ci.org/kuzzleio/kuzzle-plugin-websocket.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle-plugin-websocket) [![codecov.io](http://codecov.io/github/kuzzleio/kuzzle-plugin-websocket/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/websocket?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/kuzzle-plugin-websocket.svg)](https://david-dm.org/kuzzleio/kuzzle-plugin-websocket)

![logo](https://camo.githubusercontent.com/e40bd0387af8440d3276c9fdea60650d9f787482/687474703a2f2f6b757a7a6c652e696f2f67756964652f696d616765732f6b757a7a6c652e737667)

# Protocol plugin: websocket

Protocol plugin adding websocket support to Kuzzle.

# Manifest

This plugin doesn't need any right.

# Configuration

You can override the configuration usign the CLI utilitie in Kuzzle:

| Name | Default value | Type | Description                 |
|------|---------------|-----------|-----------------------------|
| ``port`` | ``5713`` | Integer > 1024 | Network port to open |

# How to create a plugin

See [Kuzzle documentation](https://github.com/kuzzleio/kuzzle/blob/master/docs/plugins.md) about plugin for more information about how to create your own plugin.

# About Kuzzle

For UI and linked objects developers, [Kuzzle](https://github.com/kuzzleio/kuzzle) is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc).

[Kuzzle](https://github.com/kuzzleio/kuzzle) features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols.
