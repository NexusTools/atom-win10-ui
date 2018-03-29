import { CompositeDisposable, Package } from "atom";
import registry = require('winreg');
import path = require('path');
import fs = require('fs');
import os = require("os");

var myself: Package;
const release = os.release();
const isWin = /^win\d+$/.test(process.platform);
const isWin8 = isWin && /^6\.[23456789]\./.test(release);
const isWin10 = isWin && !isWin8 && /^10\./.test(release);
const isWin10or8 = isWin10 || isWin8;
const noop = function(){}

var currentAccent: string;
var changedAccentColor: string;
const stylesPath = path.resolve(__dirname, "../styles");
const variablesFile = path.resolve(stylesPath, "ui-variables.less");
const ACCENT_VALUE = isWin10 ? 'AccentColorMenu' : 'AccentColor';
const WINDOWS_ACCENT_KEY_REG = isWin10or8 ? new registry({
  hive: registry.HKCU,
  key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent'
}) : undefined;
/*const setDarkColors = function() {
  atom.config.set("win10-ui.themeBackgroundColor", "#35373b");
  atom.config.set("win10-ui.themeForegroundColor", "#e8e8e8");
}
const setLightColors = function() {
  atom.config.set("win10-ui.themeBackgroundColor", "#e0e0e0");
  atom.config.set("win10-ui.themeForegroundColor", "#0a0a0a");
}*/
const isDark = function(color: string) {
  const R = parseInt(color.substring(1, 3), 16);
  const G = parseInt(color.substring(3, 5), 16);
  const B = parseInt(color.substring(5, 7), 16);

  return (5 * G + 2 * R + B) <= 8 * 128;
}
/*const setDynamicColors = function(invert?: boolean) {
  var can = isDark(atom.config.get('win10-ui.themeAccentColor').toHexString());
  if(invert)
    can = !can;
  if(can)
    setDarkColors();
  else
    setLightColors();
}*/
var debug: typeof console.log;
var trace: typeof console.trace;
const writeConfig = function(color?: any) {
  const accentColor = (color || atom.config.get('win10-ui.themeAccentColor')).toHexString();
  //const backgroundColor = atom.config.get('win10-ui.themeBackgroundColor').toHexString();
  const accentColorDark = isDark(accentColor);
  debug("writeConfig", accentColor, accentColorDark);
  const config = `@font-size: ${atom.config.get('win10-ui.fontSize')}px;\n` +
    `@accent-color: ${accentColor};\n` +
    `@accent-color-is-dark: ${accentColorDark ? 1 : 0};\n` +
    /*`@base-background-color: ${backgroundColor};\n` +
    `@background-color-dark: ${isDark(backgroundColor) ? 100 : 0}%;\n\n` +
    `@text-color: ${atom.config.get('win10-ui.themeForegroundColor').toHexString()};\n` +*/
    `@text-color-accent:  ${accentColorDark ? "lighten(@text-color, 40%)" : "darken(@text-color, 40%)"};\n` +
    `@text-color-accent-contrast:  ${accentColorDark ? "white" : "black"};`;
  fs.readFile(path.resolve(stylesPath, "ui-variables.less.input"), "utf-8", function(err, inputVariables) {
    if(err)
      throw err;
    else
      fs.writeFile(variablesFile, inputVariables.replace(/{{config}}/, config), function(err) {
        if(err)
          throw err;
        else
          atom.packages.getActivePackage("win10-ui")['reloadStylesheets']();
      });
  });

}
var updateInterval: NodeJS.Timer;
const updateAccent = function(writeAlways?: boolean) {
  return WINDOWS_ACCENT_KEY_REG.get(ACCENT_VALUE, function(error, item) {
    if (error) {
      if (writeAlways)
        writeConfig();
      try{clearInterval(updateInterval)}catch(e){}
      throw new Error("Issue with windows registry lookup: " + error);
    }

    const abgr = item.value;
    const color = "#" + abgr.substring(8, 10) + abgr.substring(6, 8) + abgr.substring(4, 6);
    if (currentAccent === color) {
      if (writeAlways)
        writeConfig();
      return;
    }
    currentAccent = color;
    debug("read accent color", color);
    if(atom.config.get('win10-ui.themeAccentColor').toHexString() !== color) {
      changedAccentColor = color;
      debug("setting accent color", color);
      atom.config.set('win10-ui.themeAccentColor', color);
    } else if (writeAlways)
      writeConfig();
  });
}
const reset = function() {
  try{clearInterval(updateInterval)}catch(e){}
  compositeDisposable.dispose();
  currentAccent = undefined;
};
var presetChanged: boolean;
/*const updatePresetAndWriteConfig = function() {
  if(!changedAccentColor)
    atom.config.set(`win10-ui.preset`, "Custom");
  writeConfig();
}*/

