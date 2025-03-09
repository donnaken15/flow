'use strict';
if (!require('./common.js').canDraw)
	return;
const {sleep} = require('bun');
require('./dropper.js')('./common.js');

var UIStack = []; // active UI pages from back to front
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
		var buf = private_control(buffer_control,true)+private_control(cursor_control,_this.cursor)+new_screen;
		global.VBlank = true;
		var firsttick = true;
		var profile_draw_last = 0;
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
			var profile_null = Bun.nanoseconds();
			profile_null = (Bun.nanoseconds() - profile_null);
			var profile_all = Bun.nanoseconds();
			var profile_refresh = Bun.nanoseconds(); // TODO: lag/missed ticks counter and class for storing profiling data
			//set_cursor(false);
			var cat = _this.refresh(); // ***
			if (typeof cat === 'string')
				buf += cat;
			profile_refresh = (Bun.nanoseconds() - profile_refresh);
			var profile_res = Bun.nanoseconds();
			var [wx,wy] = res();
			profile_res = (Bun.nanoseconds() - profile_res);
			var profile_items = Bun.nanoseconds();
			_this.items.forEach((i,n)=>{
				if (i.x >= wx || i.y >= wy)
					return;
				buf+=jump(...i.pos)+i.draw(i,_this);
			});
			profile_items = (Bun.nanoseconds() - profile_items);
			if (_this.cursor)
			{
				channel.moveCursor(..._this.cursor_pos);
				//buf += /*jump(_this.cursor_pos[0], _this.cursor_pos[1])+*/private_control(cursor_control,true);
			}
			profile_all = (Bun.nanoseconds() - profile_all);
			var bufsize;
			buf += jump(0,0)+
				ctrl+'92mthis frame\'s byte size: '+(bufsize = buf.length)+'\n'+
				ctrl+'95mtotal bytes written before latest frame: '+channel.bytesWritten+'\n'+
				([
					['last draw', profile_draw_last],
					['refresh', profile_refresh],
					['res', profile_res],
					['items', profile_items],
					['all', profile_all],
					['overhead', profile_all-profile_refresh-profile_res-profile_items],
					['fps', _this.interval*1000000],
					['nop', profile_null],
				]).map(i=>(ctrl+'36m'+i[0].padEnd(10)+': '+ctrl+'1m'+((i[1]/1000000).toFixed(6)+'ms').padStart(10+2))+ctrl+'22m').join('\n')
			;
			profile_draw_last = Bun.nanoseconds(); w(buf+'\n'+ctrl+'93mdebug overhead: ~'+(buf.length-bufsize+11+3)+'\x1b[0m');
			profile_draw_last = (Bun.nanoseconds() - profile_draw_last); buf = new_screen;
			// shouldn't rely on 2J and redrawing everything directly,
			// but this buffer building is working pretty fluidly without flicker :D
			// thinking it over, should replace with clear line for lines that actually change
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
class Page {
	constructor(
		layout=[], // should(?) change to using an object for parameters just to avoid blank positional arguments
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
	UIStack, activateFlow, pushFlow, Page
};

