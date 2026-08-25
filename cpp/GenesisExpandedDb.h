
#ifndef GENESIS_EXPANDED_DB_H
#define GENESIS_EXPANDED_DB_H

#include <stdint.h>
#include <string>
#include <vector>
#include <map>

namespace CartelWorx {

    enum class ValidationStatus {
        BENCH_VALIDATED = 0,
        DERIVED_FROM_PUBLIC_SERVICE_DATA = 1,
        COMMUNITY_SUBMITTED_UNVERIFIED = 2
    };

    struct MemoryParam {
        const char* id;
        uint32_t address;
        uint8_t sizeBytes;
        bool isSigned;
        float scaling;
        float offset;
        const char* name;
        const char* units;
    };

    struct EcuVariant {
        const char* osId;
        const char* ecuType;
        uint32_t securityAlgoId;
        ValidationStatus status;
        const MemoryParam* memoryMap;
        uint8_t paramCount;
    };

    class GenesisExpandedDb {
    public:
        static bool registerVariant(const EcuVariant& variant);
        static const EcuVariant* findVariant(const char* osId);
        static const std::vector<EcuVariant>& getAllVariants();
        static size_t getVariantCount();
        static std::map<ValidationStatus, size_t> getVariantCountsByStatus();
    };

}

#endif

