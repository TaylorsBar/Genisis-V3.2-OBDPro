import math
from typing import Dict, Any, List, Tuple, Optional

class SafetyLayer:
    MAX_EGT = 950.0  # °C
    ADVISORY_EGT = 900.0  # °C
    KNOCK_BUFFER = 1.0  # °
    MAX_CELL_DELTA = 5.0  # °

    @classmethod
    def enforce_constraints(
        cls,
        trial_timing: float,
        baseline_val: float,
        safe_knock_ceiling: float,
        predicted_egt: float,
        max_egt: float = 950.0
    ) -> Dict[str, Any]:

        # 1. EGT Hard Ceiling
        if predicted_egt > max_egt:
            return {
                "approved": False,
                "requires_advisory_confirmation": False,
                "reason": "EGT_HARD_CEILING"
            }

        # 2. EGT Advisory Zone
        requires_advisory = predicted_egt > cls.ADVISORY_EGT

        # 3. Cell Delta Violation
        if abs(trial_timing - baseline_val) > cls.MAX_CELL_DELTA:
            return {
                "approved": False,
                "requires_advisory_confirmation": False,
                "reason": "MAX_CELL_DELTA_VIOLATION"
            }

        # 4. Knock Buffer Violation
        if trial_timing >= (safe_knock_ceiling - cls.KNOCK_BUFFER):
            return {
                "approved": False,
                "requires_advisory_confirmation": False,
                "reason": "KNOCK_BUFFER_VIOLATION"
            }

        return {
            "approved": True,
            "requires_advisory_confirmation": requires_advisory,
            "reason": "EGT_ADVISORY_ZONE" if requires_advisory else None
        }


