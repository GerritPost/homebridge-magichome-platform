//
//  clearDirSwitch.js
//  Sahil Chaddha
//
//  Created by Sahil Chaddha on 26/08/2018.
//  Copyright © 2018 sahilchaddha.com. All rights reserved.
//

const convert = require('color-convert')
const Accessory = require('./base')

const LightBulb = class extends Accessory {
  constructor(config, log, homebridge) {
    super(config, log, homebridge)
    this.config = config
    this.name = config.name || 'LED Controller'
    this.warmWhiteOnly = config.warmWhiteOnly || false
    this.ip = config.ip
    this.setup = config.setup || 'RGBW'
    this.color = { H: 0, S: 0, L: 100 }
    this.timeout = config.timeout != null ? config.timeout : 60000
    setTimeout(() => {
      this.updateState()
    }, 3000)
  }

  getAccessoryServices() {
    var lightbulbService = new this.homebridge.Service.Lightbulb(this.name)
    lightbulbService
      .getCharacteristic(this.homebridge.Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this))

      lightbulbService
        .addCharacteristic(new this.homebridge.Characteristic.Brightness())
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this))

    this.logMessage('warmWhiteOnly parameter---------------------------------',this.config.warmWhiteOnly)

    if (this.config.warmWhiteOnly === false) {
      this.logMessage('warmWhiteOnly == false')
      lightbulbService
        .addCharacteristic(new this.homebridge.Characteristic.Saturation())
        .on('get', this.getSaturation.bind(this))
        .on('set', this.setSaturation.bind(this))

      lightbulbService
        .addCharacteristic(new this.homebridge.Characteristic.Hue())
        .on('get', this.getHue.bind(this))
        .on('set', this.setHue.bind(this))
    }
    return [lightbulbService]
  }

  sendCommand(command, callback) {
    this.executeCommand(this.ip, command, callback)
  }

  getModelName() {
    return 'Light Bulb'
  }

  getSerialNumber() {
    return '00-001-LightBulb'
  }

  logMessage(...args) {
    if (this.config.debug) {
      this.log(args)
    }
  }

  startTimer() {
    if (this.timeout === 0) return
    setTimeout(() => {
      this.updateState()
    }, this.timeout)
  }

  updateState() {
    const self = this
    this.logMessage('Polling Light', this.ip)
    self.getState((settings) => {
      self.isOn = settings.on
      self.color = settings.color
      self.logMessage('Updating Device', self.ip, self.color, self.isOn)
      self.services[0]
        .getCharacteristic(this.homebridge.Characteristic.On)
        .updateValue(self.isOn)
      self.services[0]
          .getCharacteristic(this.homebridge.Characteristic.Brightness)
          .updateValue(self.color.L)
      if (this.warmWhiteOnly === false) {
        self.services[0]
          .getCharacteristic(this.homebridge.Characteristic.Hue)
          .updateValue(self.color.H)
        self.services[0]
          .getCharacteristic(this.homebridge.Characteristic.Saturation)
          .updateValue(self.color.S)
      }
      this.startTimer()
    })
  }

  getState(callback) {
    this.sendCommand('-i', (error, stdout) => {
      var settings = {
        on: false,
        color: { H: 255, S: 100, L: 50 },
      }

      var colors = stdout.match(/\(.*,.*,.*\)/g)
      var isOn = stdout.match(/\] ON /g)
      if (isOn && isOn.length > 0) {
        settings.on = true
      }
      if (colors && colors.length > 0) {
        // Remove last char )
        var str = colors.toString().substring(0, colors.toString().length - 1)
        // Remove First Char (
        str = str.substring(1, str.length)
        const rgbColors = str.split(',').map((item) => {
          return item.trim()
        })
        var converted = convert.rgb.hsv(rgbColors)
        var h = isNaN(converted[0]) ? 0 : converted[0]
        var s = isNaN(converted[1]) ? 0 : converted[1]
        var l = isNaN(converted[2]) ? 0 : converted[2]

        settings.color = {
          H: h,
          S: s,
          L: l,
        }
      }

      callback(settings)
    })
  }

  getPowerState(callback) {
    callback(null, this.isOn)
  }

  setPowerState(value, callback) {
    const self = this
    this.sendCommand(value ? '--on' : '--off', () => {
      self.isOn = value
      callback()
    })
  }

  getHue(callback) {
    callback(null, this.color.H)
  }

  setHue(value, callback) {
    this.logMessage('setHue ', value)
    this.color.H = value
    this.setToCurrentColor()
    callback()
  }

  getBrightness(callback) {
    callback(null, this.color.L)
  }

  setBrightness(value, callback) {
    this.logMessage('setBrightness ', value)
    this.color.L = value
    if (this.warmWhiteOnly === false) {
      this.logMessage('setBrightness not warm white ---------------------- ', value)
      this.setToCurrentColor()
      callback()
      return
    }
    this.setToCurrentWhiteBrightness()
  }

  getSaturation(callback) {
    this.setToCurrentWhiteBrightness()
    callback(null, this.color.S)
  }

  setSaturation(value, callback) {
    this.logMessage('setSaturation ', value)
    this.color.S = value
    this.setToCurrentColor()
    callback()
  }

  setToCurrentWhiteBrightness() {
    this.logMessage('white brightness ', this.color.L)
    this.sendCommand('-w ' + this.color.L)
  }

  setToCurrentColor() {
    var color = this.color

    var converted = convert.hsv.rgb([color.H, color.S, color.L])
    this.logMessage('Setting New Color From ', this.ip, color, converted)
    // var base = '-x ' + this.setup + ' -c '
    this.sendCommand('-c ' + converted[0] + ',' + converted[1] + ',' + converted[2])
    // this.sendCommand(base + converted[0] + ',' + converted[1] + ',' + converted[2])
  }
}

module.exports = LightBulb
