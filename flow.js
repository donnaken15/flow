'use strict';
const dropAll = require('./dropper.js');
dropAll('./common.js');
if (!canDraw)
	return;
dropAll('./control.js');
dropAll('./screen.js');
module.exports = {
	UI: {
		UI_BASE, UI_LABEL,
		Control, Label, Page,
		res
	}, ...defaultExports, canDraw
};

