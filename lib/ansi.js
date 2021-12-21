/*!
 * ansi.js - test command.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const ansi = exports;

ansi.ESC = '\u001b[';

// ESC [
ansi.CSI = '\u009b';

// ESC P
ansi.DCS = '\u0090';

// ESC ]
ansi.OSC = '\u009d';

ansi.cursor = {
  up: n => `${ansi.ESC}${n}A`,
  down: n => `${ansi.ESC}${n}B`,
  right: n => `${ansi.ESC}${n}C`,
  left: n => `${ansi.ESC}${n}D`,
  hide: `${ansi.ESC}?25l`,
  show: `${ansi.ESC}?25h`,
  sol: '\r'
};

ansi.erase = {
  line: `${ansi.ESC}2K`,
  eol: `${ansi.ESC}0K`,
  up: `${ansi.ESC}1J`,
  screen: `${ansi.ESC}2J`
};
