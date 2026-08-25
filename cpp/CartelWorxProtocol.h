
#ifndef CARTELWORX_PROTOCOL_H
#define CARTELWORX_PROTOCOL_H

#include <stdint.h>
#include <stddef.h>

namespace CartelWorx {

    enum class ServiceID : uint8_t {
        DiagnosticSessionControl = 0x10,
        SecurityAccess = 0x27,
        ReadMemoryByAddress = 0x23,
        RequestDownload = 0x34,
        TransferData = 0x36,
        RequestTransferExit = 0x37,
        ECUReset = 0x11
    };

    struct UdsPacket {
        ServiceID sid;
        uint8_t* payload;
        size_t length;
    };

    class ProtocolHandler {
    public:
        ProtocolHandler();
        ~ProtocolHandler();

        uint32_t calculate_crc32(const uint8_t* data, size_t len);
        bool verify_integrity(const uint8_t* data, size_t len, uint32_t expected_crc);
        
        // Low-level bus interface mocks
        int send_frame(uint32_t can_id, const uint8_t* data, uint8_t len);
        int receive_frame(uint32_t* can_id, uint8_t* data, uint8_t* len);
    };

}

#endif
