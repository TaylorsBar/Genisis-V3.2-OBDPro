
import { ObdConnectionState, DiagnosticCode, EmissionsReadiness } from "../types";

// Known OBD-II Service UUIDs to try
const CANDIDATE_SERVICES = [
    "0000fff0-0000-1000-8000-00805f9b34fb", 
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "0000bee0-0000-1000-8000-00805f9b34fb",
    "000018f0-0000-1000-8000-00805f9b34fb"
];

// Define Web Bluetooth types locally
type BluetoothDevice = any;
type BluetoothRemoteGATTServer = any;
type BluetoothRemoteGATTCharacteristic = any;

export class ObdService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
  
  private responseResolver: ((value: string) => void) | null = null;
  private currentResponse: string = "";
  private isBusy: boolean = false;

  constructor(private onStatusChange: (status: ObdConnectionState) => void) {}

  public async connect(): Promise<void> {
    // @ts-ignore
    if (!navigator.bluetooth) {
      console.error("Web Bluetooth API not supported.");
      this.onStatusChange(ObdConnectionState.Error);
      return;
    }

    try {
      this.onStatusChange(ObdConnectionState.Connecting);

      // 1. Request Device
      // We use a comprehensive filter list to find OBD adapters by Service OR Name.
      // This prevents "acceptAllDevices" from showing unrelated BLE devices (TVs, etc),
      // while still catching cheap clones that don't advertise services properly but have common names.
      // @ts-ignore
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
            // Try standard services
            { services: ["0000fff0-0000-1000-8000-00805f9b34fb"] },
            { services: ["0000ffe0-0000-1000-8000-00805f9b34fb"] },
            { services: ["0000bee0-0000-1000-8000-00805f9b34fb"] },
            { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
            // Try common name prefixes for clones
            { namePrefix: "OBD" },
            { namePrefix: "obd" },
            { namePrefix: "V-LINK" },
            { namePrefix: "v-link" },
            { namePrefix: "ELM" },
            { namePrefix: "IOS-Vlink" },
            { namePrefix: "Viecar" },
            { namePrefix: "Konnwei" }
        ],
        optionalServices: CANDIDATE_SERVICES
      });

      this.device!.addEventListener('gattserverdisconnected', this.handleDisconnect);

      // 2. Connect GATT
      this.server = await this.device!.gatt!.connect();

      // 3. Service Discovery Strategy
      let service = null;
      for (const uuid of CANDIDATE_SERVICES) {
          try {
              service = await this.server!.getPrimaryService(uuid);
              console.log(`Connected to service: ${uuid}`);
              break; 
          } catch (e) {
              // Continue to next candidate
          }
      }

      if (!service) {
          // Fallback: Try to find *any* service that looks like serial
          const services = await this.server!.getPrimaryServices();
          if (services.length > 0) {
              service = services[0];
              console.log(`Falling back to first available service: ${service.uuid}`);
          } else {
              throw new Error("No supported OBD-II service found.");
          }
      }

      // 4. Characteristic Discovery Strategy
      const characteristics = await service.getCharacteristics();
      
      this.notifyChar = characteristics.find((c: any) => c.properties.notify || c.properties.indicate);
      this.writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

      if (!this.notifyChar || !this.writeChar) {
          throw new Error("Device missing required Read/Write characteristics.");
      }

      // 5. Start Notifications
      await this.notifyChar.startNotifications();
      this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotification);

      // 6. Initialize ELM327
      await this.initializeElm327();

      this.onStatusChange(ObdConnectionState.Connected);
    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
          console.log("User cancelled Bluetooth chooser.");
          this.onStatusChange(ObdConnectionState.Disconnected);
          return;
      }

      console.error("OBD Connection failed", error);
      this.onStatusChange(ObdConnectionState.Error);
      this.disconnect();
    }
  }

  public disconnect = () => {
    if (this.device) {
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.onStatusChange(ObdConnectionState.Disconnected);
  };

  private handleDisconnect = () => {
    console.log("OBD Device disconnected unexpectedly.");
    this.onStatusChange(ObdConnectionState.Disconnected);
  };

  private handleNotification = (event: Event) => {
    // @ts-ignore
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;

    const decoder = new TextDecoder('utf-8');
    const chunk = decoder.decode(target.value);
    
    this.currentResponse += chunk;

    if (this.currentResponse.includes('>')) {
      const fullResponse = this.currentResponse.replace('>', '').trim();
      this.currentResponse = "";
      
      if (this.responseResolver) {
        this.responseResolver(fullResponse);
        this.responseResolver = null;
      }
    }
  };

  private async initializeElm327() {
    this.onStatusChange(ObdConnectionState.Initializing);
    
    // Robust Initialization Sequence
    await this.runCommand("AT Z"); 
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.runCommand("AT E0"); 
    await this.runCommand("AT L0"); 
    await this.runCommand("AT S0"); 
    await this.runCommand("AT H1"); // Headers ON
    
    // Try explicit protocol first (CAN 11/500 is most common for modern cars)
    // AT SP 0 (Auto) can be slow or fail on some Nissans.
    // We stick to Auto for now but add a delay.
    await this.runCommand("AT SP 0"); 
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const protocol = await this.runCommand("AT DP");
    console.log("OBD Protocol:", protocol);

    // Keep Alive / Warmup
    await this.runCommand("0100"); 
  }

  public async runCommand(cmd: string): Promise<string> {
    if (!this.writeChar || !this.device?.gatt?.connected) {
      return "";
    }

    let attempts = 0;
    while (this.isBusy && attempts < 20) {
      await new Promise(r => setTimeout(r, 50));
      attempts++;
    }
    
    if (this.isBusy) return ""; 

    this.isBusy = true;

    return new Promise<string>(async (resolve, reject) => {
      this.responseResolver = resolve;
      
      const timeout = setTimeout(() => {
        this.isBusy = false;
        this.responseResolver = null;
        resolve(""); 
      }, 2000); 

      try {
        const encoder = new TextEncoder();
        await this.writeChar!.writeValue(encoder.encode(cmd + "\r"));
      } catch (e) {
        clearTimeout(timeout);
        this.isBusy = false;
        reject(e);
      }

      const originalResolve = this.responseResolver;
      this.responseResolver = (val: string) => {
        clearTimeout(timeout);
        this.isBusy = false;
        originalResolve!(val);
      }
    });
  }

  // --- Diagnostics ---

  public async getDiagnosticTroubleCodes(): Promise<DiagnosticCode[]> {
      const codes: DiagnosticCode[] = [];
      const confirmedRaw = await this.runCommand("03");
      codes.push(...this.parseDTCResponse(confirmedRaw, 'Confirmed'));
      const pendingRaw = await this.runCommand("07");
      const pending = this.parseDTCResponse(pendingRaw, 'Pending');
      
      pending.forEach(p => {
          if (!codes.find(c => c.code === p.code)) codes.push(p);
      });

      return codes;
  }

  public async clearDTCs(): Promise<boolean> {
      const response = await this.runCommand("04");
      return !response.includes("ERROR");
  }

  public async getEmissionsReadiness(): Promise<EmissionsReadiness> {
      const response = await this.runCommand("0101");
      const data = this.extractData(response, "4101");
      
      const status: EmissionsReadiness = {
          misfire: false, fuelSystem: false, components: false,
          catalyst: false, evap: false, o2Sensor: false, egr: false
      };

      if (!data || data.length < 8) return status;

      const byteB = parseInt(data.substring(2, 4), 16);
      const byteC = parseInt(data.substring(4, 6), 16);
      const byteD = parseInt(data.substring(6, 8), 16);

      status.misfire = !((byteB >> 0) & 1);
      status.fuelSystem = !((byteB >> 1) & 1);
      status.components = !((byteB >> 2) & 1);
      status.catalyst = !((byteC >> 0) & 1);
      status.evap = !((byteC >> 2) & 1);
      status.o2Sensor = !((byteC >> 5) & 1);
      status.egr = !((byteD >> 7) & 1);

      return status;
  }

  private parseDTCResponse(response: string, status: 'Confirmed' | 'Pending' | 'Permanent'): DiagnosticCode[] {
      const codes: DiagnosticCode[] = [];
      const clean = response.replace(/[\s\r\n>]/g, '');
      
      let hexStream = clean;
      const modeHeader = status === 'Confirmed' ? '43' : (status === 'Pending' ? '47' : '4A');
      const idx = hexStream.indexOf(modeHeader);
      if (idx !== -1) {
          hexStream = hexStream.substring(idx + 2);
      }

      for (let i = 0; i < hexStream.length; i += 4) {
          if (i + 4 > hexStream.length) break;
          const group = hexStream.substring(i, i + 4);
          if (group === "0000") continue; 

          const high = parseInt(group.substring(0, 2), 16);
          const low = group.substring(2, 4);

          const type = ['P', 'C', 'B', 'U'][(high & 0xC0) >> 6];
          const digit2 = (high & 0x30) >> 4;
          const digit3 = (high & 0x0F).toString(16).toUpperCase();
          
          codes.push({
              code: `${type}${digit2}${digit3}${low}`,
              status,
              timestamp: Date.now()
          });
      }
      return codes;
  }

  private extractData(response: string, servicePrefix: string): string | null {
      const clean = response.replace(/[\s\0>]/g, '');
      const idx = clean.indexOf(servicePrefix);
      if (idx !== -1) {
          return clean.substring(idx + servicePrefix.length);
      }
      if (!clean.includes("NO") && !clean.includes("ERR") && !clean.includes("UNABLE")) {
          return clean;
      }
      return null;
  }

  // --- Parsers ---

  public parseRpm(response: string): number {
    const data = this.extractData(response, "410C");
    if (!data || data.length < 4) return 0;
    const a = parseInt(data.substring(0, 2), 16);
    const b = parseInt(data.substring(2, 4), 16);
    return ((a * 256) + b) / 4;
  }

  public parseSpeed(response: string): number {
    const data = this.extractData(response, "410D");
    if (!data || data.length < 2) return 0;
    return parseInt(data.substring(0, 2), 16);
  }

  public parseWheelSpeeds(response: string): { fl: number, fr: number, rl: number, rr: number } | null {
      const clean = response.replace(/[\s\r\n>]/g, '');
      const match = /6104([0-9A-F]{16})/i.exec(clean);
      
      if (match) {
          const hex = match[1];
          return {
              fl: parseInt(hex.substring(0, 4), 16) / 100, 
              fr: parseInt(hex.substring(4, 8), 16) / 100, 
              rl: parseInt(hex.substring(8, 12), 16) / 100,
              rr: parseInt(hex.substring(12, 16), 16) / 100 
          };
      }
      return null;
  }

  public parseCoolant(response: string): number {
    const data = this.extractData(response, "4105");
    if (!data || data.length < 2) return 0;
    return parseInt(data.substring(0, 2), 16) - 40;
  }

  public parseIntakeTemp(response: string): number {
    const data = this.extractData(response, "410F");
    if (!data || data.length < 2) return 0;
    return parseInt(data.substring(0, 2), 16) - 40;
  }

  public parseMap(response: string): number {
    const data = this.extractData(response, "410B");
    if (!data || data.length < 2) return 0;
    return parseInt(data.substring(0, 2), 16);
  }

  public parseLoad(response: string): number {
    const data = this.extractData(response, "4104");
    if (!data || data.length < 2) return 0;
    return (parseInt(data.substring(0, 2), 16) * 100) / 255;
  }

  public parseVoltage(response: string): number {
    if (response.includes("V")) return parseFloat(response.replace("V", ""));
    const data = this.extractData(response, "4142");
    if (data && data.length >= 4) {
        return ((parseInt(data.substring(0, 2), 16) * 256) + parseInt(data.substring(2, 4), 16)) / 1000;
    }
    return 0;
  }

  public parseTimingAdvance(response: string): number {
    const data = this.extractData(response, "410E");
    if (!data || data.length < 2) return 0;
    return (parseInt(data.substring(0, 2), 16) - 128) / 2;
  }

  public parseMaf(response: string): number {
    const data = this.extractData(response, "4110");
    if (!data || data.length < 4) return 0;
    return ((parseInt(data.substring(0, 2), 16) * 256) + parseInt(data.substring(2, 4), 16)) / 100;
  }

  public parseThrottlePos(response: string): number {
    const data = this.extractData(response, "4111");
    if (!data || data.length < 2) return 0;
    return (parseInt(data.substring(0, 2), 16) * 100) / 255;
  }

  public parseFuelLevel(response: string): number {
    const data = this.extractData(response, "412F");
    if (!data || data.length < 2) return 0;
    return (parseInt(data.substring(0, 2), 16) * 100) / 255;
  }

  public parseBarometricPressure(response: string): number {
    const data = this.extractData(response, "4133");
    if (!data || data.length < 2) return 0;
    return parseInt(data.substring(0, 2), 16);
  }

  public parseLambda(response: string): number {
    const data = this.extractData(response, "4144");
    if (!data || data.length < 4) return 0;
    return ((parseInt(data.substring(0, 2), 16) * 256) + parseInt(data.substring(2, 4), 16)) / 32768;
  }

  public parseAmbientTemp(response: string): number {
    const data = this.extractData(response, "4146");
    if (!data || data.length < 2) return 0;
    return parseInt(data.substring(0, 2), 16) - 40;
  }
  
  public parseFuelRailPressure(response: string): number {
    const data = this.extractData(response, "4123");
    if (!data || data.length < 4) return 0;
    return ((parseInt(data.substring(0, 2), 16) * 256) + parseInt(data.substring(2, 4), 16)) * 10;
  }
}
