/*!
 * ui.js - terminal render.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const ansi = require('./ansi');
const {STATUS} = require('./common')
const {RUNNING, DONE} = STATUS;

const loading = ['|', '/', '-', '\\'];

class UIRenderer {
  constructor(out) {
    this.lines = 0;
    this.counter = 0;
    this.out = out;
  }

  draw(tasks) {
    this.clearLines();
    this.hideCursor();

    const output = [];
    for (const task of tasks.values()) {
      let prefix = '';

      if (task.status === RUNNING)
        prefix = `${loading[this.counter % loading.length]}`;

      const done = `(${task.done}/${task.steps.size})`;

      output.push(`${prefix} ${task.name} ${done}`);

      for (const [step, sstatus] of task.steps.entries()) {
        let prefix = '';

        if (sstatus === RUNNING)
          prefix = `${loading[this.counter % loading.length]}`;

        output.push(`  ${prefix} ${step} - ${sstatus}`);
      }
    }
    this.counter++;
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
