const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const { getVehicleProfile } = require('./vehicleProfile');
const {
  extractWeatherLocation,
  formatWeatherReply,
  getCurrentWeather,
  isWeatherQuestion,
} = require('./weatherService');

class GeminiDiagnosis {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.geminiModel = null;
    this.groqClient = null;
    this.forceDeterministicDemo = process.env.DETERMINISTIC_DEMO === 'true';
    this.groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

    if (this.groqApiKey) {
      this.groqClient = new Groq({ apiKey: this.groqApiKey });
    } else if (this.geminiApiKey) {
      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    }
  }
  _normaliseDiagnosis(diagnosis, mlPrediction = null) {
    const primaryConfidence = Number(mlPrediction?.confidence ?? diagnosis.primaryConfidence ?? 0);
    const contextualConfidence = Number(diagnosis.contextualConfidence ?? diagnosis.confidence ?? primaryConfidence);
    return {
      ...diagnosis,
      primaryConfidence,
      contextualConfidence,
      confidence: contextualConfidence,
      severity: Number(diagnosis.severity ?? mlPrediction?.severity ?? 1),
      affectedParameters: diagnosis.affectedParameters || mlPrediction?.affectedParameters || [],
    };
  }
  getStatus() {
    if (this.forceDeterministicDemo) return { mode: 'deterministic', provider: 'Local telemetry demo', model: 'Rule-based fallback' };
    if (this.groqClient) return { mode: 'live', provider: 'Groq', model: this.groqModel };
    if (this.geminiModel) return { mode: 'live', provider: 'Google', model: 'Gemini 1.5 Flash' };
    return { mode: 'unavailable', provider: 'None', model: 'Add GROQ_API_KEY or GEMINI_API_KEY' };
  }
  async diagnoseFromTelemetry(telemetryHistory, faultType = null, mlPrediction = null) {
    // Live AI is the default whenever a provider key is configured.
    if (this.forceDeterministicDemo || (!this.groqClient && !this.geminiModel)) {
      return this.getFallbackDiagnosis(telemetryHistory, faultType, mlPrediction);
    }
    const recentReadings = telemetryHistory.slice(-10);
    const vehicleProfile = getVehicleProfile();
    const prompt = `You are an expert vehicle diagnostic AI for Stellantis STLA platform vehicles. You are acting as the Layer 2 Contextual AI Agent in an enterprise diagnostic pipeline.
An Edge Analytics Engine (XGBoost) has already analyzed the telemetry and generated a PRIMARY prediction. Your job is to validate it, perform contextual reasoning, generate a customer-friendly explanation, determine if it can be fixed via remote OTA/ECU commands, and provide a SECONDARY confidence score.
### Primary telemetry-pattern prediction (generated from sensor readings, never from a UI fault button):
${JSON.stringify(mlPrediction, null, 2)}
### Configured Vehicle Identity
${JSON.stringify(vehicleProfile, null, 2)}
### Recent Telemetry Data (Last ${recentReadings.length} readings):
${JSON.stringify(recentReadings, null, 2)}
Analyze the data and respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "rootCause": "string - Detailed explanation of what happened and why (e.g., 'Engine coolant pressure continuously decreased over the last 18 seconds, increasing engine temperature...')",
  "affectedSystem": "string - From ML prediction",
  "severity": number (1-5, based on ML severity),
  "primaryConfidence": number (the ML prediction confidence),
  "contextualConfidence": number (0-100, your updated secondary confidence after contextual reasoning),
  "riskAssessment": "string - what could happen if not addressed",
  "isAutoFixable": boolean (can this be resolved remotely via software/ECU commands?),
  "recommendedAction": "string - immediate recommended action",
  "engineerExplanation": "string - deeply technical explanation for a mechanic",
  "customerExplanation": "string - friendly explanation for the driver"
}`;
    try {
      if (this.groqClient) {
        const chatCompletion = await this.groqClient.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: this.groqModel,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        });
        const text = chatCompletion.choices[0].message.content.trim();
        const diagnosis = this._normaliseDiagnosis(JSON.parse(text), mlPrediction);
        this.lastDiagnosis = diagnosis;
        return diagnosis;
      } else {
        const result = await this.geminiModel.generateContent(prompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const diagnosis = this._normaliseDiagnosis(JSON.parse(text), mlPrediction);
        this.lastDiagnosis = diagnosis;
        return diagnosis;
      }
    } catch (err) {
      console.error('❌ AI diagnoseFromTelemetry API error:', err.message);
      return this.getFallbackDiagnosis(telemetryHistory, faultType, mlPrediction);
    }
  }
  async extractResolutionIntent(transcript, diagnosis) {
    if (!this.groqClient && !this.geminiModel) {
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
      let jsonStr;
      if (this.groqClient) {
        const chatCompletion = await this.groqClient.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: this.groqModel,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        });
        jsonStr = chatCompletion.choices[0].message.content.trim();
      } else {
        const result = await this.geminiModel.generateContent(prompt);
        const text = result.response.text().trim();
        jsonStr = text.includes('```') ? text.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : text;
      }
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('❌ AI extractResolutionIntent API error:', err.message);
      return {
        decision: diagnosis?.isAutoFixable ? 'auto-fix' : 'escalate',
        confidence: 75,
        reasoning: 'Fallback based on diagnosis'
      };
    }
  }
  async generateCallResponse(engineerMessage, diagnosis, telemetryHistory, conversation = []) {
    this.lastDiagnosis = diagnosis;
    this.lastTelemetry = telemetryHistory;

    // Weather is live data, so do not let the language model guess it. This is
    // available even when the configured AI provider is temporarily unavailable.
    if (isWeatherQuestion(engineerMessage)) {
      const location = extractWeatherLocation(engineerMessage);
      if (!location) return 'Please tell me which city you want the weather for.';
      try {
        return formatWeatherReply(await getCurrentWeather(location));
      } catch (err) {
        console.error('Weather lookup failed:', err.message);
        return 'I could not retrieve the current weather right now.';
      }
    }

    if (this.forceDeterministicDemo || (!this.groqClient && !this.geminiModel)) {
      return this._getFallbackCallResponse(engineerMessage, telemetryHistory);
    }
    const vehicleProfile = getVehicleProfile();
    const prompt = `You are Stella A.I., a capable conversational AI assistant speaking on a live phone call with a human automotive engineer.
Answer direct questions naturally, including general knowledge questions as a helpful ChatGPT-like assistant. Do not turn every question into a diagnostic summary or dispatch recommendation.

GROUNDING RULES:
- For vehicle identity, dimensions, weight, fault state, or TCU readings, use only the configured vehicle profile and live telemetry below. Never invent vehicle-specific facts.
- For ordinary general knowledge, answer from your knowledge in a useful, accurate way.
- A live weather lookup is handled by a dedicated tool before this prompt. Do not make up live conditions, current news, or other real-time facts you do not have.

CONVERSATION RULES:
1. Keep phone answers concise: one or two short sentences, maximum 45 words.
2. If the engineer says to dispatch a mechanic, reply only: "Understood. Dispatching the nearest certified mechanic."
3. If the engineer says to dispatch a tow truck, reply only: "Understood. Dispatching a tow truck."
4. If they say to auto-fix, reply only: "Understood. Starting the remote fix."
5. Do not use markdown, emojis, or lists. Talk like a human on the phone.
6. For a general question, answer the question directly without mentioning the car unless it is relevant.

Conversation so far (avoid repeating information already provided unless asked):
${conversation.slice(-6).map(turn => `${turn.speaker}: ${turn.text}`).join('\n') || 'This is the first engineer response.'}

Configured vehicle profile:
${JSON.stringify(vehicleProfile, null, 2)}

Current diagnosis:
${JSON.stringify(diagnosis, null, 2)}

Latest telemetry snapshot:
${JSON.stringify(telemetryHistory.slice(-3), null, 2)}

The engineer just said: "${engineerMessage}"
Respond with only the direct answer. Do not add anything else.`;
    try {
      if (this.groqClient) {
        const chatCompletion = await this.groqClient.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: this.groqModel,
          temperature: 0.7
        });
        return this._shortCallReply(chatCompletion.choices[0].message.content);
      } else {
        const result = await this.geminiModel.generateContent(prompt);
        return this._shortCallReply(result.response.text());
      }
    } catch (err) {
      console.error('❌ AI generateCallResponse API error:', err.message);
      return this._getFallbackCallResponse(engineerMessage, telemetryHistory);
    }
  }
  _shortCallReply(reply) {
    const oneLine = String(reply || '').replace(/\s+/g, ' ').trim();
    const sentences = oneLine.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [oneLine];
    const conciseReply = sentences.slice(0, 2).join(' ').trim();
    if (conciseReply.length <= 340) return conciseReply;
    return `${conciseReply.slice(0, 337).replace(/\s+\S*$/, '')}...`;
  }

  getFallbackDiagnosis(telemetryHistory, faultType = null, mlPrediction = null) {
    const latest = telemetryHistory[telemetryHistory.length - 1];
    if (!latest) {
      return this._normaliseDiagnosis({
        rootCause: 'Insufficient telemetry data',
        affectedSystem: 'Unknown',
        severity: 1,
        primaryConfidence: 0,
        contextualConfidence: 20,
        riskAssessment: 'Cannot assess without data',
        isAutoFixable: false,
        recommendedAction: 'Continue monitoring',
        engineerExplanation: 'No data',
        customerExplanation: 'No data'
      }, mlPrediction);
    }
    const diagnosisMap = {
      coolant: {
        rootCause: 'Coolant system failure. Possible thermostat malfunction or coolant leak causing overheating.',
        affectedSystem: 'Cooling System',
        severity: 4,
        primaryConfidence: mlPrediction?.confidence || 87,
        contextualConfidence: 91,
        riskAssessment: 'Engine overheating imminent. Continued operation risks severe engine damage, head gasket failure, or engine seizure.',
        isAutoFixable: true,
        recommendedAction: 'Initiate emergency coolant system bypass and reduce engine load. Activate auxiliary cooling fan at maximum speed.',
        engineerExplanation: 'Coolant temperature is rising rapidly while coolant pressure and flow rate are declining. This pattern indicates a coolant circulation failure, likely a stuck thermostat or coolant pump degradation.',
        customerExplanation: 'Your vehicle is experiencing a cooling system issue. The engine is running hotter than normal. We can attempt to cool it down remotely.'
      },
      electrical: {
        rootCause: 'Electrical short circuit. Abnormal current draw causing voltage collapse and rapid battery drain.',
        affectedSystem: 'Electrical System',
        severity: 4,
        primaryConfidence: mlPrediction?.confidence || 82,
        contextualConfidence: 88,
        riskAssessment: 'Risk of complete electrical system failure, potential fire hazard from short circuit, loss of critical vehicle systems.',
        isAutoFixable: false,
        recommendedAction: 'Isolate affected circuit via relay control. Reduce non-essential electrical load. Schedule immediate physical inspection.',
        engineerExplanation: 'Voltage is dropping well below normal operating range while current draw is spiking erratically. Battery SOC is depleting. Consistent with a short circuit drawing excess current.',
        customerExplanation: 'There is a severe electrical problem causing your battery to drain very quickly. You should stop driving safely.'
      },
      engine: {
        rootCause: 'Engine mechanical fault. Erratic RPM and oil pressure loss indicating internal engine component failure.',
        affectedSystem: 'Engine / Powertrain',
        severity: 5,
        primaryConfidence: mlPrediction?.confidence || 89,
        contextualConfidence: 95,
        riskAssessment: 'Catastrophic engine failure possible. Low oil pressure risks bearing damage, connecting rod failure, or crankshaft seizure.',
        isAutoFixable: false,
        recommendedAction: 'Reduce engine speed immediately. Enter limp mode. Do not continue driving, arrange tow to nearest certified service center.',
        engineerExplanation: 'RPM is oscillating wildly between extremes while oil pressure is critically low. Combined with elevated vibration levels, this pattern indicates a serious mechanical issue, potentially a failing oil pump.',
        customerExplanation: 'A critical engine fault has been detected. For your safety, the engine must be checked by a mechanic immediately.'
      },
      transmission: {
        rootCause: 'Transmission fault. Gear slip and overheating indicate a hydraulic pressure or clutch-pack problem.',
        affectedSystem: 'Transmission',
        severity: 4,
        primaryConfidence: mlPrediction?.confidence || 84,
        contextualConfidence: 90,
        riskAssessment: 'Continued driving can cause a complete loss of drive, transmission damage, or an unsafe shift event.',
        isAutoFixable: false,
        recommendedAction: 'Stop in a safe location and arrange a certified transmission inspection.',
        engineerExplanation: 'Transmission temperature is rising while hydraulic pressure is falling and measured gear slip is increasing. The combined trend suggests clutch-pack wear or a pressure-control failure.',
        customerExplanation: 'Your vehicle has a transmission problem. Please avoid driving until it has been inspected.',
        affectedParameters: ['Transmission temperature', 'Gear slip', 'Transmission pressure']
      },
      brake: {
        rootCause: 'Brake system fault. Brake temperature is excessive and hydraulic pressure is falling.',
        affectedSystem: 'Braking System',
        severity: 5,
        primaryConfidence: mlPrediction?.confidence || 88,
        contextualConfidence: 94,
        riskAssessment: 'Brake fade or loss of braking force is possible. This is an immediate safety risk.',
        isAutoFixable: false,
        recommendedAction: 'Stop the vehicle safely and arrange emergency roadside assistance. Do not continue driving.',
        engineerExplanation: 'The TCU reports a high brake-temperature trend with falling brake pressure and ABS errors, which can indicate fluid loss, a seized caliper, or a braking-system failure.',
        customerExplanation: 'A critical brake-system problem has been detected. Please stop somewhere safe and do not continue driving.',
        affectedParameters: ['Brake temperature', 'Brake pressure', 'ABS fault count']
      }
    };
    if (faultType && diagnosisMap[faultType]) {
      const diag = this._normaliseDiagnosis(diagnosisMap[faultType], mlPrediction);
      this.lastDiagnosis = diag;
      return diag;
    }
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
    if (latest.transmissionTemp > 100 || latest.gearSlip > 6 || latest.transmissionPressure < 55) {
      anomalies.transmission = (latest.transmissionTemp - 85) / 45 + (latest.gearSlip || 0) / 20 + (72 - latest.transmissionPressure) / 40;
    }
    if (latest.brakeTemp > 240 || latest.brakePressure < 75 || latest.absErrorCount > 0) {
      anomalies.brake = (latest.brakeTemp - 150) / 300 + (110 - latest.brakePressure) / 70 + (latest.absErrorCount || 0) / 8;
    }
    const topAnomaly = Object.entries(anomalies).sort((a, b) => b[1] - a[1])[0];
    if (!topAnomaly) {
      const diag = this._normaliseDiagnosis({
        rootCause: 'Minor sensor fluctuations detected',
        affectedSystem: 'General',
        severity: 1,
        primaryConfidence: 0,
        contextualConfidence: 40,
        riskAssessment: 'Low risk — values within acceptable range',
        isAutoFixable: true,
        recommendedAction: 'Continue monitoring',
        engineerExplanation: 'Values are mostly normal.',
        customerExplanation: 'Everything is fine.'
      }, mlPrediction);
      this.lastDiagnosis = diag;
      return diag;
    }
    const diag = this._normaliseDiagnosis(diagnosisMap[topAnomaly[0]] || diagnosisMap.engine, mlPrediction);
    this.lastDiagnosis = diag;
    return diag;
  }
  _getFallbackCallResponse(engineerMessage, telemetryHistory = this.lastTelemetry || []) {
    if (!engineerMessage) return 'Please state your question.';
    const lower = engineerMessage.toLowerCase();
    const vehicle = getVehicleProfile();
    const latest = telemetryHistory[telemetryHistory.length - 1] || {};
    const diag = this.lastDiagnosis || {};
    const rootCause = diag.rootCause || 'critical system anomaly';
    const severity = diag.severity || 4;
    const confidence = diag.confidence || 87;
    const affectedSystem = diag.affectedSystem || 'Engine / Cooling';
    const riskAssessment = diag.riskAssessment || 'Immediate attention required to prevent further damage';
    if (lower.includes('mechanic') || lower.includes('send someone') || lower.includes('dispatch') && !lower.includes('tow')) {
      return 'Understood. Dispatching the nearest certified mechanic.';
    }
    if (lower.includes('tow') || lower.includes('towing') || lower.includes('truck')) {
      return 'Understood. Dispatching a tow truck.';
    }
    if ((lower.includes('fix') && lower.includes('auto')) || lower.includes('remote fix') || lower.includes('proceed with')) {
      return 'Understood. Starting the remote fix.';
    }
    if (lower.includes('temperature') || lower.includes('temp') || lower.includes('how hot') || lower.includes('coolant')) {
      return latest.coolantTemp !== undefined ? `Coolant temperature is ${latest.coolantTemp} degrees Celsius.` : "I don't have a current coolant-temperature reading.";
    }
    if (lower.includes('oil') || lower.includes('pressure')) {
      return latest.oilPressure !== undefined ? `Oil pressure is ${latest.oilPressure} PSI.` : "I don't have a current oil-pressure reading.";
    }
    if (lower.includes('rpm') || lower.includes('engine speed') || lower.includes('vibration')) {
      return latest.rpm !== undefined ? `The latest engine speed is ${latest.rpm} RPM and vibration is ${latest.vibration ?? 'unavailable'} g.` : "I don't have a current engine-speed reading.";
    }
    if (lower.includes('voltage') || lower.includes('battery') || lower.includes('electrical') || lower.includes('current')) {
      return latest.voltage !== undefined ? `Voltage is ${latest.voltage} volts and current draw is ${latest.current ?? 'unavailable'} amps.` : "I don't have a current electrical reading.";
    }
    if (lower.includes('weight') || lower.includes('heavy')) {
      return vehicle.curbWeightKg === 'Not configured' ? 'The curb weight is not configured for this vehicle profile.' : `Configured curb weight is ${vehicle.curbWeightKg} kilograms.`;
    }
    if (lower.includes('size') || lower.includes('dimensions')) {
      return vehicle.lengthMm === 'Not configured' ? 'Vehicle dimensions are not configured for this vehicle profile.' : `Length is ${vehicle.lengthMm} millimetres, width ${vehicle.widthMm} millimetres, and height ${vehicle.heightMm} millimetres.`;
    }
    if (lower.includes('brand') || lower.includes('model') || lower.includes('vehicle') || lower.includes('car') || lower.includes('type')) {
      return `${vehicle.brand} ${vehicle.model}, ${vehicle.trim}, model year ${vehicle.modelYear}, registration ${vehicle.registration}.`;
    }
    if (lower.includes('severity') || lower.includes('how bad') || lower.includes('serious') || lower.includes('critical')) {
      return `Severity is ${severity} of 5; confidence is ${confidence} percent.`;
    }
    if (lower.includes('detail') || lower.includes('explain') || lower.includes('tell me') || lower.includes('more info') || lower.includes('what happened') || lower.includes('what is') || lower.includes('what\'s')) {
      return `Root cause: ${rootCause}`;
    }
    if (lower.includes('location') || lower.includes('where') || lower.includes('gps') || lower.includes('map')) {
      return 'The vehicle is on MG Road, Bangalore.';
    }
    if (lower.includes('you solve') || lower.includes('yourself') || lower.includes('figure it out') || lower.includes('handle it') || lower.includes('you decide')) {
      return 'A tow truck is recommended.';
    }
    if (lower.includes('yes') || lower.includes('go ahead') || lower.includes('do it') || lower.includes('proceed') || lower.includes('okay') || lower.includes('sure') || lower.includes('alright')) {
      return 'Understood. Dispatching a tow truck.';
    }
    if (lower.includes('no') || lower.includes('wait') || lower.includes('hold on') || lower.includes('not yet')) {
      return 'Understood. Standing by.';
    }
    return "I don't have that information.";
  }
}
module.exports = { GeminiDiagnosis };
