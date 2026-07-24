/**
 * Twilio Call Service — handles real two-way voice calls + simulated fallback.
 * Places outbound calls via Twilio, manages TwiML webhooks, and streams
 * live transcript updates via Socket.IO.
 */
const twilio = require('twilio');

class TwilioCallService {
  constructor(io, incidentManager) {
    this.io = io;
    this.incidentManager = incidentManager;
    this.client = null;
    this.currentDiagnosis = null;
    this.telemetryHistory = [];

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = process.env.TWILIO_FROM_NUMBER;
      this.toNumber = process.env.TWILIO_TO_NUMBER;
      this.webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || 'https://your-ngrok-url.ngrok.io';
    }
  }

  /**
   * Initiate a real Twilio voice call to the on-call engineer.
   */
  async initiateCall(diagnosis, telemetryHistory) {
    this.currentDiagnosis = diagnosis;
    this.telemetryHistory = telemetryHistory;

    if (!this.client) {
      throw new Error('Twilio not configured');
    }

    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling');

    const call = await this.client.calls.create({
      url: `${this.webhookBaseUrl}/twilio/voice`,
      to: this.toNumber,
      from: this.fromNumber,
      statusCallback: `${this.webhookBaseUrl}/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    return call;
  }

  /**
   * Generate initial TwiML for the call — AI speaks the diagnosis.
   */
  generateInitialTwiML() {
    const diagnosis = this.currentDiagnosis;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const message = diagnosis
      ? `Hello, this is STLA Guardian AI calling from the Stellantis diagnostic system. ` +
        `We've detected a critical issue: ${diagnosis.rootCause}. ` +
        `Severity level ${diagnosis.severity} out of 5, with ${diagnosis.confidence} percent confidence. ` +
        `Risk assessment: ${diagnosis.riskAssessment}. ` +
        `Recommended action: ${diagnosis.recommendedAction}. ` +
        `Would you like me to proceed with automated resolution, or should we dispatch a field mechanic?`
      : `Hello, this is STLA Guardian AI. We've detected a vehicle anomaly requiring your attention. Please advise on next steps.`;

    response.say({ voice: 'Polly.Matthew' }, message);

    const gather = response.gather({
      input: 'speech',
      action: '/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    gather.say({ voice: 'Polly.Matthew' }, 'I\'m listening. Please go ahead.');

    // If no input, prompt again
    response.say({ voice: 'Polly.Matthew' }, 'I didn\'t catch that. Please let me know how you\'d like to proceed.');
    response.redirect('/twilio/voice');

    return response.toString();
  }

  /**
   * Handle engineer's speech input from Twilio gather.
   */
  async handleEngineerSpeech(speechResult) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (!speechResult) {
      response.say({ voice: 'Polly.Matthew' }, 'I didn\'t catch that. Could you please repeat?');
      response.redirect('/twilio/voice');
      return response.toString();
    }

    // Add to transcript
    this.incidentManager.addTranscriptLine('Engineer', speechResult);

    // Get AI response using Gemini
    const { GeminiDiagnosis } = require('./geminiDiagnosis');
    const gemini = new GeminiDiagnosis();
    const aiResponse = await gemini.generateCallResponse(
      speechResult,
      this.currentDiagnosis,
      this.telemetryHistory
    );

    this.incidentManager.addTranscriptLine('AI', aiResponse);

    // Check if this is a resolution decision
    const lower = speechResult.toLowerCase();
    const isAutoFix = lower.includes('fix') || lower.includes('proceed') || lower.includes('approve') || lower.includes('yes') || lower.includes('auto');
    const isEscalate = lower.includes('mechanic') || lower.includes('escalate') || lower.includes('send') || lower.includes('dispatch') || lower.includes('no');

    if (isAutoFix || isEscalate) {
      response.say({ voice: 'Polly.Matthew' }, aiResponse + ' Thank you. I\'ll proceed with this course of action. Goodbye.');
      response.hangup();

      // Trigger resolution
      const action = isAutoFix ? 'auto-fix' : 'escalate';
      setTimeout(() => {
        this.io.emit('resolution-decision', { action, source: 'call' });
      }, 2000);
    } else {
      // Continue conversation
      response.say({ voice: 'Polly.Matthew' }, aiResponse);
      const gather = response.gather({
        input: 'speech',
        action: '/twilio/gather',
        method: 'POST',
        speechTimeout: 'auto'
      });
      gather.say({ voice: 'Polly.Matthew' }, 'Please continue.');
    }

    return response.toString();
  }

  /**
   * Handle call status callbacks from Twilio.
   */
  handleCallStatus(status) {
    this.incidentManager.setCallStatus(status);

    if (status === 'answered' || status === 'in-progress') {
      this.incidentManager.updateStatus('in_call');
    } else if (status === 'completed') {
      this.incidentManager.setCallStatus('completed');
    }
  }

  /**
   * Simulated call flow — used when Twilio is not configured.
   * Creates a realistic fake conversation with proper timing.
   */
  async simulateCall(diagnosis, telemetryHistory) {
    this.currentDiagnosis = diagnosis;
    this.telemetryHistory = telemetryHistory;

    const isAutoFixable = diagnosis?.isAutoFixable ?? true;

    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling');

    // Phase 1: Ringing
    await this._delay(2000);

    // Phase 2: Connected
    this.incidentManager.setCallStatus('connected');
    this.incidentManager.updateStatus('in_call');
    await this._delay(1000);

    // Phase 3: AI introduces itself
    this.incidentManager.addTranscriptLine('AI',
      `Hello, this is STLA Guardian AI calling from the Stellantis diagnostic system. We've detected a critical issue with the vehicle.`
    );
    await this._delay(3000);

    // Phase 4: AI explains diagnosis
    this.incidentManager.addTranscriptLine('AI',
      `Our analysis indicates: ${diagnosis?.rootCause || 'System anomaly detected'}. ` +
      `Severity level ${diagnosis?.severity || 4} out of 5, with ${diagnosis?.confidence || 85}% confidence.`
    );
    await this._delay(3000);

    // Phase 5: Engineer asks for details
    this.incidentManager.addTranscriptLine('Engineer',
      `Can you give me more details on the affected parameters?`
    );
    await this._delay(2000);

    // Phase 6: AI provides details
    const params = diagnosis?.affectedParameters?.join(', ') || 'multiple parameters';
    this.incidentManager.addTranscriptLine('AI',
      `The affected parameters are: ${params}. ` +
      `Risk assessment: ${diagnosis?.riskAssessment || 'Immediate attention required'}.`
    );
    await this._delay(3000);

    // Phase 7: Engineer makes decision
    if (isAutoFixable) {
      this.incidentManager.addTranscriptLine('Engineer',
        `Understood. The data looks consistent with a ${diagnosis?.affectedSystem?.toLowerCase() || 'system'} issue. Go ahead and proceed with the automated fix.`
      );
      await this._delay(2000);

      this.incidentManager.addTranscriptLine('AI',
        `Confirmed. Initiating automated resolution procedure now. I'll normalize the affected systems and monitor for stability. Thank you.`
      );
    } else {
      this.incidentManager.addTranscriptLine('Engineer',
        `This looks like it needs hands-on inspection. The ${diagnosis?.affectedSystem?.toLowerCase() || 'system'} issue can't be safely resolved remotely. Please dispatch the nearest certified mechanic.`
      );
      await this._delay(2000);

      this.incidentManager.addTranscriptLine('AI',
        `Acknowledged. I'll locate the nearest certified mechanic and calculate an ETA. The vehicle operator will be notified immediately. Thank you.`
      );
    }

    await this._delay(2000);

    // Phase 8: Call ends
    this.incidentManager.setCallStatus('completed');

    // Add timeline entry for conversation complete
    this.incidentManager.incident.timeline.forEach(t => {
      if (t.status === 'in_progress') t.status = 'completed';
    });
    this.incidentManager.incident.timeline.push({
      event: 'call_completed',
      label: 'Call Completed',
      description: isAutoFixable
        ? 'Engineer approved automated resolution'
        : 'Engineer requested mechanic dispatch',
      timestamp: new Date().toISOString(),
      status: 'completed',
      color: isAutoFixable ? 'green' : 'yellow'
    });
    this.io.emit('incident', this.incidentManager.incident);

    await this._delay(1500);

    // Phase 9: Trigger resolution
    const action = isAutoFixable ? 'auto-fix' : 'escalate';
    this.io.emit('resolution-decision', { action, source: 'simulated-call' });
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { TwilioCallService };
