'use strict';

const os = require('os');
const path = require('path');
const common = exports;

common.HOME = os.homedir ? os.homedir() : '/';

// default locations
common.ROOT = path.join(common.HOME, '.hs-tools');
common.PROJECT = path.join(common.ROOT, 'default');
common.PACKAGES = path.join(common.PROJECT, 'packages');
common.PACKAGES_LOCK = path.join(common.PROJECT, '.LOCK');

common.PACKAGE_INFO = path.join(common.PROJECT, 'packages-info.json');
common.PACKAGE_INFO_VERSION = 0;
