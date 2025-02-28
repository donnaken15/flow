
import {UI} from './flow.js';

var test = new UI.Page([
	new UI.Label(4,4,{
		text: 'test'
	},undefined,'test')
]);
test.cursor = true;
test.cursor_start = [2, 2];
test.interval = 15;
test.refresh = () => {
	if (performance.now() < 3000) return;
	var label = test.find('test');
	label.x = Math.floor(4 + (35*(1+Math.sin((performance.now()/1000)*Math.PI))));
	label.data.text =
		'this text changed, and is moving!!\nwith newlines!!!\n'+
		(UI.res()[0]-label.x)+" <-- my amount of space!";
	test.cursor_pos = [label.x, 20];
};
test.base_layout.push(new UI.Control(4,10,{},(m)=>(performance.now()/1000).toFixed(3)));
var test3 = test.present();

await test3.loop;
console.error(test3);

