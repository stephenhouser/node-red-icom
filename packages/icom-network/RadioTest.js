const { Radio } = require('./Radio.js');


const r = new Radio();

r.connect('ic-705.lan', 50001)
	.then((res) => {
		console.log('connected');
		// r.send({payload: 'fefe'});
	});

let i = 0;
setInterval(() => {
	console.log(`Infinite Loop ${i++ * 5}`);
}, 5000)