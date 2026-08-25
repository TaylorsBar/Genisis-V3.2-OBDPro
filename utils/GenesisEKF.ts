import { matrix, add, multiply, transpose, inv, identity, subtract } from 'mathjs';

/**
 * Genesis Extended Kalman Filter
 * 15-State representation explicit handler for asynchronous sensor fusion.
 * State vector (15x1):
 * [0..2]  Position (X, Y, Z)
 * [3..5]  Velocity (Vx, Vy, Vz)
 * [6..8]  Orientation (Roll, Pitch, Yaw)
 * [9..11] Gyro Bias (bgx, bgy, bgz)
 * [12..14] Accel Bias (bax, bay, baz)
 */
export class GenesisEKF {
  private x: any; // State vector 15x1
  private P: any; // Covariance matrix 15x15
  private Q: any; // Process noise covariance
  private I: any; // Identity matrix
  
  // Real-time variance tracking for UI
  public varianceX: number = 0;
  public varianceY: number = 0;
  public gnssActive: boolean = true;
  
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

  // Predict step from 100Hz IMU
  public predictIMU(ax: number, ay: number, az: number, gx: number, gy: number, gz: number, dt: number) {
    const state = this.getState();
    const [px, py, pz, vx, vy, vz, roll, pitch, yaw, bgx, bgy, bgz, bax, bay, baz] = state;
    
    // Bias correction
    const gxc = gx - bgx;
    const gyc = gy - bgy;
    const gzc = gz - bgz;
    
    const axc = ax - bax;
    const ayc = ay - bay;
    const azc = az - baz;
    
    // Simple state propagation
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
    
    // Simplistic Jacobian F (State Transition Model)
    // Normally we'd do a full 15x15 derivative 
    // Here we construct a decent approximation for the kinematics
    const F_arr = Array.from({length: 15}, () => new Array(15).fill(0));
    for (let i = 0; i < 15; i++) F_arr[i][i] = 1; // Diagonal
    
    // dPos / dVel
    F_arr[0][3] = dt; F_arr[1][4] = dt; F_arr[2][5] = dt;
    // dVel / dAccelBias
    F_arr[3][12] = -dt; F_arr[4][13] = -dt; F_arr[5][14] = -dt;
    // dOri / dGyroBias
    F_arr[6][9] = -dt; F_arr[7][10] = -dt; F_arr[8][11] = -dt;
    
    const F = matrix(F_arr);
    const Ft = transpose(F);
    
    // P = F * P * F^T + Q
    this.P = add(multiply(multiply(F, this.P), Ft), this.Q);
    
    // Update local variance tracking
    const pArr: any = this.P.toArray();
    this.varianceX = pArr[0][0];
    this.varianceY = pArr[1][1];
  }

  // Update step from 10Hz GNSS (Pos and Vel)
  public updateGNSS(px: number, py: number, pz: number, vx: number, vy: number, vz: number, R_diag: number[] = [0.5, 0.5, 1.0, 0.2, 0.2, 0.2]) {
    this.gnssActive = true;
    
    // Measurement vector Z is 6x1 (px, py, pz, vx, vy, vz)
    const Z = matrix([[px], [py], [pz], [vx], [vy], [vz]]);
    
    // Measurement function H is 6x15
    const H_arr = Array.from({length: 6}, () => new Array(15).fill(0));
    H_arr[0][0] = 1; H_arr[1][1] = 1; H_arr[2][2] = 1;
    H_arr[3][3] = 1; H_arr[4][4] = 1; H_arr[5][5] = 1;
    const H = matrix(H_arr);
    
    // Measurement noise R
    let R_arr = Array.from({length: 6}, () => new Array(6).fill(0));
    for (let i=0; i<6; i++) Object.assign(R_arr[i], { [i]: R_diag[i] });
    const R = matrix(R_arr);
    
    this._performEKFUpdate(Z, H, R);
  }

  // Update step from 30Hz Visual Odometry (Delta Pos or Velocity approximations)
  public updateVisualOdometry(vx: number, vy: number, vz: number) {
    // If GNSS is active, VO carries lower weight (higher noise R). If disabled, we rely on VO more heavily
    const noise = this.gnssActive ? 2.0 : 0.05;
    
    // Measurement Z is 3x1 (velocity from optical flow)
    const Z = matrix([[vx], [vy], [vz]]);
    
    // H is 3x15
    const H_arr = Array.from({length: 3}, () => new Array(15).fill(0));
    H_arr[0][3] = 1; H_arr[1][4] = 1; H_arr[2][5] = 1;
    const H = matrix(H_arr);
    
    // R is 3x3
    const R = matrix([
      [noise, 0, 0],
      [0, noise, 0],
      [0, 0, noise]
    ]);
    
    this._performEKFUpdate(Z, H, R);
  }

  // Common Kalman gain and state update formula
  private _performEKFUpdate(Z: any, H: any, R: any) {
    // y = Z - H * x  (Innovation)
    const y = subtract(Z, multiply(H, this.x));
    
    // S = H * P * H^T + R
    const Ht = transpose(H);
    const S = add(multiply(multiply(H, this.P), Ht), R);
    
    // K = P * H^T * S^-1  (Kalman Gain)
    const K = multiply(multiply(this.P, Ht), inv(S));
    
    // x = x + K * y
    this.x = add(this.x, multiply(K, y));
    
    // P = (I - K * H) * P
    this.P = multiply(subtract(this.I, multiply(K, H)), this.P);
  }
  
  public simulateDegradedGNSS() {
      this.gnssActive = false;
      // Without GNSS, positional variance naturally increases over time just by predicting,
      // mitigated heavily by the tight bounds of VO.
  }
}
