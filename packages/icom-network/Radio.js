
// const net = require('net');
const dgram = require('dgram');
const EventEmitter = require('events');
const icnet = require('./net-transport-parser.js')

const log_info = function(msg) { console.log(msg); };
const log_debug = function(msg) { console.log(msg); };
const log_debug_realtime = function(msg) {  };

const ConnectionStates = {
	disconnected: 'disconnected',
	connecting: 'connecting',
	connected: 'connected',
	listening: 'listening'
};

// These are the message types generated by the parser
// or UDP datastream and emitted from a Radio object
const MessageTypes = {
	connection: 'connection',
	error: 'error',
	version: 'version',
	handle: 'handle',
	message: 'message',
	status: 'status',
	response: 'response',
	panadapter: 'panadapter',
	waterfall: 'waterfall',
	audio: 'audio',
	unknown: 'unknown'
};

// Unique ID for use in debugging connections, events, etc.
let radio_id = 1;

class ICOMNetworkChannel extends EventEmitter {
	constructor() {
		super();

		this.host = null;
		this.port = null;
		this.source_port = null;
		this.source_id = 0x0000;
		this.socket = null;
		this.state = ConnectionStates.disconnected;

		this.destination_port = 0x0000;
		this.destination_id = 0x0000;

		this.send_sequence = 0;
		this.ping_sequence = 0;
		this.recv_sequence = 0;
		this.waiting_queue = {};
	}

	connect(host, port) {
		const channel = this;

		// resolves when network connection is established
		// and we have exchanged SYN and READY messages
		return new Promise(function(resolve, reject) {
			if (channel.state != ConnectionStates.disconnected) {
				console.log('reject connect in network');
				reject();
				return;
			}

			const socket = dgram.createSocket({ type: 'udp4', reuseAddr: false });
			socket.on('listening', (msg) => {
				const listenAddress = socket.address();
				channel.source_port = listenAddress.port;
				channel.host = host;
				channel.port = port;		
				channel.state = ConnectionStates.listening;
				console.log(`UDP ${port}: ${channel.state}`);

				// After UDP is listening,
				// ...send syn, wait for syn-ack
				// ...send ready, wait for ready
				channel.send({ type: 'syn' }, 'syn-ack')
					.then((syn_ack_msg) => {
						channel.destination_id = syn_ack_msg.source_id;
						channel.destination_port = syn_ack_msg.source_port;
						return channel.send({ type: 'ready' }, 'ready');
					})
					.then((ready_msg) => { 
						channel.recv_sequence = ready_msg.sequence;
						resolve(); 
					})
			});

			socket.on('error', (msg) => {
				channel.state = ConnectionStates.disconnected;
				console.log(`UDP ${port}: ERROR ${channel.state}`);
				channel.emit('error', msg);
			});

			socket.on('message', (msg) => {
				// console.log(`<: ${JSON.stringify(msg)}`);
				const decoded = icnet.decode(msg);
				if (decoded) {
					channel._receiveMessage(decoded);
				} else {
					console.log(`ERROR: Decoding message on channel ${channel.port}`);
				}
			});

			socket.on('close', (msg) => {
				channel.state = ConnectionStates.disconnected;
				console.log(`UDP ${port}: ${channel.state}`);
				socket.removeAllListeners('listening');
				socket.removeAllListeners('connect');
				socket.removeAllListeners('error');
				socket.removeAllListeners('message');
				socket.removeAllListeners('close');
				channel.emit('close', msg);
			});

			channel.state = ConnectionStates.connecting;
			channel.socket = socket;
			channel.socket.bind();
		});
	}

	_send(msg) {
		if (msg.type != 'ping') {
			console.log(`>${this.port} ${JSON.stringify(msg)}`);
		}

		const encoded = icnet.encode(msg);
		if (!encoded) {
			console.log(`ERROR: Encoding message on channel ${channel.port}`);
			return false;
		}

		// console.log(`>: ${JSON.stringify(encoded)}`);
		this.socket.send(encoded, this.port, this.host);
		return true;
	}

	sendPing(msg) {
		const ping = {
			type: 'ping',
			sequence: this.ping_sequence++,
			source_port: this.source_port, 
			source_id: this.source_id, 
			destination_port: this.destination_port,
			destination_id: this.destination_id
		};

		if (msg && msg.ping_id) {
			// this is a reply
			ping.reply = 1;
			ping.ping_id = msg.ping_id;
		} else {
			ping.reply = 0;
			ping.ping_id = 0xFACE;
		}

		// console.log(`>${this.port} ${JSON.stringify(pong)}`);
		this._send(ping);
	}

	send(msg, wait_for) {
		const send_msg = {
			...msg,
			sequence: this.send_sequence++,
			source_port: this.source_port, 
			source_id: this.source_id, 
			destination_port: this.destination_port,
			destination_id: this.destination_id
		};

		return new Promise((resolve, reject) => {
			if (!this._send(send_msg)) {
				reject();
				return;
			}

			if (wait_for) {
				// console.log(`WAIT FOR: ${wait_for}`);
				this.waiting_queue[wait_for] = [resolve, reject];
			} else {
				resolve();
			}
		});
	}

