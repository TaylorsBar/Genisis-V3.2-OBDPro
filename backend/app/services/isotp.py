class IsoTpLayer:
    def __init__(self, driver):
        self.driver = driver

    def fragment(self, payload: bytes):
        """
        Breaks a large payload into ISO-TP CAN frames.
        Single Frame (SF): up to 7 bytes
        First Frame (FF): 6 bytes of payload
        Consecutive Frame (CF): 7 bytes of payload
        """
        frames = []
        payload_len = len(payload)
        
        if payload_len <= 7:
            # Single Frame
            frames.append(bytes([payload_len]) + payload)
        else:
            # First Frame
            # 0x10 | (len >> 8), len & 0xFF
            ff_header = bytes([0x10 | (payload_len >> 8), payload_len & 0xFF])
            frames.append(ff_header + payload[:6])
            
            # Consecutive Frames
            seq = 1
            offset = 6
            while offset < payload_len:
                chunk = payload[offset:offset+7]
                cf_header = bytes([0x20 | (seq & 0x0F)])
                frames.append(cf_header + chunk)
                seq += 1
                offset += 7
                
        return frames
