
import React, { useEffect, useRef, useState } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import GForceMeter from './widgets/GForceMeter';
import LiveAICoach from './widgets/LiveAICoach';
import { VehicleDynamics } from '../services/ATEngine';
import { TrackedPoint } from '../services/OpticalFlowProcessor';
import DigitalTapeRpm from './tachometers/DigitalTapeRpm';
import { KARAPIRO_CARTEL_LOGO_B64 } from '../logo';
import { Sliders, Activity, HelpCircle, Compass, Eye, Sparkles } from 'lucide-react';

const RaceCam: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    
    const [streamActive, setStreamActive] = useState(false);
    const latestData = useVehicleStore(state => state.latestData);
    const history = useVehicleStore(state => state.data);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    const processVisionFrame = useVehicleStore(state => state.processVisionFrame);
    const d = latestData;

    // Overlay Modes states
    const [showLanes, setShowLanes] = useState(true);
    const [showGhost, setShowGhost] = useState(true);
    const [showVectors, setShowVectors] = useState(true);
    const [showApex, setShowApex] = useState(true);
    const [showCompass, setShowCompass] = useState(true);
    const [showControls, setShowControls] = useState(false);

    // Calibration settings
    const [horizonYOffset, setHorizonYOffset] = useState(0);
    const [pacingGhostDist, setPacingGhostDist] = useState(25);
    const [cvSensitivity, setCvSensitivity] = useState(1.0);
    const [manualCurveOverride, setManualCurveOverride] = useState(0.0);

    // Cache of previous frame features for motion vector computation
    const prevFeaturesRef = useRef<Record<number, { x: number; y: number }>>({});
    // Sliding scroll pattern for dotted lane line animation
    const scrollOffsetRef = useRef(0);

    // Vision Processing Loop
    useEffect(() => {
        let animationFrameId: number;
        let lastProcess = 0;

        const loop = (time: number) => {
            if (videoRef.current && canvasRef.current && streamActive && !videoRef.current.paused) {
                
                // Limit processing rate to ~20 FPS for performance balance
                if (time - lastProcess > 50) { 
                    lastProcess = time;
                    
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true, desynchronized: true });
                    
                    if (ctx && video.videoWidth > 0) {
                        const width = 320;
                        const height = 240;
                        
                        if (canvas.width !== width) canvas.width = width;
                        if (canvas.height !== height) canvas.height = height;
                        
                        ctx.drawImage(video, 0, 0, width, height);
                        const imageData = ctx.getImageData(0, 0, width, height);
                        
                        // Send to Vision System
                        processVisionFrame(imageData).then(result => {
                            // Render Overlay (Features)
                            if (overlayRef.current && result.features) {
                                renderOverlay(overlayRef.current, result, width, height);
                            }
                        });
                    }
                }
            }
            
            if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
                animationFrameId = (videoRef.current as any).requestVideoFrameCallback(loop);
            } else {
                animationFrameId = requestAnimationFrame(loop);
            }
        };

        if (streamActive) {
            if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
                animationFrameId = (videoRef.current as any).requestVideoFrameCallback(loop);
            } else {
                animationFrameId = requestAnimationFrame(loop);
            }
        }

        return () => {
            if (videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
                (videoRef.current as any).cancelVideoFrameCallback(animationFrameId);
            } else {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [streamActive, processVisionFrame]);

    const renderOverlay = (canvas: HTMLCanvasElement, result: any, procW: number, procH: number) => {
        const ctx = canvas.getContext('2d', { desynchronized: true });
        if (!ctx || !videoRef.current) return;
        
        if (canvas.width !== videoRef.current.clientWidth || canvas.height !== videoRef.current.clientHeight) {
            canvas.width = videoRef.current.clientWidth;
            canvas.height = videoRef.current.clientHeight;
        }

        const scaleX = canvas.width / procW;
        const scaleY = canvas.height / procH;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const horizonY = canvas.height * 0.45 + horizonYOffset;
        const centerX = canvas.width / 2;

        // Perspective projecting function mapping real-world 3D (meters) to 2D Canvas pixels
        const project3D = (x3d: number, y3d: number, z3d: number) => {
            const F = 250; // Focal scale
            const projX = centerX + (x3d * F) / z3d;
            const projY = horizonY - (y3d * F) / z3d;
            const scale = F / z3d;
            return { x: projX, y: projY, scale };
        };

        // Road Curvature Prediction
        // curveFactor fuses actual EKF yaw rate, lateral acceleration, and simulated stationary diagnostic injection
        const activeYaw = ekfStats.fusedYawRate || (d.gForceX * 0.15) || 0;
        const curveFactor = (activeYaw * 0.4) + (manualCurveOverride * 0.6);

        // Curvature offset offset at distance Z
        const getRoadOffset = (z: number) => {
            return -curveFactor * Math.pow(z / 15, 1.8) * 4 * cvSensitivity;
        };

        // Draw 3D Winding Road perspective grid
        if (showLanes) {
            const numSteps = 16;
            const maxZ = 65;
            const leftLanePts: {x: number; y: number; scale: number}[] = [];
            const rightLanePts: {x: number; y: number; scale: number}[] = [];
            const centerLanePts: {x: number; y: number; scale: number}[] = [];
            const idealRacingPts: {x: number; y: number; scale: number}[] = [];

            for (let i = 0; i <= numSteps; i++) {
                const z = 3 + (i / numSteps) * (maxZ - 3);
                const roadOffset = getRoadOffset(z);
                
                // Standard Motorsports lane width: ~3.4 meters
                const leftX = -1.7 + roadOffset;
                const rightX = 1.7 + roadOffset;
                const centerX3D = 0.0 + roadOffset;
                
                // Ideal racing line curves slightly closer to entry apexes and flattens out
                const idealX = centerX3D - (curveFactor * 0.35 * Math.sin((z / maxZ) * Math.PI));

                leftLanePts.push(project3D(leftX, -1.0, z));
                rightLanePts.push(project3D(rightX, -1.0, z));
                centerLanePts.push(project3D(centerX3D, -1.0, z));
                idealRacingPts.push(project3D(idealX, -1.0, z));
            }

            // A. Draw Alternating Curbs (Rumble Strips) on left and right track boundaries
            for (let i = 0; i < leftLanePts.length - 1; i++) {
                const isRed = (i + Math.floor(Date.now() / 150)) % 2 === 0;
                ctx.strokeStyle = isRed ? '#EF4444' : '#FFFFFF';
                ctx.lineWidth = Math.max(1.5, leftLanePts[i].scale * 0.22);
                ctx.beginPath();
                ctx.moveTo(leftLanePts[i].x, leftLanePts[i].y);
                ctx.lineTo(leftLanePts[i+1].x, leftLanePts[i+1].y);
                ctx.stroke();

                ctx.strokeStyle = isRed ? '#FFFFFF' : '#EF4444';
                ctx.lineWidth = Math.max(1.5, rightLanePts[i].scale * 0.22);
                ctx.beginPath();
                ctx.moveTo(rightLanePts[i].x, rightLanePts[i].y);
                ctx.lineTo(rightLanePts[i+1].x, rightLanePts[i+1].y);
                ctx.stroke();
            }

            // B. Draw Scrolling Dotted Center lane at speed
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 16]);
            const speedCoeff = d.speed / 10;
            scrollOffsetRef.current = (scrollOffsetRef.current + speedCoeff) % 28;
            ctx.lineDashOffset = -scrollOffsetRef.current;
            ctx.beginPath();
            ctx.moveTo(centerLanePts[0].x, centerLanePts[0].y);
            for (let i = 1; i < centerLanePts.length; i++) {
                ctx.lineTo(centerLanePts[i].x, centerLanePts[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash

            // C. Draw glowing green/amber Optimal Racing Path
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = Math.abs(curveFactor) > 0.35 ? 'rgba(234, 179, 8, 0.7)' : 'rgba(34, 197, 94, 0.7)';
            ctx.beginPath();
            ctx.moveTo(idealRacingPts[0].x, idealRacingPts[0].y);
            for (let i = 1; i < idealRacingPts.length; i++) {
                ctx.lineTo(idealRacingPts[i].x, idealRacingPts[i].y);
            }
            ctx.stroke();
        }

        // Draw Holographic 3D wireframe Ghost Car & ribbon tyre trails
        if (showGhost) {
            // Place ghost car along optimal trajectory line offsetted ahead
            const ghostZ = pacingGhostDist + (d.speed * 0.08);
            const ghostRoadOffset = getRoadOffset(ghostZ);
            const ghostIdealX = ghostRoadOffset - (curveFactor * 0.35 * Math.sin((ghostZ / 65) * Math.PI));
            const ghostX3D = ghostIdealX;
            const ghostY3D = -0.92; // slightly elevated off ground planes

            // Vertices in localized relative spatial meters: Length 4.1m, Width 1.75m, Height 0.85m
            const carVertices = [
                { x: 0.0, y: 0.0, z: 2.05 },    // 0: Nose centerpiece
                { x: -0.85, y: -0.1, z: 2.05 },  // 1: Left Splitter Tip
                { x: 0.85, y: -0.1, z: 2.05 },   // 2: Right Splitter Tip
                { x: -0.85, y: 0.1, z: 0.8 },   // 3: Front Arch Left
                { x: 0.85, y: 0.1, z: 0.8 },    // 4: Front Arch Right
                { x: -0.5, y: 0.48, z: 0.0 },   // 5: Canopy Winshield Left
                { x: 0.5, y: 0.48, z: 0.0 },    // 6: Canopy Winshield Right
                { x: -0.5, y: 0.48, z: -0.95 },  // 7: Roof Back Left
                { x: 0.5, y: 0.48, z: -0.95 },   // 8: Roof Back Right
                { x: -0.85, y: 0.0, z: -1.8 },   // 9: Rear Arch Lower Left
                { x: 0.85, y: 0.0, z: -1.8 },    // 10: Rear Arch Lower Right
                { x: -0.85, y: 0.32, z: -1.9 },  // 11: Spoiler Endplate Left
                { x: 0.85, y: 0.32, z: -1.9 },   // 12: Spoiler Endplate Right
                { x: 0.0, y: 0.32, z: -1.9 },    // 13: Spoiler Midpoint
            ];

            // Rotation transformations corresponding to steering yaw lean and lateral drift
            const RotY = curveFactor * 0.72; // steer yaw angle
            const RotR = -d.gForceX * 0.14;   // body roll lean (centrifugal load transfer)

            const transformed = carVertices.map(v => {
                const cosY = Math.cos(RotY);
                const sinY = Math.sin(RotY);
                // Yaw rotate in local floor plane (X-Z)
                const rxz_x = v.x * cosY - v.z * sinY;
                const rxz_z = v.x * sinY + v.z * cosY;

                // Roll rotate in transverse tilt frame (X-Y)
                const cosR = Math.cos(RotR);
                const sinR = Math.sin(RotR);
                const rxy_x = rxz_x * cosR - v.y * sinR;
                const rxy_y = rxz_x * sinR + v.y * cosR;

                return { x: rxy_x, y: rxy_y, z: rxz_z };
            });

            // Project calculated 3D points down perspective camera frustum
            const projectedGrid = transformed.map(v => {
                return project3D(ghostX3D + v.x, ghostY3D + v.y, ghostZ + v.z);
            });

            // Structural edges of GT racer body wireframe
            const edgeMone = [
                [0, 1], [0, 2], [1, 2], // Splitter bumper
                [1, 3], [2, 4],         // Front fender arches
                [3, 4],                 // Hood boundary
                [3, 5], [4, 6],         // Low A-pillars
                [5, 6],                 // Cockpit crossbar
                [5, 7], [6, 8],         // Side windows
                [7, 8],                 // Rear window edge
                [7, 11], [8, 12],       // Dynamic C-pillars
                [9, 11], [10, 12],      // Fenders to taillights
                [11, 13], [12, 13],     // Air spoiler foil
                [1, 9], [2, 10],        // Lower rocker panel frames
                [9, 10]                 // Chassis diffuser boundary
            ];

            // A. Render Neon Ground-Effect Halo under ghost car
            const g1 = projectedGrid[1];
            const g2 = projectedGrid[2];
            const g10 = projectedGrid[10];
            const g9 = projectedGrid[9];
            ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
            ctx.beginPath();
            ctx.moveTo(g1.x, g1.y);
            ctx.lineTo(g2.x, g2.y);
            ctx.lineTo(g10.x, g10.y);
            ctx.lineTo(g9.x, g9.y);
            ctx.closePath();
            ctx.fill();

            // B. Draw tire paths scrolling backwards behind it
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.24)';
            ctx.lineWidth = Math.max(1.0, 110 / ghostZ);
            
            // Left Wheel path ribbon
            ctx.beginPath();
            let startL = project3D(ghostX3D - 0.82, -1.0, ghostZ - 1.2);
            ctx.moveTo(startL.x, startL.y);
            for (let rz = 1.2; rz < 18; rz += 2) {
                const ro = getRoadOffset(ghostZ - rz);
                const p = project3D(ro - 0.82, -1.0, ghostZ - rz);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // Right Wheel path ribbon
            ctx.beginPath();
            let startR = project3D(ghostX3D + 0.82, -1.0, ghostZ - 1.2);
            ctx.moveTo(startR.x, startR.y);
            for (let rz = 1.2; rz < 18; rz += 2) {
                const ro = getRoadOffset(ghostZ - rz);
                const p = project3D(ro + 0.82, -1.0, ghostZ - rz);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // C. Draw wireframe skeleton
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)'; // brand-pink
            ctx.lineWidth = Math.max(1.2, 130 / ghostZ);
            edgeMone.forEach(([f, t]) => {
                const pt1 = projectedGrid[f];
                const pt2 = projectedGrid[t];
                if (pt1.y > 0 && pt2.y > 0) {
                    ctx.beginPath();
                    ctx.moveTo(pt1.x, pt1.y);
                    ctx.lineTo(pt2.x, pt2.y);
                    ctx.stroke();
                }
            });

            // D. Vertices telemetry beacons
            ctx.fillStyle = '#f43f5e';
            projectedGrid.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, Math.max(2, pt.scale * 0.12), 0, Math.PI * 2);
                ctx.fill();
            });

            // E. tyre hub projections
            ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
            const tyresLoc = [
                { x: -0.85, y: -0.25, z: 1.1 },
                { x: 0.85, y: -0.25, z: 1.1 },
                { x: -0.85, y: -0.25, z: -1.1 },
                { x: 0.85, y: -0.25, z: -1.1 }
            ];
            tyresLoc.forEach(tl => {
                // local transforms
                const cosY = Math.cos(RotY);
                const sinY = Math.sin(RotY);
                const lx = tl.x * cosY - tl.z * sinY;
                const lz = tl.x * sinY + tl.z * cosY;

                const cosR = Math.cos(RotR);
                const sinR = Math.sin(RotR);
                const rx = lx * cosR - tl.y * sinR;
                const ry = lx * sinR + tl.y * cosR;

                const pt = project3D(ghostX3D + rx, ghostY3D + ry, ghostZ + lz);
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, Math.max(3, pt.scale * 0.16), 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Target and lock Corner clipping Apex point
        if (showApex) {
            const apexZ = 32;
            const isTurnLeft = curveFactor > 0.05;
            const apexOffsetVal = getRoadOffset(apexZ);
            // Apex hugs left margin on a left corner, right on a right corner
            const apexX = apexOffsetVal + (curveFactor < 0 ? 1.62 : -1.62);
            
            const pApex = project3D(apexX, -1.0, apexZ);
            const sz = Math.max(14, 280 / apexZ);

            ctx.strokeStyle = '#F59E0B'; // neon amber
            ctx.lineWidth = 1.6;
            
            // Draw visual high-precision corner brackets
            ctx.beginPath();
            // Top Left corner bracket
            ctx.moveTo(pApex.x - sz, pApex.y - sz/2); ctx.lineTo(pApex.x - sz, pApex.y - sz); ctx.lineTo(pApex.x - sz/2, pApex.y - sz);
            // Top Right bracket
            ctx.moveTo(pApex.x + sz/2, pApex.y - sz); ctx.lineTo(pApex.x + sz, pApex.y - sz); ctx.lineTo(pApex.x + sz, pApex.y - sz/2);
            // Bottom Left bracket
            ctx.moveTo(pApex.x - sz, pApex.y + sz/2); ctx.lineTo(pApex.x - sz, pApex.y + sz); ctx.lineTo(pApex.x - sz/2, pApex.y + sz);
            // Bottom Right bracket
            ctx.moveTo(pApex.x + sz/2, pApex.y + sz); ctx.lineTo(pApex.x + sz, pApex.y + sz); ctx.lineTo(pApex.x + sz, pApex.y + sz/2);
            ctx.stroke();

            // Outer pulse scan halo
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)';
            ctx.beginPath();
            ctx.arc(pApex.x, pApex.y, sz * (1.18 + 0.28 * Math.sin(Date.now() / 180)), 0, Math.PI * 2);
            ctx.stroke();

            // Telemetry overlay labels centered beside it
            ctx.fillStyle = '#F59E0B';
            ctx.font = 'bold 8.5px JetBrains Mono, monospace';
            ctx.fillText(`APX_LOCK: ${Math.abs(curveFactor) > 0.06 ? 'CONNECTED' : 'STANDBY'}`, pApex.x + sz + 6, pApex.y - 3);
            ctx.fillText(`RANGE: ${apexZ}m`, pApex.x + sz + 6, pApex.y + 6);
            ctx.fillText(`ARC_SPD: ${(d.speed * 0.88 + 4).toFixed(0)}kmh`, pApex.x + sz + 6, pApex.y + 15);
        }

        // Draw Gyro balance and Artificial Horizon LEVEL indicators
        if (showCompass) {
            const rollAngle = -d.gForceX * 0.11;
            const tiltWidth = canvas.width / 2.5;
            const tiltOffset = Math.sin(rollAngle) * tiltWidth;

            ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)'; // Brand purple level
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(centerX - tiltWidth, horizonY + tiltOffset);
            ctx.lineTo(centerX + tiltWidth, horizonY - tiltOffset);
            ctx.stroke();
            ctx.setLineDash([]);

            // Pitch central ringlet indicators
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            // Left winglet indicator
            ctx.moveTo(centerX - 35, horizonY);
            ctx.lineTo(centerX - 12, horizonY);
            ctx.lineTo(centerX - 12, horizonY + 6);
            // Right winglet
            ctx.moveTo(centerX + 35, horizonY);
            ctx.lineTo(centerX + 12, horizonY);
            ctx.lineTo(centerX + 12, horizonY + 6);
            ctx.stroke();
            
            // Central horizon bubble
            ctx.beginPath();
            ctx.arc(centerX, horizonY, 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw Optical Flow Features and motion direction vectors
        const points: TrackedPoint[] = result.features;

        points.forEach(p => {
            const x = p.x * scaleX;
            const y = p.y * scaleY;
            
            // Look up point's location during previous frame to draw speed vectors
            const prev = prevFeaturesRef.current[p.id];
            if (showVectors && prev) {
                const prevX = prev.x * scaleX;
                const prevY = prev.y * scaleY;
                const dx = x - prevX;
                const dy = y - prevY;
                const mag = Math.sqrt(dx*dx + dy*dy);

                if (mag > 0.4 && mag < 45) {
                    // Color code vectors based on intensity to highlight shear and slip
                    ctx.strokeStyle = mag > 10.0 ? '#EF4444' : 'rgba(0, 240, 255, 0.75)';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(x, y);
                    ctx.stroke();

                    // Arrow tip
                    ctx.fillStyle = mag > 10.0 ? '#EF4444' : 'rgba(0, 240, 255, 0.75)';
                    ctx.beginPath();
                    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Standard minimal crosshair to maintain neural vision locked overlay aesthetic
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x - 3, y);
            ctx.lineTo(x + 3, y);
            ctx.moveTo(x, y - 3);
            ctx.lineTo(x, y + 3);
            ctx.stroke();
        });

        // Store current points inside state ref for the next frame's motion analysis
        const currentRecords: Record<number, { x: number; y: number }> = {};
        points.forEach(p => {
            currentRecords[p.id] = { x: p.x, y: p.y };
        });
        prevFeaturesRef.current = currentRecords;
        
        // Vision HUD Text Info Board
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.roundRect(20, 20, 280, 60, 8);
        ctx.fill();
        
        ctx.fillStyle = '#00F0FF';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`NEURAL_VIS_LOCKED: ${points.length} FEATURE_NODES`, 35, 40);
        
        if (result.slipAngle !== undefined) {
            ctx.fillStyle = '#EAB308';
            ctx.fillText(`VIS_SLIP: ${result.slipAngle.toFixed(2)}°`, 35, 55);
        }
        if (result.yawRate !== undefined) {
            ctx.fillStyle = '#A855F7';
            ctx.fillText(`VIS_YAW: ${result.yawRate.toFixed(2)} rad/s`, 150, 55);
        }
    };

    useEffect(() => {
        let localStream: MediaStream | null = null;
        let isActive = true;

        const startCamera = async () => {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        facingMode: "environment" 
                    }, 
                    audio: false 
                });
                
                if (isActive && videoRef.current && localStream) {
                    videoRef.current.srcObject = localStream;
                    try {
                        await videoRef.current.play();
                        if (isActive) setStreamActive(true);
                    } catch (playErr: any) {
                        if (playErr.name !== 'AbortError') {
                            console.error("Video play failed:", playErr);
                        }
                        if (isActive) setStreamActive(true);
                    }
                }
            } catch (err) {
                if (isActive) {
                    console.error("Camera access denied or unavailable:", err);
                    setStreamActive(false);
                }
            }
        };

        startCamera();

        return () => {
            isActive = false;
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const rpmPercent = Math.min(100, Math.max(0, (d.rpm / 8500) * 100));
    const isRedline = d.rpm > 7200;
    const throttlePct = d.engineLoad;
    const brakePct = d.gForceY < -0.2 ? Math.min(100, Math.abs(d.gForceY) * 90) : 0;

    return (
        <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center font-sans" id="racecam-root">
            
            {/* 1. Video Layer */}
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-1000 ${streamActive ? 'opacity-100' : 'opacity-0'}`}
                id="racecam-video-feed"
            />
            
            {/* Processing Layer (Hidden) */}
            <canvas ref={canvasRef} className="hidden" id="racecam-processing-canvas" />
            
            {/* Optical Flow Layer */}
            <canvas 
                ref={overlayRef} 
                className="absolute inset-0 w-full h-full z-1 pointer-events-none mix-blend-screen"
                id="racecam-overlay-canvas"
            />

            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none z-5"></div>

            {/* 2. Interactive Telemetry Command / Calibration Panel */}
            <div className="absolute top-4 left-4 z-50 flex flex-col items-start pointer-events-auto" id="cv-commands-wrapper">
                <div className={`bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 shadow-2xl flex flex-col gap-3 min-w-[280px] max-w-[320px] mb-2 ${showControls ? 'scale-100 opacity-100' : 'scale-95 opacity-0 select-none hidden pointer-events-none'}`}>
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2 text-brand-cyan text-xs font-black tracking-widest uppercase">
                            <Activity className="w-4 h-4 animate-pulse text-brand-cyan" />
                            <span>CV COCKPIT LABS</span>
                        </div>
                        <button 
                            onClick={() => setShowControls(false)}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            title="Close HUD controls"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* OVERLAYS TOGGLER */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[8.5px] font-black tracking-wider text-gray-400 uppercase">Interactive Layers</span>
                        
                        <label className="flex items-center justify-between cursor-pointer group bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-brand-cyan/20">
                            <span className="text-[10px] text-gray-300 font-mono flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${showLanes ? 'bg-[#00F0FF]' : 'bg-gray-600'}`}></div>
                                TRK_LANES (3D Grid)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={showLanes} 
                                onChange={(e) => setShowLanes(e.target.checked)} 
                                className="sr-only peer"
                            />
                            <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center ${showLanes ? 'bg-[#00F0FF]' : 'bg-gray-700'}`}>
                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-all border border-black/20 ${showLanes ? 'left-[15px]' : 'left-[1px]'}`}></div>
                            </div>
                        </label>

                        <label className="flex items-center justify-between cursor-pointer group bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-brand-purple/25">
                            <span className="text-[10px] text-gray-300 font-mono flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${showGhost ? 'bg-pink-500' : 'bg-gray-600'}`}></div>
                                GHOST_PACE (Wireframe)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={showGhost} 
                                onChange={(e) => setShowGhost(e.target.checked)} 
                                className="sr-only peer"
                            />
                            <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center ${showGhost ? 'bg-pink-500' : 'bg-gray-700'}`}>
                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-all border border-black/20 ${showGhost ? 'left-[15px]' : 'left-[1px]'}`}></div>
                            </div>
                        </label>

                        <label className="flex items-center justify-between cursor-pointer group bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-emerald-500/25">
                            <span className="text-[10px] text-gray-300 font-mono flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${showVectors ? 'bg-emerald-400' : 'bg-gray-600'}`}></div>
                                FLOW_VECTORS (Flow)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={showVectors} 
                                onChange={(e) => setShowVectors(e.target.checked)} 
                                className="sr-only peer"
                            />
                            <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center ${showVectors ? 'bg-emerald-400' : 'bg-gray-700'}`}>
                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-all border border-black/20 ${showVectors ? 'left-[15px]' : 'left-[1px]'}`}></div>
                            </div>
                        </label>

                        <label className="flex items-center justify-between cursor-pointer group bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-amber-500/25">
                            <span className="text-[10px] text-gray-300 font-mono flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${showApex ? 'bg-amber-400' : 'bg-gray-600'}`}></div>
                                APX_LOCK (Target HUD)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={showApex} 
                                onChange={(e) => setShowApex(e.target.checked)} 
                                className="sr-only peer"
                            />
                            <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center ${showApex ? 'bg-amber-400' : 'bg-gray-700'}`}>
                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-all border border-black/20 ${showApex ? 'left-[15px]' : 'left-[1px]'}`}></div>
                            </div>
                        </label>

                        <label className="flex items-center justify-between cursor-pointer group bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-purple-500/25">
                            <span className="text-[10px] text-gray-300 font-mono flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${showCompass ? 'bg-purple-500' : 'bg-gray-600'}`}></div>
                                HEADING_GYRO (Level)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={showCompass} 
                                onChange={(e) => setShowCompass(e.target.checked)} 
                                className="sr-only peer"
                            />
                            <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center ${showCompass ? 'bg-purple-500' : 'bg-gray-700'}`}>
                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-all border border-black/20 ${showCompass ? 'left-[15px]' : 'left-[1px]'}`}></div>
                            </div>
                        </label>
                    </div>

                    {/* ALIGNMENT & HORIZON TRIM */}
                    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 text-[8.5px]">
                        <span className="font-mono font-black text-gray-400 uppercase">Trim Calibration</span>
                        
                        <div className="flex flex-col gap-1 bg-white/5 p-1.5 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center text-[8.5px] font-mono text-gray-300 font-bold">
                                <span>Horizon alignment</span>
                                <span className="text-brand-cyan">{horizonYOffset > 0 ? `+${horizonYOffset}` : horizonYOffset}px</span>
                            </div>
                            <input 
                                type="range" 
                                min="-60" 
                                max="60" 
                                value={horizonYOffset} 
                                onChange={(e) => setHorizonYOffset(parseInt(e.target.value))} 
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                            />
                        </div>

                        <div className="flex flex-col gap-1 bg-white/5 p-1.5 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center text-[8.5px] font-mono text-gray-300 font-bold">
                                <span>Ghost pace delta</span>
                                <span className="text-pink-400">{pacingGhostDist}m</span>
                            </div>
                            <input 
                                type="range" 
                                min="10" 
                                max="45" 
                                value={pacingGhostDist} 
                                onChange={(e) => setPacingGhostDist(parseInt(e.target.value))} 
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                            />
                        </div>

                        <div className="flex flex-col gap-1 bg-white/5 p-1.5 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center text-[8.5px] font-mono text-gray-300 font-bold">
                                <span>Vision Sensitivity</span>
                                <span className="text-emerald-400">{cvSensitivity.toFixed(2)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="2.0" 
                                step="0.1" 
                                value={cvSensitivity} 
                                onChange={(e) => setCvSensitivity(parseFloat(e.target.value))} 
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                            />
                        </div>
                    </div>

                    {/* STEER OVERRIDE DEMO */}
                    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 text-[8.5px]">
                        <div className="flex items-center gap-1">
                            <span className="font-mono font-black text-gray-400 uppercase">Stationary Injector Model</span>
                            <div className="group relative">
                                <HelpCircle className="w-3 h-3 text-gray-500 hover:text-white cursor-pointer" />
                                <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block bg-black/95 text-gray-300 text-[8.5px] p-2 rounded border border-white/10 w-44 z-50 leading-normal">
                                    Simulate dynamic cornering and skid yaw rate directly to inspect real-time perspective curvature of lanes.
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 bg-white/5 p-1.5 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center text-[8.5px] font-mono text-gray-300 font-bold">
                                <span>Simulate curves</span>
                                <span className={`font-mono text-[9px] ${manualCurveOverride > 0 ? 'text-amber-500 font-black' : manualCurveOverride < 0 ? 'text-purple-500 font-black' : 'text-gray-500'}`}>
                                    {manualCurveOverride === 0 ? 'No Curve' : manualCurveOverride > 0 ? 'Curve L' : 'Curve R'}
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="-1.0" 
                                max="1.0" 
                                step="0.1" 
                                value={manualCurveOverride} 
                                onChange={(e) => setManualCurveOverride(parseFloat(e.target.value))} 
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <button 
                                onClick={() => setManualCurveOverride(0)}
                                className="text-[8px] bg-white/10 hover:bg-white/20 text-white font-mono py-0.5 px-2 rounded mt-1 select-none transition-all"
                            >
                                CLEAR STIMULUS
                            </button>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setShowControls(prev => !prev)}
                    className="bg-black/85 hover:bg-brand-cyan/20 backdrop-blur-md border border-white/15 h-10 w-10 flex items-center justify-center rounded-2xl cursor-pointer shadow-lg hover:shadow-cyan-glow transition-all duration-300 transform"
                    id="trigger-hud-labs"
                    title="Toggle CV overlay laboratory modes"
                >
                    <Sliders className={`w-4.5 h-4.5 text-brand-cyan transition-transform duration-300 ${showControls ? 'rotate-90' : ''}`} />
                </button>
            </div>

            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none z-5" id="cine-shade"></div>

            {/* 3. MOTORSPORT OVERLAY HUB */}
            <div className="absolute inset-0 z-10 pointer-events-none p-10 flex flex-col justify-between" id="hud-overlay-container">
                
                {/* Top Section */}
                <div className="flex justify-between items-start relative w-full" id="hud-top-bar">
                    <div className="flex flex-col gap-1 z-10" id="session-timer-group">
                        <div className="bg-black/70 backdrop-blur-xl border-l-4 border-brand-cyan px-6 py-3 skew-x-[-12deg] shadow-2xl">
                            <div className="skew-x-[12deg] flex flex-col">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-1">Session Timer</span>
                                <span className="text-4xl font-mono font-bold text-white tracking-tighter leading-none">
                                    {d.speed > 5 ? "1:24.08" : "--:--.--"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 px-2">
                            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-glow-red"></div>
                            <span className="text-[9px] font-mono font-bold text-white uppercase tracking-widest">TrackCam Recording</span>
                        </div>
                    </div>

                    {/* Holographic Watermark Signature of Karapiro Logo */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 select-none" id="watermark-container">
                        <div className="holo-container relative flex flex-col items-center px-6 py-2 rounded-lg border border-brand-cyan/20 overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.05)] scale-90 md:scale-100">
                            {/* Horizontal Scanline bar */}
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-cyan/70 shadow-[0_0_8px_#00F0FF] animate-holo-scan"></div>
                            <img 
                                src={KARAPIRO_CARTEL_LOGO_B64} 
                                alt="Karapiro Cartel Signature" 
                                className="h-10 w-auto opacity-75 filter drop-shadow-[0_0_4px_rgba(0,240,255,0.3)] animate-holo-glow"
                                referrerPolicy="no-referrer"
                            />
                            <div className="text-[7.5px] font-mono tracking-[0.4em] text-brand-cyan/60 uppercase mt-0.5 animate-pulse">
                                SECURE TELEMETRY FEED // WATERMARK
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 z-10" id="delta-display-group">
                        <div className="bg-black/70 backdrop-blur-xl border-r-4 border-brand-purple px-6 py-3 skew-x-[12deg] shadow-2xl">
                             <div className="skew-x-[-12deg] flex flex-col items-end">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-1">Delta / Ghost</span>
                                <span className="text-3xl font-mono font-bold text-green-500 tracking-tighter leading-none">-0.342<span className="text-xs ml-1 font-sans">s</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Core Dashboard */}
                <div className="flex items-end justify-between gap-10" id="hud-bottom-shelf">
                    
                    {/* Left: Dynamic Chassis Monitor */}
                    <div className="flex flex-col gap-6 items-center w-40 mb-2" id="chassis-monitor-panel">
                         <div className="w-36 h-36 bg-black/60 backdrop-blur-md rounded-full border border-white/10 p-2 shadow-2xl relative">
                            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                                <svg viewBox="0 0 100 100" className="w-16 h-16 stroke-white fill-none stroke-2">
                                    <path d="M 20 80 L 20 60 C 20 50, 30 40, 40 40 L 70 40 C 80 40, 80 20, 70 20 L 50 20" />
                                </svg>
                            </div>
                            <div className="scale-75 origin-center">
                                <GForceMeter x={d.gForceX} y={d.gForceY} speedKph={d.speed} yawRate={ekfStats.fusedYawRate} size={150} transparent />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2" id="forces-labels-rack">
                            <div className="bg-black/80 backdrop-blur px-4 py-1.5 rounded-full border border-white/10 flex justify-center">
                                <span className="text-[9px] font-mono font-bold text-gray-400 tracking-widest uppercase">LAT: {d.gForceX.toFixed(2)}G</span>
                            </div>
                            <div className="bg-black/80 backdrop-blur px-4 py-1.5 rounded-full border border-white/10 flex justify-center">
                                <span className="text-[9px] font-mono font-bold text-yellow-500 tracking-widest uppercase">SLIP (EST): {Math.abs(VehicleDynamics.estimateSlipAngle(d.gForceX, d.speed)).toFixed(1)}°</span>
                            </div>
                            {ekfStats.visionSlipAngle !== undefined && (
                                <div className="bg-black/80 backdrop-blur px-4 py-1.5 rounded-full border border-brand-cyan/30 flex justify-center">
                                    <span className="text-[9px] font-mono font-bold text-brand-cyan tracking-widest uppercase">SLIP (VIS): {Math.abs(ekfStats.visionSlipAngle).toFixed(1)}°</span>
                                </div>
                            )}
                            {ekfStats.fusedYawRate !== undefined && (
                                <div className="bg-black/80 backdrop-blur px-4 py-1.5 rounded-full border border-purple-500/30 flex justify-center">
                                    <span className="text-[9px] font-mono font-bold text-purple-400 tracking-widest uppercase">YAW (FUSED): {ekfStats.fusedYawRate.toFixed(2)} rad/s</span>
                                </div>
                            )}
                            {d.brakeTemp !== undefined && (
                                <div className="bg-black/80 backdrop-blur px-4 py-1.5 rounded-full border border-red-500/30 flex justify-center">
                                    <span className={`text-[9px] font-mono font-bold tracking-widest uppercase ${d.brakeTemp > 600 ? 'text-red-500 animate-pulse' : 'text-orange-400'}`}>
                                        BRK TMP: {d.brakeTemp.toFixed(0)}°C
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: High-BW Telemetry Cluster */}
                    <div className="flex-1 flex flex-col items-center mb-2" id="telemetry-cluster-center">
                        
                        {/* Tape Style RPM Gauge */}
                        <div className="w-full max-w-2xl bg-black/80 backdrop-blur-xl border border-white/10 rounded-t-[32px] relative overflow-hidden shadow-2xl">
                            <DigitalTapeRpm max={8500} redline={7200} className="w-full !h-16 bg-[#050505]/40 backdrop-blur-md border-none rounded-t-[32px] overflow-hidden" />
                        </div>

                        {/* Primary Interaction Box */}
                        <div className="w-full max-w-xl flex bg-black/90 backdrop-blur-2xl border-x border-b border-white/20 rounded-b-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                            {/* Gear Selection (Aggressive Style) */}
                            <div className="w-1/3 flex items-center justify-center border-r border-white/10 p-4 bg-gradient-to-r from-brand-cyan/20 via-brand-cyan/5 to-transparent">
                                <span className="text-9xl font-display font-black text-white italic tracking-tighter" style={{ textShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
                                    {d.gear === 0 ? 'N' : d.gear}
                                </span>
                            </div>

                            {/* Velocity Readout */}
                            <div className="flex-1 flex flex-col items-center justify-center p-4">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-8xl font-display font-black text-white tracking-tighter leading-none drop-shadow-glow-cyan">
                                        {d.speed.toFixed(0)}
                                    </span>
                                    <span className="text-brand-cyan font-display font-bold text-sm tracking-[0.2em] uppercase italic opacity-70">kmh</span>
                                </div>
                                <div className="w-24 h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                                    <div className="h-full bg-brand-cyan" style={{ width: `${(d.speed/250)*100}%` }}></div>
                                </div>
                            </div>

                            {/* Inputs (Throttle / Brake) */}
                            <div className="w-1/4 flex gap-4 p-8 items-end justify-center">
                                {/* Throttle Bar */}
                                <div className="flex flex-col items-center h-full w-4 gap-2">
                                    <div className="flex-1 w-full bg-white/5 rounded-full relative overflow-hidden border border-white/5">
                                        <div className="absolute bottom-0 left-0 right-0 bg-green-500 transition-all duration-75 shadow-[0_0_15px_#22c55e]" style={{ height: `${throttlePct}%` }}></div>
                                    </div>
                                    <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter">THR</span>
                                </div>
                                {/* Brake Bar */}
                                <div className="flex flex-col items-center h-full w-4 gap-2">
                                    <div className="flex-1 w-full bg-white/5 rounded-full relative overflow-hidden border border-white/5">
                                        <div className="absolute bottom-0 left-0 right-0 bg-red-600 transition-all duration-75 shadow-[0_0_15px_#dc2626]" style={{ height: `${brakePct}%` }}></div>
                                    </div>
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">BRK</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Sector Splits & AI Insight */}
                    <div className="flex flex-col gap-2 w-64 mb-2" id="timing-splits-column">
                        <div className="bg-black/80 backdrop-blur-md px-4 py-2 flex justify-between items-center border-l-4 border-brand-purple rounded-r-lg shadow-xl group">
                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest group-hover:text-white transition-colors">Sector 1</span>
                            <span className="font-mono text-base font-bold text-brand-purple">24.505</span>
                        </div>
                        <div className="bg-black/80 backdrop-blur-md px-4 py-2 flex justify-between items-center border-l-4 border-green-500 rounded-r-lg shadow-xl group">
                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest group-hover:text-white transition-colors">Sector 2</span>
                            <span className="font-mono text-base font-bold text-green-500">31.200</span>
                        </div>
                        <div className="bg-black/80 backdrop-blur-md px-4 py-2 flex justify-between items-center border-l-4 border-white/20 rounded-r-lg shadow-xl">
                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Sector 3</span>
                            <span className="font-mono text-base font-bold text-white/30">--.---</span>
                        </div>
                        
                        {/* Live AI Coach */}
                        <div className="mt-4" id="ai-coaching-box">
                             <LiveAICoach />
                        </div>
                    </div>

                </div>
            </div>
            
            <style>{`
                .shadow-glow-red { box-shadow: 0 0 15px rgba(220, 38, 38, 0.4); }
                .drop-shadow-glow-cyan { filter: drop-shadow(0 0 20px rgba(0, 240, 255, 0.5)); }
                
                @keyframes holo-scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 0.8; }
                    90% { opacity: 0.8; }
                    100% { top: 100%; opacity: 0; }
                }
                @keyframes holo-glow {
                    0%, 100% {
                        filter: drop-shadow(0 0 4px rgba(0, 240, 255, 0.3)) saturate(0.9);
                        opacity: 0.7;
                        transform: scale(0.99) skewX(0.5deg);
                    }
                    50% {
                        filter: drop-shadow(0 0 12px rgba(0, 240, 255, 0.7)) saturate(1.3);
                        opacity: 0.9;
                        transform: scale(1.01) skewX(-0.5deg);
                    }
                }
                .animate-holo-scan {
                    animation: holo-scan 4s linear infinite;
                }
                .animate-holo-glow {
                    animation: holo-glow 3s ease-in-out infinite;
                }
                .holo-container {
                    background: linear-gradient(rgba(18, 16, 16, 0.15) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(239, 68, 68, 0.04), rgba(34, 197, 94, 0.02), rgba(59, 130, 246, 0.04));
                    background-size: 100% 4px, 4px 100%;
                }
            `}</style>
        </div>
    );
};

export default RaceCam;
