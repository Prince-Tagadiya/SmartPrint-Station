const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const port = new SerialPort({ path: '/dev/cu.usbserial-0001', baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
parser.on('data', console.log);
setTimeout(() => {
  port.write('{"cmd":"heartbeat","data":{}}\n');
}, 1000);
setTimeout(() => {
  port.close();
  process.exit(0);
}, 3000);
