/*!
 * colors.js - colors make it pretty.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */
'use strict';

const ansi = require('./ansi');

const colors = exports;

const COLORS = {
  RED: 31,
  GREEN: 32,
  YELLOW: 33
};

colors.wrapColor = (color, text) => {
  if (!process.stdout.isTTY)
    return text;

  return `${ansi.ESC}[${color}m${text}${ansi.ESC}[0m`;
};

colors.redText = text => colors.wrapColor(COLORS.RED, text);
colors.greenText = text => colors.wrapColor(COLORS.GREEN, text);
