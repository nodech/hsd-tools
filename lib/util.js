/*!
 * util.js - other utils.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const assert = require('assert');
const nodeUtil = require('util');
const readline = require('readline');
const fs = require('bfile');
const Config = require('bcfg');
const Logger = require('blgr');
const git = require('./git');
const npm = require('./npm');

const util = exports;

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
  const level = config.str('level', 'none');
  const logConsole = config.str('console', true);

  logger.set({
    level: level,
    console: logConsole,
    filename: null
  });

  return logger;
};

/**
 * Ask question to the terminal
 * @param {String} question - question to show.
 * @returns {String} return answer.
 */

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

/**
 * Get package name.
 * @param {String} str - url or pkg name
 * @returns {String}
 */

util.getPackageName = function getPackageName(str) {
  if (npm.isNpmPackage(str))
    return str;

  if (git.isGitUrl(str))
    return git.getPKGName(str);

  return null;
};
