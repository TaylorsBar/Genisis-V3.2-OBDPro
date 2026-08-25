# ==================================================================================================
# PROPRIETARY IP: FlashManager (The Master Orchestrator)
# ==================================================================================================

import os
import json
import time
import logging
from datetime import datetime, timezone
from .flash_processor import ProductionFlashProcessor
from .integrity import IntegrityManager
from .physics import PhysicsKernel
from .drivers.j2534_driver import J2534Driver
from .isotp import IsoTpLayer

class SafetyViolationError(Exception):
    pass

class SecurityError(Exception):
    pass

class IntegrityError(Exception):
    pass

AUDIT_LOG_PATH = "flash_safety_audit.log"

def log_flash_audit_event(event_type: str, tune_config: dict, report: dict, success: bool):
    """
    Append-only audit log writer for safety gate decisions.
    """
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "success": success,
        "status": report.get("status", "UNKNOWN"),
        "critical_violations": report.get("critical_violations", []),
        "advisories": report.get("advisories", []),
        "tune_config_summary": {
            "max_egt": tune_config.get("max_egt") if isinstance(tune_config, dict) else None,
            "knock_buffer": tune_config.get("knock_buffer") if isinstance(tune_config, dict) else None,
            "has_ignition_map": "ignition_map" in tune_config if isinstance(tune_config, dict) else False,
        }
    }
    try:
        with open(AUDIT_LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        logging.error(f"Failed to write flash audit log: {e}")


class FlashManager:
    def __init__(self, secret_key: bytes, dll_path: str):
        self.driver = J2534Driver(dll_path)
        self.integrity = IntegrityManager(secret_key)
        self.physics = PhysicsKernel() # The Digital Twin
        self.processor = ProductionFlashProcessor(self.driver)
        
    async def execute_flash_workflow(self, tune_config: dict, binary_payload: bytes, ui_callback, ecu_variant: str = None):
        """
        The end-to-end pipeline: Simulation -> Security -> Transfer -> Verification.
        """
        await ui_callback(2, "Initializing Flash Sequence...")
        
        # STEP 1: Digital Twin Validation (The Gatekeeper)
        await ui_callback(5, "Running Digital Twin Safety Simulation...")
        is_safe, report = self.physics.validate_tuning(tune_config)
        
        # Log event to append-only audit log
        log_flash_audit_event("FLASH_SAFETY_GATE", tune_config, report, is_safe)

        if not is_safe:
            violations_str = "; ".join(report.get("critical_violations", ["Safety validation failed"]))
            raise SafetyViolationError(f"Digital Twin blocked flash: {violations_str}")

        if report.get("advisories"):
            advisories_str = "; ".join(report["advisories"])
            await ui_callback(7, f"Advisory Warning: {advisories_str}")

        # STEP 2: Hardware Connection & Security
        await ui_callback(8, "Connecting to ECU via J2534 (ISO15765)...")
        self.driver.connect(protocol="ISO15765")
        
        # Determine ECU variant for UDS $27 Seed/Key derivation
        target_variant = ecu_variant or (tune_config.get("ecu_variant") if isinstance(tune_config, dict) else None) or (tune_config.get("variant") if isinstance(tune_config, dict) else None) or "INFINITI_G25"

        # Request Seed and Send Key (UDS $27)
        await ui_callback(10, "Requesting Security Seed (UDS 0x27 01)...")
        seed = await self.processor.request_seed()
        
        await ui_callback(12, f"Calculating Security Key for variant [{target_variant}]...")
        key = self.integrity.calculate_key(seed, variant=target_variant)
        
        await ui_callback(15, "Sending Security Key (UDS 0x27 02)...")
        if not await self.processor.verify_key(key):
            raise SecurityError("ECU Security Handshake Failed.")

        # STEP 3: Block Transfer with ISO-TP Fragmentation
        await self.processor.transfer_data(
            binary_payload, 
            start_address=0x42000, 
            on_progress=ui_callback
        )

        # STEP 4: Final Integrity Check & Reset
        await ui_callback(90, "Calculating Global HMAC for Verification...")
        hmac_val = self.integrity.calculate_global_hmac(binary_payload)
        
        await ui_callback(95, "Verifying Final Checksum (UDS 0x31)...")
        if not await self.processor.verify_final_checksum(hmac_val):
            raise IntegrityError("Final HMAC verification failed. Flash corrupted.")

        await ui_callback(98, "Issuing ECU Hard Reset (UDS 0x11 01)...")
        await self.processor.ecu_reset()
        
        self.driver.disconnect()
        await ui_callback(100, "Flash Completed Successfully.")
        return True
