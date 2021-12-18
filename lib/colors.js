/*!
 * colors.js - colors make it pretty.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */
'use strict';

const colors = exports;

const COLORS = {
  RED: 31,
  GREEN: 32
};

const COLORS_CLOSE = 39;
const E = '\u001b';

colors.wrapColor = (color, text) => {
  if (!process.stdout.isTTY)
    return text;

  return `${E}[${color}m${text}${E}[0m`;
};

colors.redText = text => colors.wrapColor(COLORS.RED, text);
colors.greenText = text => colors.wrapColor(COLORS.GREEN, text);
