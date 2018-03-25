"use strict";
var _atom = global.atom;
var registry = require('winreg');
var atom = require("atom");
var fs = require('fs');
var os = require("os");
var release = os.release();
var isWin = /^win\d+$/.test(process.platform);
var isWin8 = isWin && /^6\.[23456789]\./.test(release);
var isWin10 = isWin && !isWin8 && /^10\./.test(release);
var isWin10or8 = isWin10 || isWin8;
var configPath = __dirname + "/../styles/ui-config.less";
var currentAccent;
var ACCENT_VALUE = isWin10 ? 'AccentColorMenu' : 'AccentColor';
var WINDOWS_ACCENT_KEY_REG = isWin10or8 ? new registry({
    hive: registry.HKCU,
    key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent'
}) : undefined;
var writeConfig = function () {
    fs.writeFile(configPath, "@theme-font-size: " + win10.get('fontSize') + "px;\r\n@theme-accent-color: " + win10.get('themeAccentColor').toHexString() + ";", function (err) {
        if (err)
            console.error(err.stack);
        else
            for (var _i = 0, _a = _atom.themes.getActiveThemes(); _i < _a.length; _i++) {
                var theme = _a[_i];
                if (theme.getType() === "theme" && theme.getStylesheetPaths().length)
                    theme.reloadStylesheets();
            }
    });
};
var updateAccent = function (writeConfigOnFail) {
    return WINDOWS_ACCENT_KEY_REG.get(ACCENT_VALUE, function (error, item) {
        if (error) {
            if (writeConfigOnFail)
                writeConfig();
            throw new Error("Issue with windows registry lookup: " + error);
        }
        var abgr = item.value;
        var color = "#" + abgr.substring(8, 10) + abgr.substring(6, 8) + abgr.substring(4, 6);
        if (currentAccent === color)
            return;
        return win10.set('themeAccentColor', color);
    });
};
var reset = function () {
    try {
        clearInterval(updateInterval);
    }
    catch (e) { }
    compositeDisposable.dispose();
    currentAccent = undefined;
};
var updateInterval;
var compositeDisposable;
var win10 = {
    config: {
        themeAccentColor: {
            order: 1,
            type: 'color',
            "default": '#0078D7'
        },
        useSystemAccentColor: {
            order: 2,
            type: 'boolean',
            description: 'Theme accent color will automatically be determined based on your operating system (Windows 8 or 10 required)',
            disabled: !isWin10or8,
            "default": isWin10or8
        },
        fontSize: {
            order: 3,
            description: 'Change the UI font size. (Between 10 and 20)',
            type: 'integer',
            minimum: 10,
            maximum: 20,
            "default": 12
        }
    },
    // Configuration helpers
    get: function (key) {
        return _atom.config.get("win10-ui." + key);
    },
    set: function (key, value) {
        return _atom.config.set("win10-ui." + key, value);
    },
    activate: function (state) {
        compositeDisposable = new atom.CompositeDisposable;
        compositeDisposable.add(_atom.config.onDidChange("win10-ui.fontSize", writeConfig));
        compositeDisposable.add(_atom.config.onDidChange("win10-ui.useSystemAccentColor", function (data) {
            try {
                clearInterval(updateInterval);
            }
            catch (e) { }
            if (isWin10or8 && data.newValue)
                updateInterval = setInterval(updateAccent, 5000);
        }));
        compositeDisposable.add(_atom.config.onDidChange("win10-ui.themeAccentColor", writeConfig));
        if (isWin10or8 && win10.get("useSystemAccentColor")) {
            try {
                clearInterval(updateInterval);
            }
            catch (e) { }
            updateInterval = setInterval(updateAccent, 5000);
            currentAccent = undefined;
            updateAccent(true);
        }
        else
            writeConfig();
    },
    deactivate: reset,
    destroy: reset
};
module.exports = win10;
//# sourceMappingURL=main.js.map