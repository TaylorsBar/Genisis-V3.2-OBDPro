import { matrix, add, multiply, transpose, inv, identity, subtract, clone } from 'mathjs';

interface BufferEntry {
  timestamp: number;
  dt: number;
  imu: { ax: number, ay: number, az: number, gx: number, gy: number, gz: number };
  x: any;
  P: any;
}

/**
 * Genesis Extended Kalman Filter Ultimate
 * 15-State representation explicit handler for asynchronous sensor fusion.
 * State vector (15x1):
 * [0..2]  Position (X, Y, Z)
 * [3..5]  Velocity (Vx, Vy, Vz)
 * [6..8]  Orientation (Roll, Pitch, Yaw)
 * [9..11] Gyro Bias (bgx, bgy, bgz)
 * [12..14] Accel Bias (bax, bay, baz)
 */
export class GenesisEKFUltimate {
  private x: any; // State vector 15x1
  private P: any; // Covariance matrix 15x15
  private Q: any; // Process noise covariance
  private I: any; // Identity matrix
  
  // Real-time variance tracking for UI
  public varianceX: number = 0;
  public varianceY: number = 0;
  public gnssActive: boolean = true;
  
  // Asynchronous Buffer
  private buffer: BufferEntry[] = [];
  private bufferSize: number = 100; // 1 second buffer at 100Hz
  private currentTimestamp: number = 0;

  constructor() {
    this.x = matrix([[0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0]]);
    this.P = multiply(identity(15), 0.1); 
    
    // Process noise Q
    const qValues = [
      0.01, 0.01, 0.01, // Pos noise
      0.05, 0.05, 0.05, // Vel noise
      0.01, 0.01, 0.01, // Ori noise
      0.001, 0.001, 0.001, // Gyro bias noise
      0.001, 0.001, 0.001  // Accel bias noise
    ];
    let qArray = [];
    for (let i=0; i<15; i++) {
        let row = new Array(15).fill(0);
        row[i] = qValues[i];
        qArray.push(row);
    }
    this.Q = matrix(qArray);
    
    this.I = identity(15);
  }

  // Gets the current 15-state array
  public getState() {
    return this.x.toArray().map((r: number[]) => r[0]);
  }

  private _updateVariance() {
    const pArr: any = this.P.toArray();
    this.varianceX = pArr[0][0];
    this.varianceY = pArr[1][1];
  }

  // Pure Predict step (stateless wrapper inside)
  private _predict(ax: number, ay: number, az: number, gx: number, gy: number, gz: number, dt: number) {
    const state = this.getState();
    const [px, py, pz, vx, vy, vz, roll, pitch, yaw, bgx, bgy, bgz, bax, bay, baz] = state;
    
    const gxc = gx - bgx;
    const gyc = gy - bgy;
    const gzc = gz - bgz;
    
    const axc = ax - bax;
    const ayc = ay - bay;
    const azc = az - baz;
    
    const n_roll = roll + gxc * dt;
    const n_pitch = pitch + gyc * dt;
    const n_yaw = yaw + gzc * dt;
    
    const n_vx = vx + axc * dt;
    const n_vy = vy + ayc * dt;
    const n_vz = vz + azc * dt;
    
    const n_px = px + n_vx * dt;
    const n_py = py + n_vy * dt;
    const n_pz = pz + n_vz * dt;
    
    this.x = matrix([
      [n_px], [n_py], [n_pz], 
      [n_vx], [n_vy], [n_vz], 
      [n_roll], [n_pitch], [n_yaw], 
      [bgx], [bgy], [bgz], 
      [bax], [bay], [baz]
    ]);
    
    const F_arr = Array.from({length: 15}, () => new Array(15).fill(0));
    for (let i = 0; i < 15; i++) F_arr[i][i] = 1; 
    
    F_arr[0][3] = dt; F_arr[1][4] = dt; F_arr[2][5] = dt;
    F_arr[3][12] = -dt; F_arr[4][13] = -dt; F_arr[5][14] = -dt;
    F_arr[6][9] = -dt; F_arr[7][10] = -dt; F_arr[8][11] = -dt;
    
    const F = matrix(F_arr);
    const Ft = transpose(F);
    
    this.P = add(multiply(multiply(F, this.P), Ft), this.Q);
  }

