import unittest
import asyncio
import os
import json
from app.services.physics import PhysicsKernel, SafetyLayer
from app.services.flash_manager import FlashManager, SafetyViolationError, AUDIT_LOG_PATH

class TestPhysicsKernel(unittest.TestCase):
    def setUp(self):
        self.kernel = PhysicsKernel()

    def test_valid_tuning_config(self):
        valid_config = {
            "ignition_map": [
                [10.0, 12.0, 14.0],
                [12.0, 14.0, 16.0],
                [14.0, 16.0, 18.0]
            ],
            "max_egt": 850.0,
            "knock_buffer": 2.5
        }
        is_valid, report = self.kernel.validate_tuning(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(report["status"], "PASSED")
        self.assertEqual(len(report["critical_violations"]), 0)

    def test_cell_delta_exceeded(self):
        invalid_config = {
            "ignition_map": [
                [10.0, 18.0, 14.0],  # 10->18 is a delta of 8 (>5.0)
                [12.0, 14.0, 16.0]
            ],
            "max_egt": 850.0,
            "knock_buffer": 2.0
        }
        is_valid, report = self.kernel.validate_tuning(invalid_config)
        self.assertFalse(is_valid)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("Cell delta" in v for v in report["critical_violations"]))

    def test_hard_egt_exceeded(self):
        invalid_config = {
            "ignition_map": [[10.0, 12.0]],
            "max_egt": 980.0,  # > 950.0
            "knock_buffer": 2.0
        }
        is_valid, report = self.kernel.validate_tuning(invalid_config)
        self.assertFalse(is_valid)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("Hard EGT limit" in v for v in report["critical_violations"]))

    def test_advisory_egt_warning(self):
        advisory_config = {
            "ignition_map": [[10.0, 12.0]],
            "max_egt": 920.0,  # > 900.0 and <= 950.0
            "knock_buffer": 2.0
        }
        is_valid, report = self.kernel.validate_tuning(advisory_config)
        self.assertTrue(is_valid)
        self.assertEqual(report["status"], "PASSED_WITH_ADVISORIES")
        self.assertTrue(any("EGT warning" in a for a in report["advisories"]))

    def test_knock_buffer_violation(self):
        invalid_config = {
            "ignition_map": [[10.0, 12.0]],
            "max_egt": 850.0,
            "knock_buffer": 0.5  # < 1.0
        }
        is_valid, report = self.kernel.validate_tuning(invalid_config)
        self.assertFalse(is_valid)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("Knock buffer" in v for v in report["critical_violations"]))

    def test_malformed_input_type(self):
        is_valid, report = self.kernel.validate_tuning("not_a_dict")
        self.assertFalse(is_valid)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("must be a dictionary" in v for v in report["critical_violations"]))

    def test_missing_required_fields(self):
        missing_config = {
            "ignition_map": [[10.0, 12.0]]
            # missing max_egt and knock_buffer
        }
        is_valid, report = self.kernel.validate_tuning(missing_config)
        self.assertFalse(is_valid)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("Missing required field" in v for v in report["critical_violations"]))

    def test_safety_layer_enforce_constraints(self):
        # 1. EGT hard ceiling
        res = SafetyLayer.enforce_constraints(10, 10, 20, 960)
        self.assertFalse(res["approved"])
        self.assertEqual(res["reason"], "EGT_HARD_CEILING")

        # 2. Advisory zone
        res = SafetyLayer.enforce_constraints(10, 10, 20, 910)
        self.assertTrue(res["approved"])
        self.assertTrue(res["requires_advisory_confirmation"])
        self.assertEqual(res["reason"], "EGT_ADVISORY_ZONE")

        # 3. Cell delta violation
        res = SafetyLayer.enforce_constraints(16, 10, 20, 800)
        self.assertFalse(res["approved"])
        self.assertEqual(res["reason"], "MAX_CELL_DELTA_VIOLATION")

        # 4. Knock buffer violation
        res = SafetyLayer.enforce_constraints(14.5, 10, 15, 800)
        self.assertFalse(res["approved"])
        self.assertEqual(res["reason"], "KNOCK_BUFFER_VIOLATION")

        # 5. Approved
        res = SafetyLayer.enforce_constraints(12, 10, 20, 800)
        self.assertTrue(res["approved"])
        self.assertFalse(res["requires_advisory_confirmation"])


class TestFlashManagerSafetyGate(unittest.TestCase):
    def setUp(self):
        self.manager = FlashManager(secret_key=b"SECRET_KEY_12345", dll_path="op20pt32.dll")
        if os.path.exists(AUDIT_LOG_PATH):
            os.remove(AUDIT_LOG_PATH)

    def test_flash_manager_rejects_unsafe_tune_and_writes_audit_log(self):
        unsafe_config = {
            "max_egt": 1000.0,  # Exceeds 950°C
            "knock_buffer": 2.0
        }
        
        async def dummy_ui_callback(percent, msg):
            pass

        async def run_test():
            with self.assertRaises(SafetyViolationError) as ctx:
                await self.manager.execute_flash_workflow(unsafe_config, b"\x00" * 32, dummy_ui_callback)
            self.assertIn("Hard EGT limit violated", str(ctx.exception))

        asyncio.run(run_test())

        # Verify audit log created and logged rejection
        self.assertTrue(os.path.exists(AUDIT_LOG_PATH))
        with open(AUDIT_LOG_PATH, "r") as f:
            lines = f.readlines()
            self.assertGreaterEqual(len(lines), 1)
            last_entry = json.loads(lines[-1])
            self.assertEqual(last_entry["event_type"], "FLASH_SAFETY_GATE")
            self.assertFalse(last_entry["success"])
            self.assertEqual(last_entry["status"], "REJECTED")


if __name__ == "__main__":
    unittest.main()