class PhysicsKernel:
    """
    Backend Flash-Safety Gate & Digital Twin Physics Kernel.
    Enforces ignition map delta constraints (5° max), EGT ceilings (950°C),
    knock buffer margins (1.0°), and rejects malformed/out-of-bounds input.
    """

    MAX_EGT = 950.0
    ADVISORY_EGT = 900.0
    KNOCK_BUFFER = 1.0
    MAX_CELL_DELTA = 5.0

    def enforce_constraints(
        self,
        trial_timing: float,
        baseline_val: float,
        safe_knock_ceiling: float,
        predicted_egt: float,
        max_egt: float = 950.0
    ) -> Dict[str, Any]:
        return SafetyLayer.enforce_constraints(
            trial_timing, baseline_val, safe_knock_ceiling, predicted_egt, max_egt
        )

    def validate_tuning(self, tune_config: Any) -> Tuple[bool, Dict[str, Any]]:
        """
        Validates a full tuning configuration before ECU flash.
        Fails closed on malformed, missing, or out-of-range fields.
        """
        critical_violations: List[str] = []
        advisories: List[str] = []

        if not isinstance(tune_config, dict):
            return False, {
                "status": "REJECTED",
                "critical_violations": ["Malformed config: Input must be a dictionary"],
                "advisories": []
            }

        # Required fields validation
        if "max_egt" not in tune_config:
            critical_violations.append("Missing required field: 'max_egt'")
        if "knock_buffer" not in tune_config and "safe_knock_ceiling" not in tune_config:
            critical_violations.append("Missing required field: 'knock_buffer' or 'safe_knock_ceiling'")

        if critical_violations:
            return False, {
                "status": "REJECTED",
                "critical_violations": critical_violations,
                "advisories": advisories
            }

        # 1. EGT Checks
        max_egt_limit = float(tune_config.get("max_egt_limit", self.MAX_EGT))
        max_egt = float(tune_config["max_egt"])

        if max_egt > max_egt_limit:
            critical_violations.append(
                f"Hard EGT limit violated: {max_egt}°C exceeds maximum threshold of {max_egt_limit}°C (EGT_HARD_CEILING)"
            )
        elif max_egt > self.ADVISORY_EGT:
            advisories.append(
                f"EGT warning: Predicted EGT ({max_egt}°C) enters advisory zone (> {self.ADVISORY_EGT}°C) (EGT_ADVISORY_ZONE)"
            )

        # 2. Knock Buffer Check
        if "knock_buffer" in tune_config:
            kb = float(tune_config["knock_buffer"])
            if kb < self.KNOCK_BUFFER:
                critical_violations.append(
                    f"Knock buffer violation: {kb}° is below minimum safety margin of {self.KNOCK_BUFFER}° (KNOCK_BUFFER_VIOLATION)"
                )

        if "trial_timing" in tune_config and "safe_knock_ceiling" in tune_config:
            trial_timing = float(tune_config["trial_timing"])
            safe_ceiling = float(tune_config["safe_knock_ceiling"])
            if trial_timing >= (safe_ceiling - self.KNOCK_BUFFER):
                critical_violations.append(
                    f"Knock buffer violation: Trial timing ({trial_timing}°) exceeds safe ceiling minus buffer ({safe_ceiling - self.KNOCK_BUFFER}°) (KNOCK_BUFFER_VIOLATION)"
                )

        # 3. Ignition Map Cell-to-Cell Delta Check
        ignition_map = tune_config.get("ignition_map")
        if ignition_map is not None:
            if not isinstance(ignition_map, list):
                critical_violations.append("Malformed field: 'ignition_map' must be a 2D list")
            else:
                rows = len(ignition_map)
                for r in range(rows):
                    row = ignition_map[r]
                    if not isinstance(row, list):
                        critical_violations.append(f"Malformed row in 'ignition_map' at index {r}")
                        break
                    cols = len(row)
                    for c in range(cols):
                        val = float(row[c])
                        # Horizontal neighbor delta
                        if c + 1 < cols:
                            right_val = float(row[c + 1])
                            if abs(val - right_val) > self.MAX_CELL_DELTA:
                                critical_violations.append(
                                    f"Cell delta violation at row {r}, col {c}->{c+1}: {abs(val - right_val):.2f}° exceeds {self.MAX_CELL_DELTA}° limit (MAX_CELL_DELTA_VIOLATION)"
                                )
                        # Vertical neighbor delta
                        if r + 1 < rows:
                            below_row = ignition_map[r + 1]
                            if isinstance(below_row, list) and c < len(below_row):
                                below_val = float(below_row[c])
                                if abs(val - below_val) > self.MAX_CELL_DELTA:
                                    critical_violations.append(
                                        f"Cell delta violation at row {r}->{r+1}, col {c}: {abs(val - below_val):.2f}° exceeds {self.MAX_CELL_DELTA}° limit (MAX_CELL_DELTA_VIOLATION)"
                                    )

        # 4. Trial vs Baseline Map Check
        baseline_map = tune_config.get("baseline_ignition_map")
        if ignition_map is not None and baseline_map is not None:
            if isinstance(baseline_map, list):
                for r in range(min(len(ignition_map), len(baseline_map))):
                    row_ign = ignition_map[r]
                    row_base = baseline_map[r]
                    if isinstance(row_ign, list) and isinstance(row_base, list):
                        for c in range(min(len(row_ign), len(row_base))):
                            diff = abs(float(row_ign[c]) - float(row_base[c]))
                            if diff > self.MAX_CELL_DELTA:
                                critical_violations.append(
                                    f"Cell delta from baseline violation at row {r}, col {c}: {diff:.2f}° exceeds {self.MAX_CELL_DELTA}° limit (MAX_CELL_DELTA_VIOLATION)"
                                )

        is_valid = len(critical_violations) == 0
        status = "PASSED" if is_valid else "REJECTED"
        if is_valid and advisories:
            status = "PASSED_WITH_ADVISORIES"

        report = {
            "status": status,
            "critical_violations": critical_violations,
            "advisories": advisories
        }

        return is_valid, report
