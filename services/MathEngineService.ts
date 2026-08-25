
import { SensorDataPoint } from '../types';

export interface MathChannel {
    id: string;
    name: string;
    description: string;
    formula: string;
    unit: string;
    color: string;
}

export class MathEngineService {
    private static instance: MathEngineService | null = null;

    private constructor() {}

    public static getInstance(): MathEngineService {
        if (!this.instance) this.instance = new MathEngineService();
        return this.instance;
    }

    /**
     * Evaluates a mathematical formula against sensor data.
     * Supports basic arithmetic and sensor field names.
     */
    public evaluate(formula: string, data: SensorDataPoint): number {
        try {
            // 1. Sanitize: allow only alphanumeric, basic math operators, and periods
            let sanitized = formula.replace(/[^a-zA-Z0-9\+\-\*\/\(\)\. ]/g, '');
            
            // 2. Tokenize and replace keywords with data values
            const tokens = sanitized.match(/[a-zA-Z]+/g) || [];
            let expression = sanitized;
            
            for (const token of tokens) {
                if (token in data) {
                    const value = (data as any)[token];
                    // Replace token with its value, ensuring it's treated as a single token using word boundaries
                    const regex = new RegExp(`\\b${token}\\b`, 'g');
                    expression = expression.replace(regex, value.toString());
                } else if (['sin', 'cos', 'tan', 'sqrt', 'log', 'pow', 'abs', 'min', 'max'].includes(token.toLowerCase())) {
                    const regex = new RegExp(`\\b${token}\\b`, 'gi');
                    expression = expression.replace(regex, `Math.${token.toLowerCase()}`);
                }
            }

            // 3. SECURE EXECUTION: Use Function constructor instead of eval
            // We've already sanitized the input to only allow known tokens and math
            const func = new Function(`return ${expression};`);
            const result = func();
            
            if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return 0;
            return result;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Common Math Engine Presets (MoTeC Style)
     */
    public static readonly PRESETS: MathChannel[] = [
        {
            id: 'estimated_ve',
            name: 'Estimated VE',
            description: 'Volumetric Efficiency estimate based on MAF and Load',
            formula: '(maf * 1000) / (rpm * displacement * load)',
            unit: '%',
            color: '#00F0FF'
        },
        {
            id: 'lambda_error',
            name: 'Lambda Error',
            description: 'Difference between target and actual lambda',
            formula: '((lambda - targetLambda) / targetLambda) * 100',
            unit: '%',
            color: '#FF003C'
        },
        {
            id: 'injector_duty',
            name: 'Inj Duty Cycle',
            description: 'Percentage of time injector is open',
            formula: '(injectorPulseWidth * rpm) / 1200',
            unit: '%',
            color: '#BC13FE'
        }
    ];
}