	_receivePing(msg) {
		if (this.ping_sequence && (this.ping_sequence != msg.sequence)) {
			console.log(`WARNING: Out of sequence ping ${msg.sequence}`);
		}

		this.ping_sequence = msg.sequence;
		this.sendPing(msg);
	}

	_receiveMessage(msg) {
		if (msg.type == 'ping') {
			this._receivePing(msg);
			return;
		}

		if (this.recv_sequence && (this.recv_sequence != msg.sequence)) {
			console.log(`WARNING: Out of sequence receive packet ${msg.sequence}`);
		}

		this.recv_sequence = msg.sequence + 1;
		
		// console.log(`<${this.port} ${JSON.stringify(msg)}`);
		if (msg.type in this.waiting_queue) {
			// console.log(`<${this.port} ${JSON.stringify(msg)}`);
			const [resolve, reject] = this.waiting_queue[msg.type];
			if (resolve) {
				// console.log(`RESOLVE: ${msg.type}`);
				delete this.waiting_queue[msg.type]
				resolve(msg);
			}
		}
		
		this.emit('message', msg.payload);
	}

	disconnect() {
		if (channel.state != ConnectionStates.disconnected) {
			this.socket.close();
			this.socket.unref();
			this.socket = null;
		}
	}
}

class ICOMControlChannel  extends EventEmitter {
	constructor() {
		super();

		this.network = new ICOMNetworkChannel();
	}	

	connect(host, port) {
		const net = this.network;

		return this.network.connect(host, port)
			.then((results) => {
				console.log(`CONTROL: connected`);

				net.on('message', (msg) => {
					if (!msg || msg.length == 0) {
						return
					}

					console.log(`CONTROL MSG: ${JSON.stringify(msg)}`);
				});

				net.on('close', (msg) => {
					console.log('CONTROL: closed');
				});

				net.on('error', (msg) => {
					console.log(`CONTROL ERROR: ${msg}`);
				})
			})
		;
	}

	login(username, password) {
		if (this.network.state != ConnectionStates.connected) {
			return Promise.reject();
		}

		const login = {
			type: 'request',
			request: 'login',
			username: 'ic-705',
			password: 'flexradio',
			program: 'archlinu-wfview',

			// type_code: 1,
			// request_code: 0,
			// sequence: 48,
			// length: 112,
			// token_request: 27131,
			// token: 0,
		};

		// Response is...
		// payload: {
		// 	length: 80,
		// 	type_code: 2,
		// 	request_code: 0,
		// 	sequence: 48,
		// 	token_request: 27131,
		// 	token: 1800263078,
		// 	authid: 0,
		// 	error: 0,
		// 	connection: 'FTTH',
		// 	type: 'response',
		// 	request: 'login'
		//   },
		return this.send(login, 'login');
	}

	send(msg, wait_for) {
		return this.network.send(msg, wait_for);
	}
}

class Radio extends EventEmitter {
	constructor() {
		super();

		// Assign this object a unique ID that will show in debug messages
		// Makes for easy assocaition of events, etc..
		this.radio_id = radio_id++;
		log_info(`Radio[${this.radio_id}].constructor()`);

		this.control = new ICOMControlChannel();	// control channel
		this.serial = null;		// serial (ci-v) channel
		this.audio = null;		// audio channel
	}

	connect(host, port) {
		log_info(`Radio[${this.radio_id}].connect(${host}:${port})`);
		return this.control.connect(host, port);
	}

	login(username, password) {
		log_info(`Radio[${this.radio_id}].login(${username}:${password})`);

	}

	send(request) {
		log_debug('Radio.send(' + request + ')');
		if (!request) {
			log_info(`Radio[${this.radio_id}].send() -- Sent empty command. Ignoring.`);
			return Promise.reject('no request');
		}				

		return Promise.resolve('done');
		//return this.serial.send(request);
	}

	// Receives a "chunk" of data on the TCP/IP stream
	// Accumulates it and passes off individual lines to be handled
	// Handles a singluar, separated, message line from TCP/IP stream
	_receiveSerialData(encoded_message) {
		log_debug(`Radio[${this.radio_id}]._receiveSerialData(${encoded_message})`);
		// const message = flex.decode(encoded_message);
		// if (message) {
		// }
	}

	_receiveAudioData(encoded_message) {
		log_debug(`Radio[${this.radio_id}]._receiveAudioData(${encoded_message})`);
		// const message = flex.decode(encoded_message);
		// if (message) {
		// }
	}

	disconnect() {
		log_info(`Radio[${this.radio_id}].disconnect()`);
		// this._disconnectFromRadio();
	}

}

module.exports = {
	Radio: Radio,
	RadioConnectionStates: ConnectionStates
};
