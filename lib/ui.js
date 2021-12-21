/*!
 * ui.js - terminal render.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const ansi = require('./ansi');
const colors = require('./colors');
const {STATUS} = require('./common')
const {RUNNING, DONE} = STATUS;

// const TICK = '✔';
// const CROSS = '✖';
const LOZENGE = '◆';
const LOZENGE_OUTLINE = '◇';

// const loading = ['|', '/', '-', '\\'];
const loading = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏'
];

class UIRenderer {
  constructor(out) {
    this.lines = 0;
    this.frame = 0;
    this.out = out;
  }

  loading() {
    return `${loading[this.frame % loading.length]}`;
  }

  prefix(status) {
    if (status === RUNNING)
      return colors.yellowText(this.loading());

    if (status === DONE)
      return colors.greenText(LOZENGE);

    return LOZENGE_OUTLINE;
  }

  draw(tasks) {
    this.clearLines();
    this.hideCursor();

    const output = [];
    for (const task of tasks.values()) {
      const prefix = this.prefix(task.status);
      const done = `(${task.done}/${task.steps.size})`;

      output.push(`  ${prefix} ${done} ${task.name}`);

      if (task.status === DONE)
        continue;

      for (const [step, sstatus] of task.steps.entries()) {
        const prefix = this.prefix(sstatus);

        output.push(`    ${prefix} ${step} - ${sstatus}`);
      }
    }
    this.frame++;
    this.lines = output.length;
    this.out.write(output.join('\n') + '\n');

    this.showCursor();
  }

  hideCursor() {
    this.out.write(ansi.cursor.hide);
  }

  showCursor() {
    this.out.write(ansi.cursor.show);
  }

  clearLines() {
    if (this.lines === 0)
      return;

    const clears = [];
    for (let i = 0; i < this.lines; i++) {
      clears.push(ansi.cursor.up(1)
        + ansi.erase.line
        + ansi.cursor.sol
      );
    }

    this.out.write(clears.join(''));
  }
}

exports.UIRenderer = UIRenderer;
