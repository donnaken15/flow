'use strict';
class err {
	constructor() { throw new Error("Cannot create a UI, current environment does not have a TTY."); }
}
const ctrl = '\x1b[', privctrl = (...a) => w(private_control(...a)), buffer_control = 1049, cursor_control = 25, inc = i=>(i+1);
const assert = (o,m="Object not valid.") => {
	if (typeof o === 'undefined' || o === undefined || o === null || o === false)
		throw m;
}, failExport = {
	UI: {
		Control: err, Page: err, Label: err
	}
}, defaultExports = { assert };
var canDraw;
var channel = process.stdout, input = process.stdin;
try {
	[ // Bun disables its colors regardless of the value of NO_COLOR when defined
		[ channel.isTTY && input.isTTY, "STDOUT/STDIN is not a TTY; flow.js is disabled." ],
		[ Bun.env.NO_COLOR===undefined || Bun.env.FORCE_COLOR!==undefined, "NO_COLOR defined && FORCE_COLOR undefined; flow.js is disabled." ],
	].forEach(a=>assert(canDraw = a[0], a[1]));
}
catch(e) {
	if (!globalThis.flowjs_failed)
		console.error(e);
	globalThis.flowjs_failed = true;
	module.exports = { ...failExport, ...defaultExports, canDraw };
	return;
}
//if (process.stderr.isTTY) // redirect error when a screen is active
	// should implement a class where coloring or formatting is specified in an alternate way that doesn't
	// rely on stuffing escape codes in strings, since it still looks kind of ugly,
	// and instead strings are broken up with format codes in between ***
module.exports = { // this whole thing going in every file that requires one or two things feels like overdoing it or something
	failExport,
	/******************************** helper stuff ********************************/
	assert, createLock: () => { // thread join moment
		var s,j;
		return {promise:new Promise((res,rej)=>{s=res,j=rej;}),resolve:s,reject:j};
	}, coverage: (str,pat,cap=0) => {
		var l = 0;
		var m;
		var once = !pat.global;
		while ((m = pat.exec(str)) !== null && (pat.global || once)) {
			l += m[cap].length;
			once = false;
		}
		return l;
	}, concat_regex: (...rs) => {
		var flags = '';
		var src = '';
		rs.forEach((r,i)=>{
			flags += r.flags;
			var s = r.source;
			if (s.startsWith('^') && i > 0)
				s = s.slice(1);
			if (s.endsWith('$') && i < rs.length-1)
				s = s.slice(-1);
			src += s;
		});
		// too lazy to figure out the flags part myself https://stackoverflow.com/questions/185510
		return new RegExp(src, flags.split("").sort().join("").replace(/(.)(?=.*\1)/g, ""));
	}, defaultExports,
	/******************************** console stuff ********************************/
	log: console.log, error: console.error, channel, input, canDraw,
	res: () => {
		channel._refreshSize(); // this stupid crap was giving me a headache
		return [channel.columns, channel.rows];
	},
	ctrl, w: (...a) => channel.write(...a),// cursor_pos: () => cc, //var cc = [];
	private_control: (c,b) => (ctrl+"?"+String(c)+(b===true?'h':'l')),
	privctrl, buffer_control, cursor_control, curpos: /^\x1b\[([0-9]+);([0-9]+)R$/,
	ctrlcap: /\x1b(\[(\d+;\d+[Hf]|\d+[A-GJK]|[HJKsu]|6n|\d+(;\d+)*m|\?\d+[lh])|[N78])/g,
	set_buffer: b=>privctrl(buffer_control,b), set_cursor: b=>privctrl(cursor_control,b),
	M_UP: 0, M_DOWN: 1, M_RIGHT: 2, M_LEFT: 3, key_names: ["up","down","right","left"],
	normal_refresh_rate: 50, jump: (x,y)=>(ctrl+[y,x].map(Math.floor).map(inc).join(';')+'H'),
	// in the case of NO_COLOR=1, could probably compensate ^ using clear screen and move cursor functions,
	// setting private buffer without ANSI functions is probably really impossible though (double buffering when LOL)
	/******************************** enums..... ********************************/
};


