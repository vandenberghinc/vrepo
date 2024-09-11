/*
 * Author: Daan van den Bergh
 * Copyright: © 2024 - 2024 Daan van den Bergh.
 */

// ---------------------------------------------------------
// Imports.

let vlib;
if (process.env.PERSISTANCE && require("fs").existsSync(process.env.PERSISTANCE)) {
    vlib = require(`${process.env.PERSISTANCE}/private/dev/vinc/vlib/js/vlib.js`)
} else {
	vlib = require("@vandenberghinc/vlib");
}

// ---------------------------------------------------------
// Exports.

module.exports = {
	vlib,
};