'use strict'

const net = require('net')
const path = require('path')
const PLUGIN_NAME = 'tcp'

function resolveController(controller, app, index) {
  if (typeof controller === 'string') {
    const actions = controller.split('.')
    let obj = app[PLUGIN_NAME].controller[index]
    actions.forEach(key => {
      obj = obj[key]
      if (!obj) throw new Error(`controller '${controller}' not exists`)
    })
    controller = obj
  }
  // ensure controller is exists
  if (!controller) throw new Error('controller not exists')
  return controller
}

function EggTCP(app) {
  this.app = app
  this.server = []
  for (let index = 0; index < app.config.tcp.length; index++) {
    const tcp = app.config.tcp[index]
    const server = net.createServer()
    server.listen(tcp.port, tcp.host)
    this.server[index] = server
  }
}

EggTCP.prototype.handle = function (handler, index) {
  const controller = resolveController(handler, this.app, index)

  this.server[index].on('error', err => {
    this.app.coreLogger.error(`egg-tcp error:\n${err.stack}`)
  })

  // When a client requests a connection with the server, the server creates a new
  // socket dedicated to that client. The socket was handled by controller.
  this.server[index].on('connection', controller)

  this.server[index].on('listening', () => {
    const address = this.server[index].address()
    this.app.coreLogger.info(
      `egg-tcp listening ${address.address}:${address.port}`,
    )
  })
}

module.exports = app => {
  app[PLUGIN_NAME] = new EggTCP(app)
  if (!app[PLUGIN_NAME].controller) {
    app[PLUGIN_NAME].controller = []
    for (const server of app[PLUGIN_NAME].server) {
      app[PLUGIN_NAME].controller.push({})
    }
  }
  app[PLUGIN_NAME].controller = app[PLUGIN_NAME].controller || []

  app.beforeClose(function () {
    for (const server of app[PLUGIN_NAME].server) {
      server.close()
    }
  })
  for (let index = 0; index < app[PLUGIN_NAME].server.length; index++) {
    new app.loader.FileLoader({
      directory: path.join(
        app.config.baseDir,
        'app',
        PLUGIN_NAME,
        'controller',
      ),
      target: app[PLUGIN_NAME].controller[index],
      inject: app,
    }).load()
  }
}
