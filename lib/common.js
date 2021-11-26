'use strict';

const os = require('os');
const path = require('path');
const common = exports;

common.HOME = os.homedir ? os.homedir() : '/';

common.LIB = path.dirname(__filename);
common.ROOT = path.join(common.LIB, '..');
common.PACKAGES = path.join(common.ROOT, 'packages');
common.PACKAGES_LOCK = path.join(common.ROOT, '.LOCK');

common.PACKAGE_INFO = path.join(common.ROOT, 'package-info.json');
common.PACKAGE_INFO_VERSION = 0;

common.REPO_REGEX = 
  /^https:\/\/github.com\/(bcoin-org|handshake-org|chjj)\/(.*)(\.git)?$/i
