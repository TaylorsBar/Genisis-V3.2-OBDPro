
#include "GenesisExpandedDb.h"
#include <cstring>
#include <vector>

namespace CartelWorx {

    // --- Memory Maps ---
    static const MemoryParam EDC17_MAP[] = {
        {"RPM",      0x800400, 2, false, 1.0f,     0.0f,  "Engine Speed", "RPM"},
        {"FUEL_P",   0x800418, 2, false, 0.1f,     0.0f,  "Rail Pressure", "BAR"},
        {"BST_ACT",  0x800414, 2, false, 0.039f,   0.0f,  "Manifold Pressure", "hPa"},
        {"IAT",      0x800412, 1, false, 0.75f,   -48.0f, "Intake Temp", "°C"},
        {"OIL_T",    0x800422, 1, false, 1.0f,    -40.0f, "Oil Temp", "°C"},
        {"TQI_ACT",  0x800450, 2, true,  0.1f,     0.0f,  "Actual Torque", "Nm"},
        {"EGT_1",    0x800468, 2, false, 0.1f,    -40.0f, "Exhaust Temp Pre-Turbo", "°C"}
    };

    static const MemoryParam PCR21_MAP[] = {
        {"RPM",      0x70002100, 2, false, 1.0f,   0.0f,  "Engine Speed", "RPM"},
        {"BST_ACT",  0x70002120, 2, false, 1.0f,   0.0f,  "Charge Pressure", "hPa"},
        {"IAT",      0x70002122, 1, false, 0.75f, -48.0f, "Manifold Temp", "°C"},
        {"LMB_1",    0x70002140, 2, true,  0.0000305f, 0.0f, "Lambda Actual", "L"},
        {"INJ_QTY",  0x70002160, 2, false, 0.01f,  0.0f,  "Injection Quantity", "mg/stk"},
        {"SOI",      0x70002174, 2, true,  0.01f,  0.0f,  "Start of Injection", "deg"}
    };

    static const MemoryParam NISSAN_KWP_MAP[] = {
        {"RPM",      0x1101, 2, false, 12.5f,    0.0f,  "Engine Speed", "RPM"},
        {"SPEED",    0x1102, 1, false, 2.0f,      0.0f,  "Vehicle Speed", "KM/H"},
        {"COOLANT",  0x1103, 1, false, 1.0f,     -40.0f, "Coolant Temp", "°C"},
        {"VVT_POS",  0x1145, 2, true,  0.1f,      0.0f,  "VVT Intake B1", "DEG"},
        {"FUEL_P",   0x116A, 2, false, 0.1f,      0.0f,  "Rail Pressure", "MPa"}
    };

    static const MemoryParam INFINITI_VQ25_MAP[] = {
        {"RPM",      0xFFFF2100, 2, false, 12.5f,   0.0f,  "Engine Speed", "RPM"},
        {"SPEED",    0xFFFF2102, 1, false, 1.0f,    0.0f,  "Vehicle Speed", "KM/H"},
        {"COOLANT",  0xFFFF2104, 1, false, 1.0f,   -40.0f, "Coolant Temp", "°C"},
        {"IGN_TIM",  0xFFFF2110, 1, true,  0.5f,   -64.0f, "Ignition Timing", "DEG"},
        {"KNK_LVL",  0xFFFF2120, 2, false, 1.0f,    0.0f,  "Knock Level", "RAW"}
    };

    static std::vector<EcuVariant> s_variantRegistry = {
        {
            "EDC17",
            "BOSCH_EDC17_TRICORE",
            0x402,
            ValidationStatus::BENCH_VALIDATED,
            EDC17_MAP,
            7
        },
        {
            "PCR2.1",
            "SIEMENS_PCR21",
            0x502,
            ValidationStatus::DERIVED_FROM_PUBLIC_SERVICE_DATA,
            PCR21_MAP,
            6
        },
        {
            "MR20DE",
            "NISSAN_KWP_J10",
            0x701,
            ValidationStatus::BENCH_VALIDATED,
            NISSAN_KWP_MAP,
            5
        },
        {
            "M9R",
            "NISSAN_DIESEL_KWP",
            0x701,
            ValidationStatus::DERIVED_FROM_PUBLIC_SERVICE_DATA,
            NISSAN_KWP_MAP,
            5
        },
        {
            "VQ25HR",
            "INFINITI_SH7058_G25",
            0x701,
            ValidationStatus::BENCH_VALIDATED,
            INFINITI_VQ25_MAP,
            5
        }
    };

    bool GenesisExpandedDb::registerVariant(const EcuVariant& variant) {
        if (!variant.osId || strlen(variant.osId) == 0) return false;
        for (const auto& existing : s_variantRegistry) {
            if (strcmp(existing.osId, variant.osId) == 0) {
                return false; // Duplicate registration rejected
            }
        }
        s_variantRegistry.push_back(variant);
        return true;
    }

    const EcuVariant* GenesisExpandedDb::findVariant(const char* osId) {
        if (!osId) return nullptr;
        for (const auto& variant : s_variantRegistry) {
            if (strstr(osId, variant.osId) != nullptr) {
                return &variant;
            }
        }
        return nullptr;
    }

    const std::vector<EcuVariant>& GenesisExpandedDb::getAllVariants() {
        return s_variantRegistry;
    }

    size_t GenesisExpandedDb::getVariantCount() {
        return s_variantRegistry.size();
    }

    std::map<ValidationStatus, size_t> GenesisExpandedDb::getVariantCountsByStatus() {
        std::map<ValidationStatus, size_t> counts;
        counts[ValidationStatus::BENCH_VALIDATED] = 0;
        counts[ValidationStatus::DERIVED_FROM_PUBLIC_SERVICE_DATA] = 0;
        counts[ValidationStatus::COMMUNITY_SUBMITTED_UNVERIFIED] = 0;

        for (const auto& v : s_variantRegistry) {
            counts[v.status]++;
        }
        return counts;
    }

}

