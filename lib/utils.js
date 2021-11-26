'use strict';

const common = require('./common');
const fs = require('bfile');
const Config = require('bcfg');

const utils = exports;

utils.ensure = async () => {
  await utils.ensurePackages();
  await utils.ensurePackageInfo();
};

utils.ensurePackageInfo = async () => {
  const exists = await fs.exists(common.PACKAGE_INFO);

  if (!exists) {
    await fs.writeJSON(common.PACKAGE_INFO, {
      version: common.PACKAGE_INFO_VERSION
    });
  } else {
    const json = await fs.readJSON(common.PACKAGE_INFO);

    // why did I even write this part.
    if (json.version != common.PACKAGE_INFO_VERSION)
      throw new Error('how did we get here, upgrade..');
  }
};

utils.ensurePackages = async () => {
  const exists = await fs.exists(common.PACKAGES);

  if (!exists)
    await fs.mkdir(common.PACKAGES);

  const stats = await fs.stats(common.PACKAGES);

  if (!stats.isDirectory())
    throw new Error(`${common.PACKAGES} is a file not a dir.`);
};

utils.isHSPackage = async (repository) => {
  return common.REPO_REGEX.test(repository);
};

utils.getConfigs = (options, configs) => {
  const cfg = new Config('hs-packages', configs);

  if (options) {
    cfg.inject(options);
    cfg.load(options);
  }

  if (options && options.file) {
    const json = JSON.parse(fs.readFileSync(options.file).toString());
    cfg.inject(json);
  }

  return cfg;
};