  // Front-facing predict that buffers state
  public predictIMU(ax: number, ay: number, az: number, gx: number, gy: number, gz: number, dt: number, timestamp: number) {
    this._predict(ax, ay, az, gx, gy, gz, dt);
    
    this.buffer.push({
        timestamp,
        dt,
        imu: { ax, ay, az, gx, gy, gz },
        x: clone(this.x), 
        P: clone(this.P)
    });

    if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
    }
    
    this.currentTimestamp = timestamp;
    this._updateVariance();
  }

  public updateGNSS(px: number, py: number, pz: number, vx: number, vy: number, vz: number, timestamp: number, R_diag: number[] = [0.5, 0.5, 1.0, 0.2, 0.2, 0.2]) {
    this.gnssActive = true;
    
    const Z = matrix([[px], [py], [pz], [vx], [vy], [vz]]);
    
    const H_arr = Array.from({length: 6}, () => new Array(15).fill(0));
    H_arr[0][0] = 1; H_arr[1][1] = 1; H_arr[2][2] = 1;
    H_arr[3][3] = 1; H_arr[4][4] = 1; H_arr[5][5] = 1;
    const H = matrix(H_arr);
    
    let R_arr = Array.from({length: 6}, () => new Array(6).fill(0));
    for (let i=0; i<6; i++) Object.assign(R_arr[i], { [i]: R_diag[i] });
    const R = matrix(R_arr);
    
    this._applyAsynchronousUpdate(Z, H, R, timestamp);
  }

  public updateVisualOdometry(vx: number, vy: number, vz: number, timestamp: number) {
    const noise = this.gnssActive ? 2.0 : 0.05;
    
    const Z = matrix([[vx], [vy], [vz]]);
    
    const H_arr = Array.from({length: 3}, () => new Array(15).fill(0));
    H_arr[0][3] = 1; H_arr[1][4] = 1; H_arr[2][5] = 1;
    const H = matrix(H_arr);
    
    const R = matrix([
      [noise, 0, 0],
      [0, noise, 0],
      [0, 0, noise]
    ]);
    
    this._applyAsynchronousUpdate(Z, H, R, timestamp);
  }

  // Core asynchronous rewind and replay
  private _applyAsynchronousUpdate(Z: any, H: any, R: any, measTimestamp: number) {
    if (this.buffer.length === 0) {
        this._performEKFUpdate(Z, H, R);
        return;
    }

    let rewindIdx = this.buffer.length - 1;
    while (rewindIdx > 0 && this.buffer[rewindIdx].timestamp > measTimestamp) {
        rewindIdx--;
    }

    // Rewind state
    this.x = clone(this.buffer[rewindIdx].x);
    this.P = clone(this.buffer[rewindIdx].P);

    // Apply the correction
    this._performEKFUpdate(Z, H, R);
    
    // Replace the buffer snapshot with the newly corrected one
    this.buffer[rewindIdx].x = clone(this.x);
    this.buffer[rewindIdx].P = clone(this.P);

    // Replay forward
    for (let i = rewindIdx + 1; i < this.buffer.length; i++) {
        const item = this.buffer[i];
        this._predict(item.imu.ax, item.imu.ay, item.imu.az, item.imu.gx, item.imu.gy, item.imu.gz, item.dt);
        
        // Update buffer history
        this.buffer[i].x = clone(this.x);
        this.buffer[i].P = clone(this.P);
    }

    this._updateVariance();
  }

  // Common Kalman gain and state update formula
  private _performEKFUpdate(Z: any, H: any, R: any) {
    const y = subtract(Z, multiply(H, this.x));
    const Ht = transpose(H);
    const S = add(multiply(multiply(H, this.P), Ht), R);
    const K = multiply(multiply(this.P, Ht), inv(S));
    
    this.x = add(this.x, multiply(K, y));
    this.P = multiply(subtract(this.I, multiply(K, H)), this.P);
  }
  
  public simulateDegradedGNSS() {
      this.gnssActive = false;
  }
}
