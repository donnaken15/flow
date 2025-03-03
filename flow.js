'use strict';
const {sleep, sleepSync} = require('bun');
const [log, error] = [console.log, console.error];
const channel = process.stdout, input = process.stdin;
const assert = (o,m="Object not valid.") => {
	if (typeof o === 'undefined' || o === undefined || o === null || o === false)
		throw m;
};
class err {
	constructor() { throw new Error("Cannot create a UI, current environment does not have a TTY."); }
}
var failExport = {
	UI: {
		Control: err, Page: err, Label: err
	}
};
var defaultExports = { assert };
var canDraw = Bun.env.NO_COLOR!=1;
if (!canDraw)
{
	console.error("NO_COLOR == 1; flow.js is disabled.");
	module.exports = { ...failExport, ...defaultExports, canDraw };
	return;
}
canDraw = channel.isTTY && input.isTTY;
if (!canDraw)
{
	console.error("STDOUT/STDIN is not a TTY; flow.js is disabled.");
	module.exports = { ...failExport, ...defaultExports, canDraw };
	return;
}
//var cc = [];
//if (process.stderr.isTTY) // redirect error when a screen is active
const
	res = () => {
		channel._refreshSize(); // this stupid crap was giving me a headache, after feeling so happy at line 173
		return [channel.columns, channel.rows];
	}, w = (...a) => channel.write(...a),// cursor_pos = () => cc,
	private_control = (c,b) => (ctrl+"?"+String(c)+(b===true?'h':'l')),
	buffer_control = 1049, cursor_control = 25, curpos = /^\x1b\[([0-9]+);([0-9]+)R$/,
	ctrl = '\x1b[', privctrl = (...a) => w(private_control(...a)),
	ctrlcap = /\x1b(\[(\d+;\d+[Hf]|\d+[A-GJK]|[HJKsu]|6n|\d+(;\d+)*m|\?\d+[lh])|[N78])/g,
	set_buffer = (b) => privctrl(buffer_control,b), set_cursor = (b) => privctrl(cursor_control,b),
	[M_UP,M_DOWN,M_RIGHT,M_LEFT] = [0,1,2,3], key_names = ["up","down","right","left"],
	normal_refresh_rate = 50, inc = i=>(i+1), jump = (y,x) => (ctrl+[x,y].map(Math.floor).map(inc).join(';')+'H');
	// should implement a class where coloring or formatting is specified in an alternate way that doesn't
	// rely on stuffing escape codes in strings, since it still looks kind of ugly,
	// and instead strings are broken up with format codes in between ***
var UIStack = []; // active UI pages from back to front
function createLock()
{
	var s,j;
	return {promise:new Promise((res,rej)=>{s=res,j=rej;}),resolve:s,reject:j};
}
function coverage(str,pat,cap=0)
{
	var l = 0;
	var m;
	var once = !pat.global;
	while ((m = pat.exec(str)) !== null && (pat.global || once)) {
		l += m[cap].length;
		once = false;
	}
	return l;
}
// TODO: add WINAPI inputrecord stuff
function activateFlow(flow) {
	var internal = {interrupt: false};
	input.setRawMode(true);
	input.resume();
	input.removeAllListeners('data');
	// use to control stuff from console window
	// and add readline routine thing
	input.on('data', k => {
		var trigger = null;
		switch (k.length)
		{
			case 1:
				switch (k[0]) // * can this be condensed
				{
					case 3:
						internal.interrupt = true;
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
	var looplock = createLock(), busylock = createLock();
	var control = {next: looplock.promise, busy: busylock.promise};
	var loop = (async(_this) => { // should probably make a class for async functions i can stop
		var new_screen = ctrl+'2J';
		var buf = private_control(buffer_control,true)+private_control(cursor_control,true)+new_screen;
		global.VBlank = true;
		var firsttick = true;
		while (!internal.interrupt) {
			if (!global.VBlank)
			{
				// put event listening here
				await sleep(5);
				continue;
			}
			global.VBlank = false;
			if (!firsttick)
			{
				busylock = createLock();
				control.busy = busylock.promise;
				looplock.resolve(); // finish await next
			}
			//set_cursor(false);
			var cat = _this.refresh(); // ***
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
			busylock.resolve();
			looplock = createLock();
			control.next = looplock.promise;
			if (firsttick)
				firsttick = false;
		}
		_this._control = null;
		looplock.resolve(); // reject throwing discourages me from using it kind of
		set_buffer(false);
		set_cursor(true);
		//popFlow();
	})(flow), timer = (async(_this) => {
		while (true)
		{
			await sleep(_this.interval ?? normal_refresh_rate);
			global.VBlank = true;
			if (internal.interrupt)
			{
				// should put a reject here, don't know what for yet
				break;
			}
		}
	})(flow);
	Object.assign(control, {loop, flow, timer, end: async() => {
		internal.interrupt=true; return await loop;
	}});
	return control;
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
			replace(new RegExp('^(.*)$','gmi'), (line)=>{
				//if (x++ >= lines_allowed)
				//	return '';
				// brain damage
				var rc = 0;
				var i = 0;
				var text = '';
				var gotctrl = false; // should rely on a condition using other variables instead
				var overflowed = false;
				var parse = new RegExp(ctrlcap.source, ctrlcap.flags + (ctrlcap.global ? '' : 'g'));
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
		this.interval = normal_refresh_rate; // tfw not room_speed
		this.cursor_start = [0, 0];
		this.cursor_pos = this.cursor_start;
		this._control = null;
	}
	get active() { return this._control !== null; }
	get cursor() { return this._cursor === true; }
	set cursor(b) {
		this._cursor = b === true;
	}
	present(replace) {
		return this._control = pushFlow(this);
	}
	async exit() {
		if (this.active)
		{
			await _control.end();
			console.log(2);
		}
	}
	find(id) {
		for (var i = 0; i < this.items.length; i++)
		{
			if (this.items[i].hasOwnProperty('id') && this.items[i].id === id)
				return this.items[i];
		}
		return null;
	}
	execute(name, ...args) {
		if (typeof this[name] === 'function')
			return this[name](...args);
	}
}
module.exports = {
	UI: {
		UI_BASE, UI_LABEL,
		Control, Label, Page,
		res
	}, ...defaultExports, canDraw
};

