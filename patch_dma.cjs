const fs = require('fs');

let content = fs.readFileSync('services/DMAEngine.ts', 'utf8');

// Add new ECU variants to variants object
const newVariants = `
        'SIMOS18': {
            osId: 'SIMOS18',
            ecuType: 'VAG_SIMOS18',
            securityAlgoId: 0x601,
            memoryMap: {
                'RPM': { id: 'RPM', address: 0x80010000, sizeBytes: 2, isSigned: false, scaling: 1.0, offset: 0, name: 'Engine Speed', units: 'RPM' },
                'BST_ACT': { id: 'BST_ACT', address: 0x80010020, sizeBytes: 2, isSigned: false, scaling: 0.039, offset: 0, name: 'Manifold Pressure', units: 'hPa' },
                'IGN_TIM': { id: 'IGN_TIM', address: 0x80010040, sizeBytes: 1, isSigned: true, scaling: 0.75, offset: 0, name: 'Ignition Timing', units: 'deg' },
                'KNK_RET': { id: 'KNK_RET', address: 0x80010044, sizeBytes: 4, isSigned: true, scaling: 0.75, offset: 0, name: 'Knock Retard (Cyl 1-4)', units: 'deg' },
                'LAMBDA': { id: 'LAMBDA', address: 0x80010060, sizeBytes: 2, isSigned: false, scaling: 0.0001, offset: 0, name: 'Lambda Actual', units: 'L' },
                'WG_DC': { id: 'WG_DC', address: 0x80010080, sizeBytes: 1, isSigned: false, scaling: 0.392, offset: 0, name: 'Wastegate DC', units: '%' },
            }
        },
        'VR38DETT': {
            osId: 'VR38DETT',
            ecuType: 'NISSAN_HITACHI_SH7059',
            securityAlgoId: 0x705,
            memoryMap: {
                'RPM': { id: 'RPM', address: 0xFFFF2000, sizeBytes: 2, isSigned: false, scaling: 0.125, offset: 0, name: 'Engine Speed', units: 'RPM' },
                'MAF_B1': { id: 'MAF_B1', address: 0xFFFF2010, sizeBytes: 2, isSigned: false, scaling: 0.005, offset: 0, name: 'Mass Airflow Bank 1', units: 'V' },
                'MAF_B2': { id: 'MAF_B2', address: 0xFFFF2012, sizeBytes: 2, isSigned: false, scaling: 0.005, offset: 0, name: 'Mass Airflow Bank 2', units: 'V' },
                'BST_ACT': { id: 'BST_ACT', address: 0xFFFF2020, sizeBytes: 2, isSigned: false, scaling: 0.015, offset: 0, name: 'Boost Pressure', units: 'psi' },
                'KNK_LVL': { id: 'KNK_LVL', address: 0xFFFF2030, sizeBytes: 2, isSigned: false, scaling: 1.0, offset: 0, name: 'Knock Level', units: 'raw' },
                'AWD_TRQ': { id: 'AWD_TRQ', address: 0xFFFF2040, sizeBytes: 1, isSigned: false, scaling: 1.0, offset: 0, name: 'ETS AWD Torque Split', units: 'kgm' },
            }
        },
`;

if (!content.includes('SIMOS18')) {
    content = content.replace(/'MR20DE': \{/, newVariants + "        'MR20DE': {");
    fs.writeFileSync('services/DMAEngine.ts', content);
    console.log("Updated DMAEngine.ts with new variants");
}

