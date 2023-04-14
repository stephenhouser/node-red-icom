// read packets from pcap file and run parser against them.

const pcap = require('pcap');
const hexy = require("hexy");
const { program } = require('commander');
const util = require('node:util');

const icnet = require('../net-transport-parser');
const iccontrol = require('../net-control-parser');
const icserial = require('../net-serial-parser');

// current packet being processed.
let packet_n = 0;

const ignore_types = [];

const red = '\033[31;1;4m';
const blue = '\033[94;1;4m';
const green = '\033[31;1;4m';
const normal = '\033[m';
const yellow = '\033[93;1;4m';


function print(msg) {
	if (typeof(msg) == 'object') {
		msg = util.format(msg);
	}
	process.stdout.write(msg);
}

function match_port(datagram, port) {
	return datagram.sport == port || datagram.dport == port;
}

// set any port to 0 to "hide" it
function skip_port(datagram) {
	return !match_port(datagram, program.opts().control) &&
			!match_port(datagram, program.opts().serial) &&
			!match_port(datagram, program.opts().audio);
}

async function test_packet(datagram, packet) {
	if (skip_port(datagram)) {
		return;
	}

	//print(`# ${yellow}Datagram #${packet_n}${normal}:${packet.payload.payload} (0x${datagram.data.length.toString(16)}) `);
	if (program.opts().debug) {
		print('\n');
		print(hexy.hexy(datagram.data, {prefix: '# '}));
		print('# ');
	}	
	
	var direction, channel;
	try {
		const decoded = icnet.decode(datagram.data);
		if (ignore_types.includes(decoded.type)) {
			return;
		}

		// Control channel
		if (match_port(datagram, program.opts().control)) {
			//print(`${yellow}Control Channel${normal}`);
			direction = datagram.sport == program.opts().control ? '<-' : '->';
			channel = 'control';

			if (decoded.payload) {
				//print(` payload len=${decoded.payload.length} (0x${decoded.payload.length.toString(16)})`);

				const control_decoded = iccontrol.decode(decoded.payload);
				if (ignore_types.includes(control_decoded.type)) {
					return;
				}

				decoded.payload = control_decoded;
			}
		}

		// Serial channel
		if (match_port(datagram, program.opts().serial)) {
			direction = datagram.sport == program.opts().serial ? '<-' : '->';
			channel = 'serial';
			// print(`${yellow}Serial Channel${normal}`);
			if (decoded.payload) {
				// print(` payload len=${decoded.payload.length} (0x${decoded.payload.length.toString(16)})`);

				const serial_decoded = icserial.decode(decoded.payload);
				if (ignore_types.includes(serial_decoded.command)) {
					return;
				}

				decoded.payload = serial_decoded;
			}
		}

		// TODO: Audio channel
		if (match_port(datagram, program.opts().audio)) {
			direction = datagram.sport == program.opts().audio ? '<-' : '->';
			channel = 'audio';
			// print(`${yellow}Audio Channel${normal}`);
			if (decoded.payload) {
				// print(` payload len=${decoded.payload.length} (0x${decoded.payload.length.toString(16)})`);
				// const audio_decoded = icaudio.decode(decoded.payload);
				// if (ignore_types.includes(_decoded.command)) {
				// 	return;
				// }
				// 
				// decoded.payload = audio_decoded;
			}
		}

		//print('\n');
		print(`${packet_n}, ${direction}, ${channel}, ${decoded.sequence}, ${decoded.type}, `);
		if (decoded.payload) {
			print(`${decoded.payload.sequence}, ` );
			if (decoded.payload.type) {	
				print(`${decoded.payload.type}, ${decoded.payload.request},`);
			}
		}
		print('\n');
	} catch (err) {
		console.log(`ERROR: could not parse packet #${packet_n}`);
		console.log(err);
		if (program.opts().fail) {
			process.exit(1);
		}
	}
}	

function get_udp_packet(packet) {
	if (packet &&
		//packet.payload.constructor.name == 'EthernetPacket' &&
		packet.payload.payload &&
		packet.payload.payload.constructor.name == 'IPv4' &&
		packet.payload.payload.payload &&
		packet.payload.payload.payload.constructor.name == 'UDP') {
		const data = {
				timestamp_s: packet.pcap_header.tv_sec,
				timestamp_us: packet.pcap_header.tv_usec,
				data: Buffer.from(packet.payload.payload.payload.data),
				sport: packet.payload.payload.payload.sport,
				dport: packet.payload.payload.payload.dport,
				length: packet.payload.payload.payload.length,
				checksum: packet.payload.payload.payload.checksum
			};
		
		return data;
	}

	return null;
}

async function get_packets(capture_file, start, end, callback) {
	return new Promise((resolve, reject) => {
		const packets = [];
		const pcap_session = pcap.createOfflineSession(capture_file);

		pcap_session.on('packet', (raw_packet) => {
			const packet = pcap.decode.packet(raw_packet);
			packet_n += 1;
			if (packet && packet_n >= start && packet_n < end) {
				try {
					const datagram = get_udp_packet(packet);
					if (datagram && callback) {
						callback(datagram, packet);
					}
				} catch (error) {
					console.error(error);
				}
			}
		});		

		pcap_session.on("complete", () => {
			resolve(packets);
		});
	})
}

program
  .version('1.0.0', '-v, --version')
  .usage('[OPTIONS]...')
  .option('-f, --fail', 'fail/exit on error.')
  .option('--no-fail', 'don\'t fail/exit on error.')
  .option('-d, --debug', 'Show more verbose debug information.')
  .option('-s, --start <value>', 'starting packet number', '0')
  .option('-e, --end <value>', 'ending packet number', '100000000')
  .option('-o, --one <value>', 'dump a single packet', '0')
  .option('--control <value>', 'control port', '50001')
  .option('--serial <value>', 'serial/civ port', '50002')
  .option('--audio <value>', 'audio port', '50003')
  .argument('<files...>', 'pcap trace files to process')
  .action(function(files) {
	let start = parseInt(this.opts().start);
	let end = parseInt(this.opts().end);

	const one = parseInt(this.opts().one);
	if (one != 0) {
		start = one;
		end = one + 1;
	}

	files.forEach((file) => {
		get_packets(file, start, end, test_packet);
	});
  })
  .parse();
