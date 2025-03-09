
import {UI} from './flow.js';

var rainbow = [91,93,92,96,94,95];

var test = new UI.Page([
	new UI.Label(4,4,{
		text: 'test'
	},undefined,'test')
]);
Object.assign(test, {
	cursor: false,
	cursor_start: [2, 2],
	interval: 7,
	refresh: () => {
		//if (performance.now() < 3000) return;
		var label = test.find('test');
		[['sin','x',35],['cos','y',20]].forEach(i=>{
			label[i[1]] = Math.floor(4 + (i[2]*(1+Math[i[0]]((performance.now()/1000)*Math.PI))));
		});
		label.data.text =
			'\x1b['+rainbow[Math.floor((performance.now()/(500/6)))%6]+'mwoooooooaaaAAAAaaoooooooooo-\x1b[95m\n'+
			//Math.abs(Math.cos((performance.now()/1000)*Math.PI).toFixed(3)).toString().padEnd(5,'0').padStart(8)+'\x1b[36m\n'+
			test.cursor_pos+'';
		test.cursor_pos = [label.x+20, label.y+3];
	}
});
test.base_layout.push(new UI.Control(4,10,{},(m)=>(performance.now()/1000).toFixed(3)));
var test3 = test.present();

//await test3.loop;
//console.error(test3);
while (test.active)
{
	await test3.next;
	//await test3.busy;
	//console.error(2222);
	//console.error(test3.flow.cursor_pos);
}
console.error(test3);

