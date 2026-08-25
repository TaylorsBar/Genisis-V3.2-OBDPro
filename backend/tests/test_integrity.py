import unittest
import struct
import hmac
import hashlib
from app.services.integrity import (
    IntegrityManager,
    UnknownVariantError,
    SecurityError,
    algo_nissan_mr20de,
    algo_infiniti_vq37,
    algo_infiniti_vr30,
    algo_hitachi_sh7058,
    algo_bosch_med17,
    algo_siemens_pcr21
)


class TestIntegrityManagerSeedKey(unittest.TestCase):
    def setUp(self):
        self.secret = b"TEST_SECRET_KEY_12345"
        self.mgr = IntegrityManager(secret_key=self.secret)

    def test_nissan_mr20de_known_answer(self):
        # Seed 0x12345678 -> ((0x12345678 ^ 0xC0FFEE) << 1) = 0x25E9532C
        seed = 0x12345678
        key_bytes = self.mgr.calculate_key(seed, variant="NISSAN_MR20DE")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 0x25E9532C)

    def test_infiniti_vq37_known_answer(self):
        # Seed 0x12345678 -> (0x12345678 * 0x1337 + 0xDEAD) & 0xFFFFFFFF = 0xCBAB0275 (3416939125)
        seed = 0x12345678
        key_bytes = self.mgr.calculate_key(seed, variant="INFINITI_VQ37")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 3416939125)

    def test_infiniti_vr30_known_answer(self):
        # Seed 0x12345678 -> (((0x12345678 << 3) ^ 0x7A5B3D2F) + 0x14062015) & 0xFFFFFFFF = 4294946564
        seed = 0x12345678
        key_bytes = self.mgr.calculate_key(seed, variant="INFINITI_VR30")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 4294946564)

    def test_infiniti_g25_hitachi_sh7058_known_answer(self):
        # Seed 0x12345678 -> (~0x12345678 ^ 0x12344321) = 0xFFFFEAA6 (4294961830)
        seed = 0x12345678
        key_bytes = self.mgr.calculate_key(seed, variant="INFINITI_G25")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 0xFFFFEAA6)

    def test_bosch_med17_known_answer(self):
        # Seed 0x12345678 -> 5-stage bitwise transform = 1867740447
        seed = 0x12345678
        key_bytes = self.mgr.calculate_key(seed, variant="BOSCH_MED17")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 1867740447)

    def test_siemens_pcr21_known_answer(self):
        seed = 0x12345678
        key_bytes = self.mgr.calculate_key(seed, variant="SIEMENS_PCR21")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 0x2486E0C2)

    def test_modern_aes128_known_answer(self):
        seed_bytes = b"\x01" * 16
        key1 = self.mgr.calculate_key(seed_bytes, variant="MODERN_AES_128")
        self.assertEqual(len(key1), 16)
        # Deterministic check
        key2 = self.mgr.calculate_key(seed_bytes, variant="MODERN_AES_128")
        self.assertEqual(key1, key2)

    def test_seed_input_formats(self):
        # Int
        k1 = self.mgr.calculate_key(0x12345678, variant="INFINITI_G25")
        # Bytes
        k2 = self.mgr.calculate_key(b"\x12\x34\x56\x78", variant="INFINITI_G25")
        # Hex string
        k3 = self.mgr.calculate_key("12345678", variant="INFINITI_G25")
        # Hex string with 0x prefix
        k4 = self.mgr.calculate_key("0x12345678", variant="INFINITI_G25")

        self.assertEqual(k1, k2)
        self.assertEqual(k2, k3)
        self.assertEqual(k3, k4)

    def test_fail_closed_on_unknown_variant(self):
        with self.assertRaises(UnknownVariantError):
            self.mgr.calculate_key(0x12345678, variant="UNKNOWN_FAKE_ECU_FAMILY")

    def test_fail_closed_on_none_variant(self):
        with self.assertRaises(UnknownVariantError):
            self.mgr.calculate_key(0x12345678, variant=None)

    def test_custom_algorithm_registration(self):
        def my_custom_algo(seed_int: int) -> int:
            return (seed_int + 0x11223344) & 0xFFFFFFFF

        IntegrityManager.register_algorithm("CUSTOM_ECU_V1", my_custom_algo)
        key_bytes = self.mgr.calculate_key(0x10000000, variant="CUSTOM_ECU_V1")
        key_int = struct.unpack(">I", key_bytes)[0]
        self.assertEqual(key_int, 0x21223344)


class TestIntegrityManagerHMAC(unittest.TestCase):
    def setUp(self):
        self.secret = b"SUPER_SECRET_HMAC_KEY_99"
        self.mgr = IntegrityManager(secret_key=self.secret)

    def test_real_hmac_sha256_computation(self):
        payload = b"ECU_TUNING_BINARY_DATA_PAYLOAD_370Z"
        hmac_digest = self.mgr.calculate_global_hmac(payload)

        expected = hmac.new(self.secret, payload, hashlib.sha256).digest()
        self.assertEqual(hmac_digest, expected)
        self.assertEqual(len(hmac_digest), 32)  # SHA-256 output is 32 bytes

    def test_hmac_verification_success(self):
        payload = b"VALID_ECU_MAP_DATA_0123456789"
        expected_hmac = self.mgr.calculate_global_hmac(payload)

        is_valid = self.mgr.verify_global_hmac(payload, expected_hmac)
        self.assertTrue(is_valid)

    def test_hmac_verification_fails_on_tampered_payload(self):
        original_payload = b"VALID_ECU_MAP_DATA_0123456789"
        expected_hmac = self.mgr.calculate_global_hmac(original_payload)

        # Tamper single byte
        tampered_payload = b"VALID_ECU_MAP_DATA_0123456788"
        is_valid = self.mgr.verify_global_hmac(tampered_payload, expected_hmac)
        self.assertFalse(is_valid)


if __name__ == "__main__":
    unittest.main()
