const path = require('path');

function getIconPath(app, dirname) {
  if (process.platform === 'linux') {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'app-2.png')
      : path.join(dirname, 'icons', 'app-2.png');
  }
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'app.ico')
    : path.join(dirname, 'icons', 'app.ico');
}

module.exports = { getIconPath };
