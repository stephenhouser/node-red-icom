// UDP Client that will send faux FlexRadio data to listeners
const pcap = require('pcap');
const hexy = require("hexy");
const { program } = require('commander');

const icnet = require('../net-transport-parser');

// current packet being processed.
let packet_n = 0;

//const ignore_types = ['idle', 'probe', 'probe-response', 'ping', 'disconnect'];
//const ignore_types = ['data', 'ping'];
const ignore_types = [];


async function test_packet(datagram, packet) {
	console.log(`\nPacket #${packet_n}: ${packet.payload.payload}`);
	if (program.opts().debug) {
		console.log(hexy.hexy(datagram.data));
	}

	try {
		const decoded = icnet.decode(datagram.data);
		if (ignore_types.includes(decoded.type)) {
			return;
		}

		console.log(decoded);
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
