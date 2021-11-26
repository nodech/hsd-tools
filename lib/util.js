'use strict';

const nodeUtil = require('util');
const readline = require('readline');
const common = require('./common');
const fs = require('bfile');
const Config = require('bcfg');
const Logger = require('blgr');

const util = exports;

util.isHSPackage = async (repository) => {
  return common.REPO_REGEX.test(repository);
};

util.getConfigs = (options, configs) => {
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

util.getLogger = (config) => {
  const logger = new Logger();
  const level = config.str('level', 'info');
  const logConsole = config.str('console', true);

  logger.set({
    level: level,
    console: logConsole,
    filename: null
  });

  return logger;
};

util.question = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const rlQuestion = nodeUtil.promisify(rl.question).bind(rl);
  const answer = await rlQuestion(question);

  rl.close();
  return answer;
};