var compositeDisposable: any;
const win10 = {
  config: {
    /*preset: {
      order: 1,
      type: 'string',
      default: 'Dark',
      enum: [
        'Dark',
        'Light',
        'Dynamic',
        'Custom'
      ]
    },*/
    useSystemAccentColor: {
      order: 2,
      type: 'boolean',
      description: 'Theme accent color will automatically be determined based on your operating system (Windows 8 or 10 required)',
      disabled: !isWin10or8,
      default: isWin10or8
    },
    themeAccentColor: {
      order: 3,
      type: 'color',
      default: '#edde2c'
    },
    /*themeBackgroundColor: {
      order: 4,
      type: 'color',
      default: '#35373b'
    },
    themeForegroundColor: {
      order: 5,
      type: 'color',
      default: '#e8e8e8'
    },*/
    fontSize: {
      order: 6,
      description: 'Change the UI font size. (Between 8 and 20)',
      type: 'integer',
      minimum: 8,
      maximum: 20,
      default: 12
    },
    debug: {
      order: 7,
      description: 'Output to the console',
      type: 'boolean',
      default: false
    }
  },
  activate: function(state) {
    if (atom.config.get("win10-ui.debug")) {
      debug = console.log.bind(console);
      trace = console.log.bind(console);
    } else {
      debug = noop;
      trace = noop;
    }

    myself = atom.packages.getActivePackage("win10-ui");
    compositeDisposable = new CompositeDisposable;
    /*compositeDisposable.add(atom.config.onDidChange(`win10-ui.preset`, function(preset) {
      changedAccentColor = true;
      switch(preset.newValue) {
        case "Dark":
          setDarkColors();
          break;
        case "Light":
          setLightColors();
          break;
        case "Dynamic":
          setDynamicColors();
          break;
      }
      setTimeout(function() {
        changedAccentColor = false;
      }, 250);
    }));*/
    compositeDisposable.add(atom.config.onDidChange(`win10-ui.debug`, function(data) {
      if (data.newValue) {
        debug = console.log.bind(console);
        trace = console.trace.bind(console);
      } else {
        debug = noop;
        trace = noop;
      }
    }));
    compositeDisposable.add(atom.config.onDidChange(`win10-ui.fontSize`, writeConfig));
    //compositeDisposable.add(atom.config.onDidChange(`win10-ui.themeForegroundColor`, updatePresetAndWriteConfig));
    //compositeDisposable.add(atom.config.onDidChange(`win10-ui.themeBackgroundColor`, updatePresetAndWriteConfig));
    compositeDisposable.add(atom.config.onDidChange(`win10-ui.useSystemAccentColor`, function(data) {
      try{clearInterval(updateInterval)}catch(e){}
      if (isWin10or8 && data.newValue) {
        updateInterval = setInterval(updateAccent, 1500);
        debug("Started updateAccent interval");
        currentAccent = undefined;
        updateAccent();
      } else {
        debug("Stopped updateAccent interval");
        trace();
      }
    }));
    compositeDisposable.add(atom.config.onDidChange(`win10-ui.themeAccentColor`, function(data) {
      if(data.newValue.toHexString() !== changedAccentColor) {
        debug("use system accent disabled because of user interaction");
        atom.config.set(`win10-ui.useSystemAccentColor`, false);
      } else {
        debug("accent color changed dynamically");
        changedAccentColor = undefined;
      }
      debug("accent color changed", data.newValue);
      writeConfig(data.newValue);
    }));
    if (isWin10or8 && atom.config.get("win10-ui.useSystemAccentColor")) {
      try{clearInterval(updateInterval)}catch(e){}
      updateInterval = setInterval(updateAccent, 1500);
      debug("Started updateAccent interval");
      currentAccent = undefined;
      updateAccent(true);
    } else
      writeConfig();
  },
  deactivate: reset,
  destroy: reset
};
export = win10;
