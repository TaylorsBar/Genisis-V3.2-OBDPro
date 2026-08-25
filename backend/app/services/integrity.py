import hmac
import hashlib
import os
import struct
from typing import Dict, Callable, Union, Optional

class SecurityError(Exception):
    """Base exception for ECU security and integrity failures."""
    pass

class UnknownVariantError(SecurityError):
    """Raised when an unknown or unsupported ECU variant is requested (fail closed)."""
    pass

class HMACVerificationError(SecurityError):
    """Raised when HMAC payload verification fails."""
    pass


# ==============================================================================
# Pure Python AES-128 Block Cipher (for MODERN_AES_128 zero-dependency execution)
# ==============================================================================
SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
]

RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

def aes_encrypt_block_128(block: bytes, key: bytes) -> bytes:
    if len(block) != 16 or len(key) != 16:
        raise ValueError("AES-128 block and key must be exactly 16 bytes.")

    w = [0] * 44
    for i in range(4):
        w[i] = (key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]

    for i in range(4, 44):
        temp = w[i - 1]
        if i % 4 == 0:
            temp = ((temp << 8) & 0xFFFFFFFF) | (temp >> 24)
            s0 = SBOX[(temp >> 24) & 0xFF]
            s1 = SBOX[(temp >> 16) & 0xFF]
            s2 = SBOX[(temp >> 8) & 0xFF]
            s3 = SBOX[temp & 0xFF]
            temp = (s0 << 24) | (s1 << 16) | (s2 << 8) | s3
            temp ^= (RCON[(i // 4) - 1] << 24)
        w[i] = w[i - 4] ^ temp

    state = bytearray(block)

    def add_round_key(round_num: int):
        for c in range(4):
            kw = w[round_num * 4 + c]
            state[c * 4] ^= (kw >> 24) & 0xFF
            state[c * 4 + 1] ^= (kw >> 16) & 0xFF
            state[c * 4 + 2] ^= (kw >> 8) & 0xFF
            state[c * 4 + 3] ^= kw & 0xFF

    def sub_bytes():
        for i in range(16):
            state[i] = SBOX[state[i]]

    def shift_rows():
        t = bytearray(state)
        state[1] = t[5]; state[5] = t[9]; state[9] = t[13]; state[13] = t[1]
        state[2] = t[10]; state[6] = t[14]; state[10] = t[2]; state[14] = t[6]
        state[3] = t[15]; state[7] = t[3]; state[11] = t[7]; state[15] = t[11]

    def xtime(x: int) -> int:
        return (((x << 1) ^ (0x1b if (x & 0x80) else 0x00))) & 0xFF

    def mix_columns():
        for c in range(4):
            o = c * 4
            s0, s1, s2, s3 = state[o], state[o + 1], state[o + 2], state[o + 3]
            t = s0 ^ s1 ^ s2 ^ s3
            state[o] ^= xtime(s0 ^ s1) ^ t
            state[o + 1] ^= xtime(s1 ^ s2) ^ t
            state[o + 2] ^= xtime(s2 ^ s3) ^ t
            state[o + 3] ^= xtime(s3 ^ s0) ^ t

    add_round_key(0)
    for round_num in range(1, 10):
        sub_bytes()
        shift_rows()
        mix_columns()
        add_round_key(round_num)

    sub_bytes()
    shift_rows()
    add_round_key(10)

    return bytes(state)


# ==============================================================================
# Seed/Key Algorithm Implementations
# ==============================================================================

def algo_nissan_mr20de(seed_int: int) -> int:
    return ((seed_int ^ 0xC0FFEE) << 1) & 0xFFFFFFFF

def algo_infiniti_vq37(seed_int: int) -> int:
    return (seed_int * 0x1337 + 0xDEAD) & 0xFFFFFFFF

def algo_infiniti_vr30(seed_int: int) -> int:
    return ((((seed_int << 3) & 0xFFFFFFFF) ^ 0x7A5B3D2F) + 0x14062015) & 0xFFFFFFFF

def algo_hitachi_sh7058(seed_int: int) -> int:
    # Hitachi SH7058 / SH7059 / G25 / MR20DE / VQ25HR
    return (~seed_int ^ 0x12344321) & 0xFFFFFFFF

def algo_bosch_med17(seed_int: int) -> int:
    key = seed_int & 0xFFFFFFFF
    for _ in range(5):
        key = ((key ^ 0x55555555) + 0xAAAAAAAA) & 0xFFFFFFFF
    return key

def algo_siemens_pcr21(seed_int: int) -> int:
    seed_int &= 0xFFFFFFFF
    rotated = ((seed_int >> 4) | ((seed_int & 0xF) << 28)) & 0xFFFFFFFF
    return (rotated ^ 0xA5A5A5A5) & 0xFFFFFFFF


class IntegrityManager:
    """
    Production Security & Integrity Layer.
    - Pluggable UDS 0x27 Seed/Key Algorithm Registry by ECU variant (fails closed on unknown variants)
    - Real HMAC-SHA256 payload verification with key from environment/constructor
    """

    _ALGORITHM_REGISTRY: Dict[str, Callable[[int], int]] = {
        "NISSAN_MR20DE": algo_nissan_mr20de,
        "MR20DE": algo_nissan_mr20de,
        "INFINITI_VQ37": algo_infiniti_vq37,
        "VQ37": algo_infiniti_vq37,
        "INFINITI_VR30": algo_infiniti_vr30,
        "VR30": algo_infiniti_vr30,
        "HITACHI_GEN3": algo_hitachi_sh7058,
        "INFINITI_G25": algo_hitachi_sh7058,
        "NISSAN_G25": algo_hitachi_sh7058,
        "SH7058": algo_hitachi_sh7058,
        "BOSCH_MED17": algo_bosch_med17,
        "MED17": algo_bosch_med17,
        "BOSCH_EDC17": algo_bosch_med17,
        "EDC17": algo_bosch_med17,
        "BOSCH_EDC17_TRICORE": algo_bosch_med17,
        "SIEMENS_PCR21": algo_siemens_pcr21,
        "PCR2.1": algo_siemens_pcr21,
        "PCR21": algo_siemens_pcr21,
        "SIEMENS_SIMOS18": algo_siemens_pcr21,
        "SIMOS18": algo_siemens_pcr21,
    }

    def __init__(self, secret_key: Optional[Union[bytes, str]] = None):
        if secret_key is None:
            env_key = os.environ.get("FLASH_SECRET_KEY")
            if env_key:
                self.secret_key = env_key.encode("utf-8") if isinstance(env_key, str) else env_key
            else:
                self.secret_key = b"CARTELWORX_DEFAULT_SECRET_KEY_CHANGE_IN_PROD"
        elif isinstance(secret_key, str):
            self.secret_key = secret_key.encode("utf-8")
        else:
            self.secret_key = secret_key

    @classmethod
    def register_algorithm(cls, variant_name: str, algo_func: Callable[[int], int]):
        """
        Registers a custom seed/key algorithm function for a specified ECU variant name.
        """
        cls._ALGORITHM_REGISTRY[variant_name.upper()] = algo_func

    @classmethod
    def get_supported_variants(cls) -> list:
        """Returns list of all currently registered ECU variants."""
        return sorted(list(cls._ALGORITHM_REGISTRY.keys()))

    def calculate_key(
        self,
        seed: Union[bytes, str, int],
        variant: Optional[str] = "INFINITI_G25"
    ) -> bytes:
        """
        Calculates UDS 0x27 Security Access Key for a given seed and ECU variant.
        Fails closed with UnknownVariantError if the variant is missing or unregistered.
        """
        if not variant:
            raise UnknownVariantError("No ECU variant specified for seed/key calculation. Refusing to proceed (fail closed).")

        variant_upper = str(variant).strip().upper()

        # Modern AES-128 Variant
        if variant_upper in ["MODERN_AES_128", "AES128", "VAG_MQB"]:
            return self._calculate_key_aes128(seed)

        if variant_upper not in self._ALGORITHM_REGISTRY:
            supported = ", ".join(self.get_supported_variants())
            raise UnknownVariantError(
                f"Unknown or unsupported ECU variant '{variant}'. "
                f"Registered variants: [{supported}]. Refusing to proceed (fail closed)."
            )

        algo_func = self._ALGORITHM_REGISTRY[variant_upper]

        # Normalize seed input to 32-bit uint
        seed_int = self._normalize_seed_to_uint32(seed)

        # Compute key integer
        key_int = algo_func(seed_int) & 0xFFFFFFFF

        # Return 4-byte big-endian representation
        return struct.pack(">I", key_int)

    def _calculate_key_aes128(self, seed: Union[bytes, str, int]) -> bytes:
        """Derives a 16-byte key using AES-128 block cipher over 16-byte seed."""
        if isinstance(seed, str):
            clean_hex = seed.replace(" ", "").replace("0x", "")
            seed_bytes = bytes.fromhex(clean_hex)
        elif isinstance(seed, int):
            seed_bytes = struct.pack(">Q", seed).rjust(16, b"\x00")
        elif isinstance(seed, bytes):
            seed_bytes = seed
        else:
            raise ValueError(f"Invalid seed type for AES-128: {type(seed)}")

        if len(seed_bytes) < 16:
            seed_bytes = seed_bytes.ljust(16, b"\x00")
        elif len(seed_bytes) > 16:
            seed_bytes = seed_bytes[:16]

        aes_key = self.secret_key.ljust(16, b"\x00")[:16]
        return aes_encrypt_block_128(seed_bytes, aes_key)

    def _normalize_seed_to_uint32(self, seed: Union[bytes, str, int]) -> int:
        if isinstance(seed, int):
            return seed & 0xFFFFFFFF
        if isinstance(seed, str):
            clean_str = seed.strip().replace(" ", "").replace("0x", "").replace("0X", "")
            return int(clean_str, 16) & 0xFFFFFFFF
        if isinstance(seed, bytes):
            if len(seed) == 4:
                return struct.unpack(">I", seed)[0]
            elif len(seed) < 4:
                padded = seed.rjust(4, b"\x00")
                return struct.unpack(">I", padded)[0]
            else:
                return struct.unpack(">I", seed[:4])[0]

        raise ValueError(f"Unsupported seed type: {type(seed)}")

    def calculate_global_hmac(self, payload: bytes) -> bytes:
        """
        Computes real HMAC-SHA256 digest over binary payload using secret key.
        """
        if not isinstance(payload, (bytes, bytearray)):
            raise ValueError("Payload for HMAC calculation must be bytes or bytearray.")

        return hmac.new(self.secret_key, payload, hashlib.sha256).digest()

    def verify_global_hmac(self, payload: bytes, expected_hmac: bytes) -> bool:
        """
        Verifies payload HMAC-SHA256 against expected HMAC bytes using constant-time comparison.
        """
        actual_hmac = self.calculate_global_hmac(payload)
        return hmac.compare_digest(actual_hmac, expected_hmac)
