'use strict';
const {sleep, sleepSync} = require('bun');
const [log, error] = [console.log, console.error];
const channel = process.stdout, input = process.stdin;
const assert = (o,m="Object not valid.") => {
	if (typeof o === 'undefined' || o === undefined || o === null || o === false)
		throw m;
};
if (!channel.isTTY || !input.isTTY)
{
	console.error("STDOUT/STDIN is not a TTY; flow.js is disabled.");
	class err {
		constructor() { throw new Error("Cannot create a UI, current environment does not have a TTY."); }
	}
	module.exports = {
		UI: {
			Control: err,
			Page: err,
			Label: err
		}, assert
	};
	return;
}
//var cc = [];
//if (process.stderr.isTTY) // redirect error when a screen is active
const
	res = () => {
		channel._refreshSize(); // this stupid crap was giving me a headache, after feeling so happy at line 135
		return [channel.columns, channel.rows];
	}, w = (...a) => channel.write(...a),// cursor_pos = () => cc,
	private_control = (c,b) => (ctrl+"?"+String(c)+(b===true?'h':'l')),
	buffer_control = 1049, cursor_control = 25, curpos = /^\x1b\[([0-9]+);([0-9]+)R$/,
	ctrl = '\x1b[', privctrl = (...a) => w(private_control(...a)),
	ctrlcap = /\x1b(\[(\d+;\d+[Hf]|\d+[A-GJK]|[HJKsu]|6n|\d+(;\d+)*m|\?\d+[lh])|[N78])/g,
	set_buffer = (b) => privctrl(buffer_control,b), set_cursor = (b) => privctrl(cursor_control,b),
	[M_UP,M_DOWN,M_RIGHT,M_LEFT] = [0,1,2,3], key_names = ["up","down","right","left"],
	normal_refresh_rate = 50, inc = i=>(i+1), jump = (y,x) => (ctrl+[x,y].map(Math.floor).map(inc).join(';')+'H');
var UIStack = []; // active UI pages from back to front
// TODO: add WINAPI inputrecord stuff
function activateFlow(flow) {
	var interrupt = false;
	input.setRawMode(true);
	input.resume();
	input.removeAllListeners('data');
	// use to control stuff from console window
	input.on('data', k => {
		var trigger = null;
		switch (k.length)
		{
			case 1:
				switch (k[0]) // * can this be condensed
				{
					case 3:
						interrupt = true;
						break;
					default:
						if (k[0] >= 0x20 && k[0] < 0x7F) // typeable character
						{
							//console.log(k[0]);
						}
						break;
				}
				break;
			case 3:
				switch (k[0]) // *
				{
					case 0x1b:
						switch (k[1])
						{
							case 0x5b:
								switch (k[2])
								{
									case 0x41:
									case 0x42:
									case 0x43:
									case 0x44:
										trigger = k[2] - 0x41;
										break;
									default:
										log(k);
										return;
								}
						}
						break;
					default:
						log(k);
						break;
				}
				break;
			default:
				/*switch (k[0]) // disruptive to Ctrl-C
				{
					case 0x1b:
						var i = k.toString();
						if (curpos.test(i))
						{
							cc = curpos.exec(i).slice(1,3).map(Number).map(i=>i-1);
							return;
						}
						break;
				}*/
				log(k);
				break;
		}
		//if (trigger !== null)
		{
			process.title = "pressed: "+k.toString('hex')+(trigger !== null ? (", trigger: "+[trigger]) : "");
		}
	});
	var loop = (async function(_this) { // should probably make a class for async functions i can stop
		var new_screen = ctrl+'2J';
		var buf = private_control(buffer_control,true)+private_control(cursor_control,true)+new_screen;
		global.VBlank = true;
		while (!interrupt) {
			if (!global.VBlank)
			{
				await sleep(5);
				continue;
			}
			global.VBlank = false;
			//set_cursor(false);
			var cat = _this.refresh();
			if (typeof cat === 'string')
				buf += cat;
			var [wx,wy] = res();
			_this.items.forEach((i,n)=>{
				if (i.x > wx || i.y > wy)
					return;
				buf+=jump(...i.pos)+i.draw(i,_this);
			});
			if (_this.cursor)
				buf += jump(_this.cursor_pos[0], _this.cursor_pos[1])+private_control(cursor_control,true);
			w(buf); buf=new_screen;
			// shouldn't rely on 2J and redrawing everything directly,
			// but this buffer building is working pretty fluidly without flicker :D
			//set_cursor(_this.cursor);
		}
		set_buffer(false);
		set_cursor(true);
		//popFlow();
	})(flow);
	return {
		timer: (async function(_this) {
			while (true)
			{
				await sleep(_this.interval ?? normal_refresh_rate);
				global.VBlank = true;
				if (interrupt)
					break;
			}
		})(flow), loop, flow
	};
}
function pushFlow(flow) {
	if (!flow.hasOwnProperty('items') || !flow.persistent)
	{
		flow.items = [...flow.base_layout];
		flow.cursor_pos = flow.cursor_start;
	}
	flow.create();
	input.pause();
	var last_page = UIStack.length - 1;
	if (last_page > -1)
	{
		var lp = UIStack[last_page];
		lp.destroy();
		if (replace === true)
			flow.from = UIStack.pop();
	}
			//if (last_page !== ui.current_page)
			//{
			//	if (last_page !== null)
			//		ui.pages[last_page].destroy();
			//	ui.pages[last_page = ui.current_page].create();
			//}
			//var page = ui.pages[last_page];
	UIStack.push(flow);
	return activateFlow(flow);
}
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
		var display_text = text.replace(ctrlcap, ''); // should only contain colors in this stuff
		var max_width = display_text.split(/[\r\n]/g).sort((a,b)=>a.length-b.length).slice(-1)[0].length;
		var [w,h] = res();
		var y = this.y;
		text = text.
			replace(new RegExp('^(.{0,'+(w-this.x)+'}).*$','gmi'), '$1').
			replace(/\r?\n/g, ()=>jump(this.x,++y));
		return text;
	}
	get type() { return UI_LABEL; }
}
class Page {
	constructor(
		layout=[],
		create=(function(){
			
		}),
		destroy=(function(){
			
		}),
		refresh=(function(){
			
		}),
		object={}, // shared thread data type thing
		persistent=false, // GM8.1 moment
		cursor=false
	) {
		this.base_layout = layout ?? [];
		[
			[Array.isArray(this.base_layout), "Layout argument is not an array"],
			[typeof create === 'function', "Create argument is not a function"],
			[typeof destroy === 'function', "Destroy argument is not a function"],
			[typeof refresh === 'function', "Destroy argument is not a function"],
		].forEach((a)=>assert(...a));
		this.create = create;
		this.destroy = destroy;
		this.refresh = refresh;
		this._cursor = cursor;
		this.object = object;
		this.persistent = persistent;
		this.interval = normal_refresh_rate;
		this.cursor_start = [0, 0];
		this.cursor_pos = this.cursor_start;
	}
	get cursor() { return this._cursor === true; }
	set cursor(b) {
		this._cursor = b === true;
	}
	present(replace) {
		return pushFlow(this);
	}
	find(id) {
		for (var i = 0; i < this.items.length; i++)
		{
			if (this.items[i].hasOwnProperty('id') &&
				this.items[i].id === id)
				return this.items[i];
		}
		return null;
	}
}
module.exports = {
	UI: {
		UI_BASE, UI_LABEL,
		Control, Label, Page,
		res
	}, assert
};



/*
if (false)
{
	const ui = { // yanked out of xrpt that had basic text draw buffer building and the vblank timer
		pages: { // going neversoft style here
			main: {
				create: function() {
				},
				destroy: function() {
				},
				refresh: function() {
					var mybuf = "";
					return mybuf;
				},
				elements: [
					{
						type: UI_LABEL,
						pos: [ 4, 4 ],
						//dims: [ 10, 1 ],
						data: {
							align: Label.UI_LEFT,
							text: "test"
						}
					}
				]
			}
		},
		current_page: 'main'
	};
	// test isTTY: bun -e "console.log(process.stdout);" 1>nul 2>E:\tty_testtt.txt 1>&2
	// for subinterfaces controlled with arrows

	//process.on("exit", input.close); // wtf is "this.destroy()"
	process.on("exit", () => set_buffer(false));
	process.on("exit", () => set_cursor(true));
	process.exit();
}
*/
