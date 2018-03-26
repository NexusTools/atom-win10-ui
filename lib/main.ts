declare const require: (path: string) => any;
declare const __dirname: string;
declare const process: any;
declare const global: any;

const _atom = global.atom;

const registry = require('winreg');
const path = require('path');
const atom = require("atom");
const fs = require('fs');
const os = require("os");

const release = os.release();
const isWin = /^win\d+$/.test(process.platform);
const isWin8 = isWin && /^6\.[23456789]\./.test(release);
const isWin10 = isWin && !isWin8 && /^10\./.test(release);
const isWin10or8 = isWin10 || isWin8;

var changedAccentColor: boolean;
const stylesPath = path.resolve(__dirname, "../styles");
const inputVariables = fs.readFileSync(path.resolve(stylesPath, "ui-variables.less.input"), "utf-8");
const variablesFile = path.resolve(stylesPath, "ui-variables.less");
var currentAccent: string = _atom.config.get('win10-ui.themeAccentColor');
const ACCENT_VALUE = isWin10 ? 'AccentColorMenu' : 'AccentColor';
const WINDOWS_ACCENT_KEY_REG = isWin10or8 ? new registry({
  hive: registry.HKCU,
  key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent'
}) : undefined;
/*const setDarkColors = function() {
  _atom.config.set("win10-ui.themeBackgroundColor", "#35373b");
  _atom.config.set("win10-ui.themeForegroundColor", "#e8e8e8");
}
const setLightColors = function() {
  _atom.config.set("win10-ui.themeBackgroundColor", "#e0e0e0");
  _atom.config.set("win10-ui.themeForegroundColor", "#0a0a0a");
}*/
const isDark = function(color: string) {
  const R = parseInt(color.substring(1, 3), 16);
  const G = parseInt(color.substring(3, 5), 16);
  const B = parseInt(color.substring(5, 7), 16);

  return (5 * G + 2 * R + B) <= 8 * 128;
}
/*const setDynamicColors = function(invert?: boolean) {
  var can = isDark(_atom.config.get('win10-ui.themeAccentColor').toHexString());
  if(invert)
    can = !can;
  if(can)
    setDarkColors();
  else
    setLightColors();
}*/
const writeConfig = function() {
  const accentColor = _atom.config.get('win10-ui.themeAccentColor').toHexString();
  //const backgroundColor = _atom.config.get('win10-ui.themeBackgroundColor').toHexString();
  const accentColorDark = isDark(accentColor);
  const config = `@font-size: ${_atom.config.get('win10-ui.fontSize')}px;\n` +
    `@accent-color: ${accentColor};\n` +
    `@accent-color-is-dark: ${accentColorDark ? 1 : 0};\n` +
    /*`@base-background-color: ${backgroundColor};\n` +
    `@background-color-dark: ${isDark(backgroundColor) ? 100 : 0}%;\n\n` +
    `@text-color: ${_atom.config.get('win10-ui.themeForegroundColor').toHexString()};\n` +*/
    `@text-color-accent:  ${accentColorDark ? "lighten(@text-color, 40%)" : "darken(@text-color, 40%)"};\n` +
    `@text-color-accent-contrast:  ${accentColorDark ? "white" : "black"};`;
  fs.writeFile(variablesFile, inputVariables.replace(/{{config}}/, config), function(err) {
    if(err)
      console.error(err.stack);
    else
      for (const theme of _atom.themes.getActiveThemes()) {
        theme.reloadStylesheets();
      }
  });
}
const updateAccent = function() {
  return WINDOWS_ACCENT_KEY_REG.get(ACCENT_VALUE, function(error, item) {
    if (error)
      throw new Error("Issue with windows registry lookup: " + error);

    const abgr = item.value;
    const color = "#" + abgr.substring(8, 10) + abgr.substring(6, 8) + abgr.substring(4, 6);
    if (currentAccent === color)
      return;
    currentAccent = color;
    changedAccentColor = true;
    _atom.config.set('win10-ui.themeAccentColor', color);
    setTimeout(function() {
      changedAccentColor = false;
    }, 250);
  });
}
const reset = function() {
  try{clearInterval(updateInterval)}catch(e){}
  compositeDisposable.dispose();
  currentAccent = undefined;
};
var presetChanged: boolean;
const updatePresetAndWriteConfig = function() {
  if(!changedAccentColor)
    _atom.config.set(`win10-ui.preset`, "Custom");
  writeConfig();
}

var updateInterval: number;
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
    }
  },
  activate: function(state) {
    compositeDisposable = new atom.CompositeDisposable;
    /*compositeDisposable.add(_atom.config.onDidChange(`win10-ui.preset`, function(preset) {
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
    compositeDisposable.add(_atom.config.onDidChange(`win10-ui.fontSize`, writeConfig));
    //compositeDisposable.add(_atom.config.onDidChange(`win10-ui.themeForegroundColor`, updatePresetAndWriteConfig));
    //compositeDisposable.add(_atom.config.onDidChange(`win10-ui.themeBackgroundColor`, updatePresetAndWriteConfig));
    compositeDisposable.add(_atom.config.onDidChange(`win10-ui.useSystemAccentColor`, function(data) {
      try{clearInterval(updateInterval)}catch(e){}
      if (isWin10or8 && data.newValue) {
        updateInterval = setInterval(updateAccent, 1500);
        console.log("Started updateAccent interval");
        updateAccent();
      } else
        console.log("Stopped updateAccent interval");
    }));
    compositeDisposable.add(_atom.config.onDidChange(`win10-ui.themeAccentColor`, function() {
      if(!changedAccentColor)
        _atom.config.set(`win10-ui.useSystemAccentColor`, false);
      writeConfig();
    }));
    if (isWin10or8 && _atom.config.get("win10-ui.useSystemAccentColor")) {
      try{clearInterval(updateInterval)}catch(e){}
      updateInterval = setInterval(updateAccent, 1500);
      console.log("Started updateAccent interval");
      currentAccent = undefined;
      updateAccent();
    }
  },
  deactivate: reset,
  destroy: reset
};
export = win10;
