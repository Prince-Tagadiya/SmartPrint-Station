const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const port = new SerialPort({ path: '/dev/cu.usbserial-0001', baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
parser.on('data', console.log);
setTimeout(() => {
  console.log('Sending heartbeat...');
  port.write('{"cmd":"heartbeat","data":{}}\n');
}, 3000);
setTimeout(() => {
  console.log('Sending status...');
  port.write('{"cmd":"status","data":{"printer":true,"scanner":true}}\n');
}, 4000);
setTimeout(() => {
  port.close();
  process.exit(0);
}, 6000);
