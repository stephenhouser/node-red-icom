
// read packets from pcap file and run parser against them.
const hexy = require("hexy");
const { program } = require('commander');
const util = require('node:util');
const fsp = require('node:fs/promises');

const civp = require('../ci-v-parser');

// current command being processed.
let command_n = 0;

const ignore_types = ['scope-waveform'];

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

function parse_command(buffer) {
	if (!buffer || buffer.length == 0) {
		return;
	}

	print(`# ${yellow}CI-V Command #${command_n}${normal} len=${buffer.length} (0x${buffer.length.toString(16)})`);

	if (program.opts().debug) {
		print('\n');
		print(hexy.hexy(buffer, {prefix: '# '}));
	}	

	const decoded = civp.decode(buffer);
	print(` ${yellow}${decoded.command} 0x${decoded.command_code.toString(16)}${normal}\n`);

	if (ignore_types.includes(decoded.command)) {
		return;
	}

	print(decoded);
	print('\n\n');
}

command_n = 0;

async function parse_file(filename, start, end) {
    const file = await fsp.open(filename);
    for await (const line of file.readLines()) {
		command_n++;
		if (start <= command_n && command_n < end) {
			const buffer = Buffer.from(line.replace(/ /g, ''), 'hex');
			parse_command(buffer);
		}
    }
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
  .argument('<files...>', 'CI-V trace files to process')
  .action(function(files) {
	let start = parseInt(this.opts().start);
	let end = parseInt(this.opts().end);

	const one = parseInt(this.opts().one);
	if (one != 0) {
		start = one;
		end = one + 1;
	}

	files.forEach((file) => {
		parse_file(file, start, end);
	});
  })
  .parse();
