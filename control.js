'use strict';
if (!require('./common.js').canDraw)
	return;
const {assert, concat_regex} = require('./common.js');

const UI_BASE = 0;
const UI_LABEL = 1;
class Control {
	constructor(x=4,y=4,data={},draw,id) {
		this.x = x; this.y = y;
		this.data = data;
		if (draw !== undefined)
			this.draw = draw;
		if (id !== undefined)
			this.id = id;
	}
	draw() {
		
	}
	get pos() { return [this.x, this.y]; }
	set pos(v) {
		assert(
			Array.isArray(v) && v.length === 2 && isNaN(v[0]) && isNaN(v[1]),
			'Invalid assignment. [x,y] = '+JSON.stringify(v));
		this.x = v[0]; this.y = v[1];
	}
	get type() { return UI_BASE; }
}
class Label extends Control {
	static UI_LEFT = 0;
	static UI_MIDDLE = 1;
	static UI_RIGHT = 2;
	draw() {
		var text = this.data.text;
		var [w,h] = res();
		var y = this.y;
		var lines_allowed = h-y;
		var cutoff = text.length;
		{
			var nl = /\r?\n/g;
			var j = 0;
			var i = 0;
			var test;
			for (; i < lines_allowed; i++)
			{
				if ((test = nl.exec(text+'\n'/*why*/)) !== null)
					j = test.index;
				else
					break;
			}
			if (test !== null) // too short to cut off
				cutoff = j;
		}
		//var x = 0;
		text = text.substring(0,j).
			replace(/^.+$/gmi, line=>{
				//if (x++ >= lines_allowed)
				//	return '';
				// brain damage
				var rc = 0;
				var i = 0;
				var text = '';
				var gotctrl = false; // should rely on a condition using other variables instead
				var overflowed = false;
				var parse = concat_regex(ctrlcap);
				while (true)
				{
					var cap = parse.exec(line);
					if (cap !== null)
					{
						gotctrl = true;
						var between = line.substring(i, cap.index);
						var overflow = ((w-this.x)-(rc+between.length));
						if (overflow <= 0) {
							overflowed = true;
							text += line.substring(i, cap.index + overflow);
						}
						if (!overflowed) {
							text += between;
							rc += between.length;
							i += cap.index + cap[0].length; // after end of capture
						}
						text += cap[0];
					}
					else
					{
						if (!gotctrl)
						{
							var end = line.substring(i);
							var overflow = ((w-this.x)-(end.length));
							if (overflow < 0)
								end = end.slice(0, overflow);
							text += end;
						}
						else
						{
							if (!overflowed)
								text += line.substring(i);
						}
						break;
					}
					// handle jumps as new lines
				}
				return text;
			}).
			replace(/\r?\n/g, ()=>jump(this.x,++y))+ctrl+'0m';
		return text;
	}
	get type() { return UI_LABEL; }
}
module.exports = {
	UI_BASE, UI_LABEL,
	Control, Label
};
