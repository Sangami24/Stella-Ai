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
      this.toNumber = '+919535728467';
      this.mechanicNumber = '+919535728467';
      this.driverNumber = '+919535728467';
      this.webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || 'https://your-ngrok-url.ngrok.io';
    }
  }
  async initiateCall(diagnosis, telemetryHistory) {
    this.currentDiagnosis = diagnosis;
    this.telemetryHistory = telemetryHistory;
    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    this.incidentManager.setCallRecipient('On-Call Engineer');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling');
    try {
      const call = await this.client.calls.create({
        url: `${this.webhookBaseUrl}/twilio/voice`,
        to: this.toNumber,
        from: this.fromNumber,
        statusCallback: `${this.webhookBaseUrl}/twilio/status`
      });
      return call;
    } catch (err) {
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'error', message: `❌ Engineer call failed: ${err.message}` });
    }
  }
  generateInitialTwiML() {
    const diagnosis = this.currentDiagnosis;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const message = diagnosis
      ? `Hello. This is Stella AI calling from the Stellantis diagnostic system. ` +
        `We have detected a critical issue: ${diagnosis.rootCause}. ` +
        `Severity level is ${diagnosis.severity} out of 5, with ${diagnosis.confidence || 85} percent confidence. ` +
        `I need your expert opinion. What do you think is wrong? And should I dispatch a mobile mechanic, or does this require a tow truck?`
      : `Hello, this is Stella AI. We have detected a vehicle anomaly requiring your attention. Please provide your diagnosis and advise if we need a mechanic or a tow truck.`;
    this.incidentManager.addTranscriptLine('AI', message);
    response.say({ voice: 'Polly.Matthew' }, message);
    const gather = response.gather({
      input: 'speech',
      action: '/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    gather.say({ voice: 'Polly.Matthew' }, 'I\'m listening. Please go ahead.');
    response.say({ voice: 'Polly.Matthew' }, 'I didn\'t catch that. Please let me know how you\'d like to proceed.');
    response.redirect('/twilio/voice');
    return response.toString();
  }
  async handleEngineerSpeech(speechResult) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    if (!speechResult) {
      response.say({ voice: 'Polly.Matthew' }, 'I didn\'t catch that. Could you please repeat?');
      response.redirect('/twilio/voice');
      return response.toString();
    }
    this.incidentManager.addTranscriptLine('Engineer', speechResult);
    const { GeminiDiagnosis } = require('./geminiDiagnosis');
    const gemini = new GeminiDiagnosis();
    const aiResponse = await gemini.generateCallResponse(
      speechResult,
      this.currentDiagnosis,
      this.telemetryHistory
    );
    this.incidentManager.addTranscriptLine('AI', aiResponse);
    const lower = speechResult.toLowerCase();
    const isTow = lower.includes('tow') || lower.includes('towing') || lower.includes('truck');
    const isMechanic = lower.includes('mechanic') || lower.includes('dispatch') || lower.includes('send someone') || lower.includes('call the');
    const isAutoFix = (lower.includes('fix') && lower.includes('auto')) || lower.includes('remote fix') || lower.includes('proceed with');
    const isConfirmTow = (lower.includes('yes') || lower.includes('go ahead') || lower.includes('do it') || lower.includes('proceed') || lower.includes('okay') || lower.includes('sure') || lower.includes('alright'))
      && aiResponse.toLowerCase().includes('tow');
    const isConfirmMechanic = (lower.includes('yes') || lower.includes('go ahead') || lower.includes('do it') || lower.includes('proceed') || lower.includes('okay') || lower.includes('sure') || lower.includes('alright'))
      && aiResponse.toLowerCase().includes('mechanic');
    if (isTow || isConfirmTow || isMechanic || isConfirmMechanic || isAutoFix) {
      response.say({ voice: 'Polly.Matthew' }, aiResponse);
      response.hangup();
      let action = 'escalate'; 
      if (isTow || isConfirmTow) action = 'dispatch-tow';
      if (isAutoFix) action = 'auto-fix';
      setTimeout(() => {
        this.io.emit('resolution-decision', { action, source: 'call' });
      }, 2000);
    } else {
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
  handleCallStatus(status) {
    this.incidentManager.setCallStatus(status);
    if (status === 'answered' || status === 'in-progress') {
      this.incidentManager.updateStatus('in_call');
    } else if (status === 'completed') {
      this.incidentManager.setCallStatus('completed');
      const currentIncident = this.incidentManager.getIncident();
      if (currentIncident && currentIncident.status === 'in_call') {
        this.incidentManager.addTranscriptLine('System', 'Call disconnected. Defaulting to tow truck dispatch.');
        setTimeout(() => {
          this.io.emit('resolution-decision', { action: 'dispatch-tow', source: 'auto-fallback' });
        }, 1000);
      }
    }
  }
  async simulateCall(diagnosis, telemetryHistory) {
    this.currentDiagnosis = diagnosis;
    this.telemetryHistory = telemetryHistory;
    const isAutoFixable = diagnosis?.isAutoFixable ?? true;
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling');
    await this._delay(2000);
    this.incidentManager.setCallStatus('connected');
    this.incidentManager.updateStatus('in_call');
    await this._delay(1000);
    this.incidentManager.addTranscriptLine('AI',
      `Hello, this is Stella AI calling from the Stellantis diagnostic system. We've detected a critical issue with the vehicle.`
    );
    await this._delay(3000);
    this.incidentManager.addTranscriptLine('AI',
      `Our analysis indicates: ${diagnosis?.rootCause || 'System anomaly detected'}. ` +
      `Severity level ${diagnosis?.severity || 4} out of 5, with ${diagnosis?.confidence || 85}% confidence.`
    );
    await this._delay(3000);
    this.incidentManager.addTranscriptLine('Engineer',
      `Can you give me more details on the affected parameters?`
    );
    await this._delay(2000);
    const params = diagnosis?.affectedParameters?.join(', ') || 'multiple parameters';
    this.incidentManager.addTranscriptLine('AI',
      `The affected parameters are: ${params}. ` +
      `Risk assessment: ${diagnosis?.riskAssessment || 'Immediate attention required'}.`
    );
    await this._delay(3000);
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
        `This looks like it needs hands-on inspection. The ${diagnosis?.affectedSystem?.toLowerCase() || 'system'} issue is severe. Please dispatch a tow truck immediately.`
      );
      await this._delay(2000);
      this.incidentManager.addTranscriptLine('AI',
        `Acknowledged. I'll dispatch the nearest tow truck and send them the vehicle's GPS location via WhatsApp. Thank you.`
      );
    }
    await this._delay(2000);
    this.incidentManager.setCallStatus('completed');
    this.incidentManager.incident.timeline.forEach(t => {
      if (t.status === 'in_progress') t.status = 'completed';
    });
    this.incidentManager.incident.timeline.push({
      event: 'call_completed',
      label: 'Call Completed',
      description: isAutoFixable
        ? 'Engineer approved automated resolution'
        : 'Engineer requested tow truck dispatch',
      timestamp: new Date().toISOString(),
      status: 'completed',
      color: isAutoFixable ? 'green' : 'red'
    });
    this.io.emit('incident', this.incidentManager.incident);
    await this._delay(1500);
    const action = isAutoFixable ? 'auto-fix' : 'dispatch-tow';
    this.io.emit('resolution-decision', { action, source: 'simulated-call' });
  }
  async initiateDispatchCall(role, diagnosis) {
    if (!this.client) {
      this._simulateDispatchFlow(role, diagnosis);
      return;
    }
    this.incidentManager.setCallRecipient(`Service Provider (${role})`);
    this.incidentManager.setCallStatus('ringing');
    try {
      const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
      const vehicleNum = 'KA-01-AL-2691';
      const mapLink = 'https://maps.app.goo.gl/Kko68pQMc4FBmbzK8';
      const msgBody = `This is the location of the driver\n${mapLink}\nThe vehicle number is ${vehicleNum}`;
      try {
        await this.client.messages.create({
          body: msgBody,
          from: `whatsapp:${waFrom}`,
          to: `whatsapp:${this.mechanicNumber || this.toNumber}`
        });
        this.io.emit('log', { timestamp: new Date().toISOString(), category: 'resolution', message: '✅ WhatsApp GPS location delivered successfully.' });
      } catch (waErr) {
        this.io.emit('log', { timestamp: new Date().toISOString(), category: 'error', message: `⚠️ WhatsApp failed, falling back to SMS: ${waErr.message}` });
      }
      await this.client.messages.create({
        body: msgBody,
        from: this.fromNumber,
        to: this.mechanicNumber || this.toNumber
      });
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'resolution', message: '✅ SMS GPS location delivered successfully.' });
    } catch (e) {
:', e.message);
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'error', message: `❌ WhatsApp Failed: ${e.message} (Did you text the join code?)` });
    }
    try {
      const call = await this.client.calls.create({
        url: `${this.webhookBaseUrl}/twilio/dispatch-voice?role=${encodeURIComponent(role)}&issue=${encodeURIComponent(diagnosis?.rootCause || 'system failure')}`,
        to: this.mechanicNumber || this.toNumber,
        from: this.fromNumber,
        statusCallback: `${this.webhookBaseUrl}/twilio/dispatch-status`
      });
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'call', message: `📞 Calling ${role} at ${this.mechanicNumber || this.toNumber}...` });
      return call;
    } catch (err) {
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'error', message: `❌ Dispatch call failed: ${err.message}` });
      this._simulateDispatchFlow(role, diagnosis);
    }
  }
  async _simulateDispatchFlow(role, diagnosis) {
    this.incidentManager.setCallRecipient(`Service Provider (${role})`);
    this.incidentManager.setCallStatus('ringing');
    this.io.emit('log', { timestamp: new Date().toISOString(), category: 'call', message: `📞 [Simulated] Calling ${role}...` });
    await this._delay(2000);
    this.incidentManager.setCallStatus('connected');
    await this._delay(4000);
    this.incidentManager.setCallStatus('completed');
    this.io.emit('log', { timestamp: new Date().toISOString(), category: 'call', message: `[Simulated] Service provider call status: completed` });
    const incident = this.incidentManager.getIncident();
    if (incident && incident.pendingDriverCall) {
      const { role: r, diagnosis: d, eta } = incident.pendingDriverCall;
      setTimeout(() => {
        this.initiateDriverCall(r, d, eta);
      }, 3000);
      incident.pendingDriverCall = null;
    }
  }
  async initiateDriverCall(role, diagnosis, eta) {
    if (!this.client) {
      this._simulateDriverFlow();
      return;
    }
    this.incidentManager.setCallRecipient('Vehicle Driver');
    this.incidentManager.setCallStatus('ringing');
    try {
      const call = await this.client.calls.create({
        url: `${this.webhookBaseUrl}/twilio/driver-voice?role=${encodeURIComponent(role)}&issue=${encodeURIComponent(diagnosis?.rootCause || 'system failure')}&eta=${encodeURIComponent(eta)}`,
        to: this.driverNumber || this.toNumber,
        from: this.fromNumber,
        statusCallback: `${this.webhookBaseUrl}/twilio/driver-status`
      });
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'call', message: `📞 Calling driver at ${this.driverNumber || this.toNumber}...` });
      return call;
    } catch (err) {
      this.io.emit('log', { timestamp: new Date().toISOString(), category: 'error', message: `❌ Driver call failed: ${err.message}` });
      this._simulateDriverFlow();
    }
  }
  async _simulateDriverFlow() {
    this.incidentManager.setCallRecipient('Vehicle Driver');
    this.incidentManager.setCallStatus('ringing');
    this.io.emit('log', { timestamp: new Date().toISOString(), category: 'call', message: `📞 [Simulated] Calling driver...` });
    await this._delay(2000);
    this.incidentManager.setCallStatus('connected');
    await this._delay(4000);
    this.incidentManager.setCallStatus('all-calls-done');
    this.io.emit('log', { timestamp: new Date().toISOString(), category: 'resolution', message: '✅ All notification calls completed successfully.' });
  }
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
module.exports = { TwilioCallService };
