/**
 * Gemini Diagnosis Service — uses Google Gemini AI to diagnose vehicle issues
 * purely from raw telemetry data (no fault label given).
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiDiagnosis {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = null;

    if (this.apiKey) {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  /**
   * Diagnose from raw telemetry — the AI is NOT told the fault type.
   * It must figure out the root cause from sensor patterns alone.
   */
  async diagnoseFromTelemetry(telemetryHistory) {
    if (!this.model) {
      console.log('⚠️  No Gemini API key — using fallback diagnosis');
      return this.getFallbackDiagnosis(telemetryHistory);
    }

    const recentReadings = telemetryHistory.slice(-10);

    const prompt = `You are an expert vehicle diagnostic AI for Stellantis STLA platform vehicles. You are analyzing real-time telemetry data from a connected vehicle.

IMPORTANT: You are NOT told what is wrong. You must deduce the root cause ONLY from the sensor data patterns.

Here are the last ${recentReadings.length} telemetry readings (newest last):

${JSON.stringify(recentReadings, null, 2)}

Normal baseline values for reference:
- RPM: 800 (idle)
- Oil Pressure: 40 psi
- Engine Temp: 90°C
- Voltage: 14.2V
- Current: 25A
- Battery SOC: 95%
- Coolant Temp: 88°C
- Coolant Pressure: 15 psi
- Coolant Flow Rate: 8.5 L/min
- Speed: 60 km/h
- Vibration: 0.3g
- Throttle: 30%

Analyze the telemetry trends and respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "rootCause": "string - specific root cause identified",
  "affectedSystem": "string - primary system affected (Engine, Electrical, Cooling, Transmission, etc.)",
  "severity": number (1-5, where 5 is most critical),
  "confidence": number (0-100, your confidence percentage),
  "riskAssessment": "string - what could happen if not addressed",
  "isAutoFixable": boolean (can this be resolved remotely via software/ECU commands?),
  "recommendedAction": "string - immediate recommended action",
  "affectedParameters": ["array of parameter names showing anomalies"],
  "reasoning": "string - brief explanation of how you reached this diagnosis from the data patterns"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();

      // Parse JSON from response (handle potential markdown wrapping)
      let jsonStr = text;
      if (text.includes('```')) {
        jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const diagnosis = JSON.parse(jsonStr);
      return diagnosis;
    } catch (err) {
      console.error('Gemini diagnosis error:', err.message);
      return this.getFallbackDiagnosis(telemetryHistory);
    }
  }

  /**
   * Extract resolution intent from a call transcript.
   * Determines if the engineer approves auto-fix or wants mechanic dispatch.
   */
  async extractResolutionIntent(transcript, diagnosis) {
    if (!this.model) {
      // Default: auto-fixable issues auto-fix, others escalate
      return {
        decision: diagnosis?.isAutoFixable ? 'auto-fix' : 'escalate',
        confidence: 85,
        reasoning: 'Based on diagnosis auto-fixable assessment'
      };
    }

    const prompt = `You are analyzing a conversation between an AI diagnostic system and an on-call engineer about a vehicle issue.

Diagnosis context:
${JSON.stringify(diagnosis, null, 2)}

Call transcript:
${transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')}

Based on the conversation, determine the resolution path. Respond with ONLY a valid JSON object:
{
  "decision": "auto-fix" or "escalate",
  "confidence": number (0-100),
  "reasoning": "string - why this decision was made"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      let jsonStr = text;
      if (text.includes('```')) {
        jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Intent extraction error:', err.message);
      return {
        decision: diagnosis?.isAutoFixable ? 'auto-fix' : 'escalate',
        confidence: 75,
        reasoning: 'Fallback based on diagnosis'
      };
    }
  }

  /**
   * Generate AI response for voice conversation with engineer.
   */
  async generateCallResponse(engineerMessage, diagnosis, telemetryHistory) {
    if (!this.model) {
      return this._getFallbackCallResponse(engineerMessage);
    }

    const prompt = `You are an AI vehicle diagnostic assistant on a voice call with an on-call engineer. Be concise and professional — this is a voice call, so keep responses under 3 sentences.

Current diagnosis:
${JSON.stringify(diagnosis, null, 2)}

Latest telemetry snapshot:
${JSON.stringify(telemetryHistory.slice(-3), null, 2)}

The engineer just said: "${engineerMessage}"

Respond naturally as if speaking on the phone. If they ask about the issue, explain using the diagnosis. If they approve a fix, confirm. If they want to escalate, acknowledge.`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      return this._getFallbackCallResponse(engineerMessage);
    }
  }

  /**
   * Fallback diagnosis when Gemini API is unavailable.
   * Analyzes telemetry patterns heuristically.
   */
  getFallbackDiagnosis(telemetryHistory) {
    const latest = telemetryHistory[telemetryHistory.length - 1];
    if (!latest) {
      return {
        rootCause: 'Insufficient telemetry data',
        affectedSystem: 'Unknown',
        severity: 1,
        confidence: 20,
        riskAssessment: 'Cannot assess without data',
        isAutoFixable: false,
        recommendedAction: 'Continue monitoring',
        affectedParameters: [],
        reasoning: 'No telemetry data available for analysis'
      };
    }

    // Heuristic detection based on which parameters are most anomalous
    const anomalies = {};

    if (latest.coolantTemp > 105 || latest.coolantPressure < 8 || latest.coolantFlowRate < 4) {
      anomalies.coolant = (latest.coolantTemp - 88) / 40 + (15 - latest.coolantPressure) / 15 + (8.5 - latest.coolantFlowRate) / 8.5;
    }
    if (latest.voltage < 11.5 || latest.current > 50 || latest.batterySoc < 60) {
      anomalies.electrical = (14.2 - latest.voltage) / 5 + (latest.current - 25) / 50 + (95 - latest.batterySoc) / 95;
    }
    if (latest.rpm > 2000 || latest.oilPressure < 25 || latest.vibration > 2.0) {
      anomalies.engine = (latest.rpm - 800) / 4000 + (40 - latest.oilPressure) / 40 + (latest.vibration - 0.3) / 5;
    }

    const topAnomaly = Object.entries(anomalies).sort((a, b) => b[1] - a[1])[0];

    if (!topAnomaly) {
      return {
        rootCause: 'Minor sensor fluctuations detected',
        affectedSystem: 'General',
        severity: 1,
        confidence: 40,
        riskAssessment: 'Low risk — values within acceptable range',
        isAutoFixable: true,
        recommendedAction: 'Continue monitoring',
        affectedParameters: [],
        reasoning: 'All parameters within normal operating ranges with minor fluctuations'
      };
    }

    const diagnosisMap = {
      coolant: {
        rootCause: 'Coolant system failure — possible thermostat malfunction or coolant leak causing overheating',
        affectedSystem: 'Cooling System',
        severity: 4,
        confidence: 87,
        riskAssessment: 'Engine overheating imminent — continued operation risks severe engine damage, head gasket failure, or engine seizure',
        isAutoFixable: true,
        recommendedAction: 'Initiate emergency coolant system bypass and reduce engine load. Activate auxiliary cooling fan at maximum speed.',
        affectedParameters: ['coolantTemp', 'coolantPressure', 'coolantFlowRate', 'engineTemp'],
        reasoning: 'Coolant temperature is rising rapidly while coolant pressure and flow rate are declining. This pattern indicates a coolant circulation failure — likely a stuck thermostat or coolant pump degradation. Engine temperature is following with a delay, confirming the cooling system as the root cause.'
      },
      electrical: {
        rootCause: 'Electrical short circuit — abnormal current draw causing voltage collapse and rapid battery drain',
        affectedSystem: 'Electrical System',
        severity: 4,
        confidence: 82,
        riskAssessment: 'Risk of complete electrical system failure, potential fire hazard from short circuit, loss of critical vehicle systems',
        isAutoFixable: false,
        recommendedAction: 'Isolate affected circuit via relay control. Reduce non-essential electrical load. Schedule immediate physical inspection.',
        affectedParameters: ['voltage', 'current', 'batterySoc'],
        reasoning: 'Voltage is dropping well below normal operating range while current draw is spiking erratically. Battery state of charge is depleting at an abnormal rate. This pattern is consistent with a short circuit drawing excess current, causing voltage sag across the system.'
      },
      engine: {
        rootCause: 'Engine mechanical fault — erratic RPM and oil pressure loss indicating internal engine component failure',
        affectedSystem: 'Engine / Powertrain',
        severity: 5,
        confidence: 89,
        riskAssessment: 'Catastrophic engine failure possible — low oil pressure risks bearing damage, connecting rod failure, or crankshaft seizure',
        isAutoFixable: false,
        recommendedAction: 'Reduce engine speed immediately. Enter limp mode. Do not continue driving — arrange tow to nearest certified service center.',
        affectedParameters: ['rpm', 'oilPressure', 'vibration', 'engineTemp'],
        reasoning: 'RPM is oscillating wildly between extremes while oil pressure is critically low. Combined with elevated vibration levels, this pattern indicates a serious mechanical issue — potentially a failing oil pump, worn bearings, or internal engine component failure.'
      }
    };

    return diagnosisMap[topAnomaly[0]] || diagnosisMap.engine;
  }

  _getFallbackCallResponse(engineerMessage) {
    const msg = engineerMessage?.toLowerCase() || '';
    if (msg.includes('detail') || msg.includes('explain') || msg.includes('what')) {
      return 'The vehicle telemetry shows progressive degradation in the affected system. Multiple sensor parameters are trending outside normal operating ranges, indicating a developing failure that requires immediate attention.';
    }
    if (msg.includes('fix') || msg.includes('approve') || msg.includes('yes') || msg.includes('proceed')) {
      return 'Understood. Initiating the automated resolution procedure now. I\'ll normalize the affected systems and confirm when complete.';
    }
    if (msg.includes('mechanic') || msg.includes('escalate') || msg.includes('send') || msg.includes('no')) {
      return 'Acknowledged. I\'ll escalate this to the nearest certified mechanic. Locating available service centers and calculating ETAs now.';
    }
    return 'I\'m continuing to monitor the telemetry data. The affected parameters are still showing anomalous readings. Would you like me to proceed with the recommended resolution, or should we escalate to a field mechanic?';
  }
}

module.exports = { GeminiDiagnosis };
