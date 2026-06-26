import { serialBridge } from './src/services/SerialBridge';
async function test() {
  const ports = await serialBridge.getAvailablePorts();
  console.log(ports);
  process.exit(0);
}
test();
