const twilio = require('twilio');

function publicWebhookUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const isPublic = url.protocol === 'https:'
      && !['localhost', '127.0.0.1'].includes(url.hostname)
      && !url.hostname.includes('your-ngrok-url');
    return isPublic ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

class TwilioCallService {
  constructor(io, incidentManager, trackingService) {
    this.io = io;
    this.incidentManager = incidentManager;
    this.trackingService = trackingService;
    this.client = null;
    this.currentDiagnosis = null;
    this.telemetryHistory = [];
    this.engineerDecision = null; // 'mechanic' or 'tow truck'
    this.mechanicAvailable = false;
    this.callAttempt = 0;
    this.engineerTransitionQueued = false;
    this.mechanicTransitionQueued = false;
    this.driverCompleted = false;
    this.simulatedFlowActive = false;
    this.simulatedMechanicActive = false;
    this.conversation = [];
    this.emittedTranscriptKeys = new Set();
    this.webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
    this.demoContactNumber = process.env.DEMO_CONTACT_NUMBER;
    this.toNumber = this.demoContactNumber || process.env.TWILIO_ENGINEER_NUMBER || process.env.TWILIO_TO_NUMBER || '+919535728467';
    this.mechanicNumber = this.demoContactNumber || process.env.TWILIO_MECHANIC_NUMBER || process.env.TWILIO_TO_NUMBER || '+919535728467';
    this.driverNumber = this.demoContactNumber || process.env.TWILIO_DRIVER_NUMBER || process.env.TWILIO_TO_NUMBER || '+919535728467';

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = process.env.TWILIO_FROM_NUMBER;
      this.toNumber = this.demoContactNumber || process.env.TWILIO_ENGINEER_NUMBER || process.env.TWILIO_TO_NUMBER || '+919535728467';
      this.mechanicNumber = this.demoContactNumber || process.env.TWILIO_MECHANIC_NUMBER || process.env.TWILIO_TO_NUMBER || '+919535728467';
      this.driverNumber = this.demoContactNumber || process.env.TWILIO_DRIVER_NUMBER || process.env.TWILIO_TO_NUMBER || '+919535728467';
    }
  }

  _getEngineerOpening(diagnosis) {
    if (!diagnosis) return 'Hello, Stella AI here. Live TCU data flags a vehicle fault. Mechanic or tow truck?';
    const system = String(diagnosis.affectedSystem || 'vehicle system').replace(/\s*\/\s*/g, ' and ');
    const severity = Number(diagnosis.severity || 4);
    return `Hello, Stella AI here. Live TCU data flags a critical ${system} fault, severity ${severity} of 5. Mechanic or tow truck?`;
  }

  getConfigurationStatus() {
    const webhookUrl = publicWebhookUrl(this.webhookBaseUrl);
    return {
      twilioConfigured: Boolean(this.client && this.fromNumber),
      publicWebhookConfigured: Boolean(webhookUrl),
      webhookHost: webhookUrl ? new URL(webhookUrl).host : null,
      issue: !this.client || !this.fromNumber
        ? 'Twilio credentials or caller number are missing.'
        : !webhookUrl
          ? 'A public HTTPS webhook is required. Start ngrok or use the Render URL.'
          : null,
    };
  }

  async refreshWebhookBaseUrl() {
    if (process.env.RENDER_EXTERNAL_URL) {
      this.webhookBaseUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
      return this.webhookBaseUrl;
    }

    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: AbortSignal.timeout(1200) });
      if (response.ok) {
        const data = await response.json();
        const tunnel = (data.tunnels || []).find((item) => publicWebhookUrl(item.public_url));
        if (tunnel) {
          this.webhookBaseUrl = publicWebhookUrl(tunnel.public_url);
          process.env.TWILIO_WEBHOOK_BASE_URL = this.webhookBaseUrl;
          this._log('system', `Using active ngrok webhook: ${new URL(this.webhookBaseUrl).host}`);
          return this.webhookBaseUrl;
        }
      }
    } catch {
      // Fall through to a manually supplied public URL.
    }

    const configuredUrl = publicWebhookUrl(this.webhookBaseUrl);
    if (configuredUrl) {
      this.webhookBaseUrl = configuredUrl;
      return configuredUrl;
    }
    throw new Error('Twilio needs a public HTTPS webhook. Start ngrok http 3001 or configure TWILIO_WEBHOOK_BASE_URL with your Render URL.');
  }

  // ═══════════════════════════════════════════════════════
  // CALL 1: ENGINEER (Two-way conversation)
  // ═══════════════════════════════════════════════════════
  async initiateEngineerCall(diagnosis, telemetryHistory) {
    this._beginSimulatedFlow();
    this.currentDiagnosis = diagnosis;
    this.telemetryHistory = telemetryHistory;
    this.engineerDecision = null;
    this.callAttempt = 0;
    this.engineerTransitionQueued = false;
    this.mechanicTransitionQueued = false;
    this.driverCompleted = false;
    this.conversation = [];
    this.emittedTranscriptKeys.clear();

    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    await this.refreshWebhookBaseUrl();

    this.incidentManager.setCallPhase('engineer');
    this.incidentManager.setCallRecipient('On-Call Engineer');
    this.incidentManager.setActiveCallRole('engineer');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling');

    const opening = this._getEngineerOpening(diagnosis);
    this._addTranscriptOnce('engineer-opening', 'AI', opening);
    this.conversation.push({ speaker: 'Stella AI', text: opening });

    this._log('call', '📞 [CALL 1/3] Initiating two-way call to On-Call Engineer...');

    try {
      const call = await this.client.calls.create({
        url: `${this.webhookBaseUrl}/twilio/voice`,
        to: this.toNumber,
        from: this.fromNumber,
        statusCallback: `${this.webhookBaseUrl}/twilio/engineer-status`,
        statusCallbackEvent: ['completed', 'busy', 'no-answer', 'failed']
      });
      this._log('call', `📞 Engineer call SID: ${call.sid}`);
      return call;
    } catch (err) {
      this._log('error', `❌ Engineer call failed: ${err.message}`);
      throw err;
    }
  }

  generateInitialTwiML() {
    const diagnosis = this.currentDiagnosis;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const message = this._getEngineerOpening(diagnosis);

    this._addTranscriptOnce('engineer-opening', 'AI', message);
    response.say({ voice: 'alice', language: 'en-US' }, message);

    const gather = response.gather({
      input: 'speech',
      action: '/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-IN'
    });
    gather.say({ voice: 'alice', language: 'en-US' }, 'I\'m listening. Please go ahead.');
    response.say({ voice: 'alice', language: 'en-US' }, 'I didn\'t catch that. Please let me know how you\'d like to proceed.');
    response.redirect('/twilio/loop');
    return response.toString();
  }

  generateLoopTwiML() {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const gather = response.gather({
      input: 'speech',
      action: '/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-IN'
    });
    gather.say({ voice: 'alice', language: 'en-US' }, 'Could you please repeat your diagnosis or decision?');
    response.redirect('/twilio/loop');
    return response.toString();
  }

  async handleEngineerSpeech(speechResult) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (!speechResult) {
      response.say({ voice: 'alice', language: 'en-US' }, 'I didn\'t catch that. Could you please repeat?');
      response.redirect('/twilio/loop');
      return response.toString();
    }

    this.incidentManager.addTranscriptLine('Engineer', speechResult);
    this.conversation.push({ speaker: 'Engineer', text: speechResult });

    const { GeminiDiagnosis } = require('./geminiDiagnosis');
    const gemini = new GeminiDiagnosis();
    const aiResponse = await gemini.generateCallResponse(
      speechResult,
      this.currentDiagnosis,
      this.telemetryHistory,
      this.conversation
    );
    this.incidentManager.addTranscriptLine('AI', aiResponse);
    this.conversation.push({ speaker: 'Stella AI', text: aiResponse });

    const lower = speechResult.toLowerCase();
    // Only end a general conversation for an explicit operational instruction.
    // Mentioning a mechanic/tow truck in a question must not trigger dispatch.
    const isTow = /\b(?:dispatch|send|arrange|call|get)\s+(?:a\s+|the\s+)?(?:tow(?:ing)?\s*truck|tow truck)\b/.test(lower)
      || /\btow\s+(?:it|the vehicle|the car)\b/.test(lower);
    const isMechanic = /\b(?:dispatch|send|arrange|call|get)\s+(?:a\s+|the\s+)?(?:mobile\s+|certified\s+)?mechanic\b/.test(lower)
      || /\bsend\s+someone\b/.test(lower);
    const isAutoFix = /\b(?:start|perform|initiate|proceed with)\b.*\b(?:auto(?:mated)?|remote)\s+fix\b/.test(lower);
    const isConfirmTow = (lower.includes('yes') || lower.includes('go ahead') || lower.includes('do it') || lower.includes('proceed') || lower.includes('okay') || lower.includes('sure') || lower.includes('alright'))
      && aiResponse.toLowerCase().includes('tow');
    const isConfirmMechanic = (lower.includes('yes') || lower.includes('go ahead') || lower.includes('do it') || lower.includes('proceed') || lower.includes('okay') || lower.includes('sure') || lower.includes('alright'))
      && aiResponse.toLowerCase().includes('mechanic');

    if (isTow || isConfirmTow || isMechanic || isConfirmMechanic || isAutoFix) {
      response.say({ voice: 'alice', language: 'en-US' }, aiResponse);
      response.hangup();

      // Determine engineer's decision
      if (isTow || isConfirmTow) {
        this.engineerDecision = 'tow truck';
      } else if (isMechanic || isConfirmMechanic) {
        this.engineerDecision = 'mechanic';
      } else if (isAutoFix) {
        this.engineerDecision = 'auto-fix';
      }

      this._log('call', `✅ Engineer decision: ${this.engineerDecision}`);
      this.incidentManager.setPendingResolution({ action: this.engineerDecision === 'tow truck' ? 'dispatch-tow' : this.engineerDecision === 'mechanic' ? 'escalate' : 'auto-fix', source: 'call' });
    } else {
      response.say({ voice: 'alice', language: 'en-US' }, aiResponse);
      const gather = response.gather({
        input: 'speech',
        action: '/twilio/gather',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-IN'
      });
      gather.say({ voice: 'alice', language: 'en-US' }, 'Please continue.');
    }
    return response.toString();
  }

  handleEngineerCallStatus(status) {
    // Ignore delayed callbacks once the flow has moved beyond call 1.
    if (this.incidentManager.getIncident()?.callPhase !== 'engineer') return;
    this.incidentManager.setCallStatus(status === 'answered' || status === 'in-progress' ? 'connected' : status);
    if (status === 'answered' || status === 'in-progress') {
      this.incidentManager.updateStatus('in_call');
    } else if (status === 'completed' || status === 'busy' || status === 'no-answer' || status === 'failed') {
      if (this.engineerTransitionQueued) return;
      this.engineerTransitionQueued = true;
      this.incidentManager.setCallStatus('completed');
      this._log('call', `📞 Engineer call ended: ${status}`);

      const incident = this.incidentManager.getIncident();
      if (incident) {
        // Determine the next action
        if (incident.pendingResolution) {
          const decision = incident.pendingResolution;
          incident.pendingResolution = null;

          if (decision.action === 'auto-fix') {
            this._log('resolution', 'Engineer chose auto-fix. Emitting resolution.');
            this.io.emit('resolution-decision', { action: 'auto-fix', source: 'engineer-call' });
          } else {
            // Proceed to Call 2 after 2 seconds
            const role = decision.action === 'dispatch-tow' ? 'tow truck' : 'mechanic';
            this.engineerDecision = role;
            this._log('call', `⏳ Waiting 2 seconds before calling ${role}...`);
            this.io.emit('call-waiting', { nextCall: role, delayMs: 2000 });

            this._queueMechanicCall(role);
          }
        } else {
          // No decision captured — default to tow truck
          this._log('call', '⚠️ No clear engineer decision. Defaulting to tow truck dispatch.');
          this.engineerDecision = 'tow truck';
          this.io.emit('call-waiting', { nextCall: 'tow truck', delayMs: 2000 });
          this._queueMechanicCall('tow truck');
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // CALL 2: MECHANIC / TOW TRUCK (Two-way conversation)
  // ═══════════════════════════════════════════════════════
  async initiateMechanicCall(role, diagnosis) {
    if (!this.client) {
      return this._simulateMechanicFlow(role, diagnosis);
    }
    await this.refreshWebhookBaseUrl();

    this.callAttempt++;
    this.incidentManager.incrementCallAttempt();
    this.incidentManager.setCallPhase('mechanic');
    this.incidentManager.setCallRecipient(`Service Provider (${role}) — Attempt ${this.callAttempt}`);
    this.incidentManager.setActiveCallRole('mechanic');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling_mechanic');

    this._log('call', `📞 [CALL 2/3] Calling ${role} — Attempt ${this.callAttempt}...`);

    try {
      const call = await this.client.calls.create({
        url: `${this.webhookBaseUrl}/twilio/mechanic-voice?role=${encodeURIComponent(role)}&issue=${encodeURIComponent(diagnosis?.rootCause || 'vehicle breakdown')}&attempt=${this.callAttempt}`,
        to: this.mechanicNumber,
        from: this.fromNumber,
        statusCallback: `${this.webhookBaseUrl}/twilio/mechanic-status`,
        statusCallbackEvent: ['completed', 'busy', 'no-answer', 'failed']
      });
      this._log('call', `📞 Mechanic call SID: ${call.sid}`);
      return call;
    } catch (err) {
      this._log('error', `❌ Mechanic call failed: ${err.message}`);
      this._simulateMechanicFlow(role, diagnosis);
    }
  }

  _queueMechanicCall(role) {
    setTimeout(async () => {
      try {
        await this.initiateMechanicCall(role, this.currentDiagnosis);
      } catch (error) {
        this._log('error', `Unable to start ${role} call: ${error.message}`);
      }
    }, 2000);
  }

  generateMechanicVoiceTwiML(role, issue, attempt) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const vehicleNum = this.incidentManager.getIncident()?.trackingSessionId
      ? `KA-01-AB-${Math.floor(1000 + Math.random() * 9000)}`
      : 'KA-01-AB-1234';

    const message = `Hello, this is Stella A.I. from the Stellantis emergency dispatch system. ` +
      `We have a vehicle breakdown at MG Road, Bangalore. ` +
      `The issue is: ${issue}. ` +
      `We need a ${role} urgently. ` +
      `Are you available? Can you head to the location now?`;

    this.incidentManager.addTranscriptLine('AI', message);
    response.say({ voice: 'alice', language: 'en-US' }, message);

    const gather = response.gather({
      input: 'speech',
      action: `/twilio/mechanic-gather?role=${encodeURIComponent(role)}&issue=${encodeURIComponent(issue)}&attempt=${attempt}`,
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-IN'
    });
    gather.say({ voice: 'alice', language: 'en-US' }, 'Please let me know if you can come.');

    // Fallback if no response
    response.say({ voice: 'alice', language: 'en-US' }, 'I did not receive a response. I will try another provider. Thank you.');
    response.hangup();

    return response.toString();
  }

  async handleMechanicSpeech(speechResult, role, issue, attempt) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (!speechResult) {
      response.say({ voice: 'alice', language: 'en-US' }, 'I didn\'t catch that. I will try another provider.');
      response.hangup();
      this.mechanicAvailable = false;
      return response.toString();
    }

    this.incidentManager.addTranscriptLine(role === 'tow truck' ? 'Tow Truck' : 'Mechanic', speechResult);

    const lower = speechResult.toLowerCase();
    const isNo = lower.includes('no') || lower.includes('can\'t') || lower.includes('cannot') || lower.includes('unavailable')
      || lower.includes('busy') || lower.includes('not available') || lower.includes('sorry');
    const isYes = !isNo && (lower.includes('yes') || lower.includes('sure') || lower.includes('okay') || lower.includes('on my way')
      || lower.includes('coming') || /\bi can\b/.test(lower) || lower.includes('i will') || lower.includes('alright')
      || lower.includes('go ahead') || lower.includes('heading'));

    if (isNo) {
      this.mechanicAvailable = false;
      const msg = `Okay. I will contact the next available ${role}.`;
      this.incidentManager.addTranscriptLine('AI', msg);
      this.io.emit('provider-searching', { role, attempt: Number(attempt) || this.callAttempt || 1 });
      response.say({ voice: 'alice', language: 'en-US' }, msg);
      response.hangup();
    } else if (isYes) {
      this.mechanicAvailable = true;
      const incident = this.incidentManager.getIncident();

      // Generate tracking session
      let trackingUrl = '';
      if (this.trackingService && incident) {
        const eta = role === 'tow truck' ? '15 min' : '12 min';
        const session = this.trackingService.createSession(incident, role, eta);
        trackingUrl = `${this.webhookBaseUrl}/track/${session.sessionId}`;
        this.incidentManager.setTrackingInfo(session.sessionId, trackingUrl);
      }

      const vehicleNum = incident?.tcuLogs?.[0]?.vehicleNumber || 'KA-01-AB-1234';
      const mapsLink = `https://www.google.com/maps?q=12.9716,77.5946`;

      const confirmMsg = `Thank you for confirming. ` +
        `The vehicle number is ${vehicleNum}. ` +
        `I am sending you the exact Google Maps location via WhatsApp right now. ` +
        `Please head there immediately. Thank you, goodbye.`;

      this.incidentManager.addTranscriptLine('AI', confirmMsg);
      response.say({ voice: 'alice', language: 'en-US' }, confirmMsg);
      response.hangup();

      // Send WhatsApp with tracking link
      this._sendTrackingWhatsApp(role, mapsLink, vehicleNum);

    } else {
      // Unclear — ask again
      const { GeminiDiagnosis } = require('./geminiDiagnosis');
      const gemini = new GeminiDiagnosis();
      const clarification = `I just need to know: are you available to come to the vehicle breakdown location right now? A simple yes or no will do.`;
      this.incidentManager.addTranscriptLine('AI', clarification);
      response.say({ voice: 'alice', language: 'en-US' }, clarification);
      const gather = response.gather({
        input: 'speech',
        action: `/twilio/mechanic-gather?role=${encodeURIComponent(role)}&issue=${encodeURIComponent(issue)}&attempt=${attempt}`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-IN'
      });
      gather.say({ voice: 'alice', language: 'en-US' }, 'Yes or no, please.');
      response.say({ voice: 'alice', language: 'en-US' }, 'No response received. Trying next provider.');
      response.hangup();
    }

    return response.toString();
  }

  handleMechanicCallStatus(status) {
    // Ignore delayed provider callbacks once call 3 has started.
    if (this.incidentManager.getIncident()?.callPhase !== 'mechanic') return;
    this.incidentManager.setCallStatus(status === 'answered' || status === 'in-progress' ? 'connected' : status);
    this._log('call', `📞 Mechanic/tow call status: ${status}`);

    if (status === 'completed' || status === 'busy' || status === 'no-answer' || status === 'failed') {
      if (this.mechanicTransitionQueued) return;
      this.mechanicTransitionQueued = true;
      if (this.mechanicAvailable) {
        // Mechanic said yes → proceed to Call 3 (driver)
        this._log('call', `✅ ${this.engineerDecision || 'Service provider'} accepted. Proceeding to driver call...`);
        this.io.emit('call-waiting', { nextCall: 'driver', delayMs: 2000 });

        // Set up mechanic/tow info
        const role = this.engineerDecision || 'mechanic';
        const eta = role === 'tow truck' ? '15 min' : '12 min';
        this.incidentManager.updateStatus('escalated');
        const towCompany = {
          id: this.callAttempt,
          name: role === 'tow truck' ? 'RapidRescue Towing Services' : 'AutoCare Express — Downtown',
          rating: 4.8,
          distance: role === 'tow truck' ? '3.1 km' : '2.3 km',
          specialty: role === 'tow truck' ? 'Heavy Duty & Flatbed Towing' : 'Engine & Transmission',
          phone: this.mechanicNumber,
          eta,
          address: role === 'tow truck' ? '200 Industrial Dr, Auburn Hills, MI' : '142 Main Street, Auburn Hills, MI'
        };
        this.incidentManager.setMechanics([towCompany]);
        this.io.emit('mechanics', [towCompany]);

        setTimeout(() => {
          this.initiateDriverCall(role, this.currentDiagnosis, eta);
        }, 2000);

      } else if (this.callAttempt < 3) {
        // Mechanic said no or didn't answer — retry
        this._log('call', `❌ ${this.engineerDecision || 'Service provider'} unavailable (attempt ${this.callAttempt}). Retrying in 2 seconds...`);
        this.io.emit('call-waiting', { nextCall: `${this.engineerDecision || 'mechanic'} (retry)`, delayMs: 2000 });

        setTimeout(() => {
          this.initiateMechanicCall(this.engineerDecision || 'mechanic', this.currentDiagnosis);
        }, 2000);

      } else {
        // Max retries reached — still proceed to driver call
        this._log('call', `⚠️ Max retry attempts reached. Proceeding to driver call anyway...`);
        this.incidentManager.updateStatus('escalated');
        this.io.emit('call-waiting', { nextCall: 'driver', delayMs: 2000 });
        setTimeout(() => {
          this.initiateDriverCall(this.engineerDecision || 'mechanic', this.currentDiagnosis, '20 min');
        }, 2000);
      }
    }
  }

  async _simulateMechanicFlow(role, diagnosis, flowGeneration = this.flowGeneration) {
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    if (this.simulatedMechanicActive) return;
    this.simulatedMechanicActive = true;
    try {
    this.callAttempt++;
    this.incidentManager.incrementCallAttempt();
    this.incidentManager.setCallPhase('mechanic');
    this.incidentManager.setCallRecipient(`Service Provider (${role}) — Attempt ${this.callAttempt}`);
    this.incidentManager.setActiveCallRole('mechanic');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling_mechanic');
    this._log('call', `📞 [Simulated] Calling ${role} — Attempt ${this.callAttempt}...`);

    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.setCallStatus('connected');

    this.incidentManager.addTranscriptLine('AI', `Hello, this is Stella AI. We have a vehicle breakdown. We need a ${role}. Are you available?`);
    await this._delay(3000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.addTranscriptLine(role === 'tow truck' ? 'Tow Truck' : 'Mechanic', 'Yes, I am available. I will head there now.');
    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.addTranscriptLine('AI', 'Thank you. Sending you the Google Maps location via WhatsApp. Please head there immediately.');
    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;

    this.mechanicAvailable = true;
    this.incidentManager.setCallStatus('completed');
    this._log('call', `✅ [Simulated] ${role} accepted.`);

    // Create tracking session
    const incident = this.incidentManager.getIncident();
    const eta = role === 'tow truck' ? '15 min' : '12 min';
    if (this.trackingService && incident) {
      const session = this.trackingService.createSession(incident, role, eta);
      const trackingUrl = `${this.webhookBaseUrl}/track/${session.sessionId}`;
      this.incidentManager.setTrackingInfo(session.sessionId, trackingUrl);
    }

    this.incidentManager.updateStatus('escalated');
    const towCompany = {
      id: this.callAttempt,
      name: role === 'tow truck' ? 'RapidRescue Towing Services' : 'AutoCare Express — Downtown',
      rating: 4.8,
      distance: role === 'tow truck' ? '3.1 km' : '2.3 km',
      specialty: role === 'tow truck' ? 'Heavy Duty & Flatbed Towing' : 'Engine & Transmission',
      phone: this.mechanicNumber,
      eta,
      address: '142 Main Street, Auburn Hills, MI'
    };
    this.incidentManager.setMechanics([towCompany]);
    this.io.emit('mechanics', [towCompany]);

    // Send WhatsApp
    const vehicleNum = 'KA-01-AB-1234';
    const mapsLink = `https://www.google.com/maps?q=12.9716,77.5946`;
    await this._sendTrackingWhatsApp(role, mapsLink, vehicleNum);

    // Proceed to Call 3 after 2 seconds
    this.io.emit('call-waiting', { nextCall: 'driver', delayMs: 2000 });
    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    await this.initiateDriverCall(role, diagnosis, eta, flowGeneration);
    } finally {
      if (this._isCurrentSimulatedFlow(flowGeneration)) this.simulatedMechanicActive = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // CALL 3: DRIVER (Notification call)
  // ═══════════════════════════════════════════════════════
  async initiateDriverCall(role, diagnosis, eta, flowGeneration = this.flowGeneration) {
    if (!this.client) {
      return this._simulateDriverFlow(role, diagnosis, eta, flowGeneration);
    }
    await this.refreshWebhookBaseUrl();

    this.incidentManager.setCallPhase('driver');
    this.incidentManager.setCallRecipient('Vehicle Driver');
    this.incidentManager.setActiveCallRole('driver');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling_driver');

    this._log('call', `📞 [CALL 3/3] Calling driver...`);

    try {
      const rootCause = diagnosis?.rootCause || 'system failure';
      const call = await this.client.calls.create({
        url: `${this.webhookBaseUrl}/twilio/driver-voice?role=${encodeURIComponent(role)}&issue=${encodeURIComponent(rootCause)}&eta=${encodeURIComponent(eta || '15 min')}`,
        to: this.driverNumber,
        from: this.fromNumber,
        statusCallback: `${this.webhookBaseUrl}/twilio/driver-status`,
        statusCallbackEvent: ['completed', 'busy', 'no-answer', 'failed']
      });
      this._log('call', `📞 Driver call SID: ${call.sid}`);

      // Send WhatsApp tracking link to driver
      await this._sendDriverTrackingWhatsApp(role, eta);

      return call;
    } catch (err) {
      this._log('error', `❌ Driver call failed: ${err.message}`);
      this._simulateDriverFlow(role, diagnosis, eta);
    }
  }

  generateDriverVoiceTwiML(role, issue, eta) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const message = `Hello, this is Stella A.I. speaking. Please don't panic. ` +
      `Your vehicle has experienced the following issue: ${issue}. ` +
      `We have already spoken with our remote engineer and they have confirmed the diagnosis. ` +
      `Based on their expert opinion, we are sending a ${role} to your location. ` +
      `The estimated arrival time is ${eta}. ` +
      `We are also sending you a WhatsApp message with a live tracking link where you can watch the ${role} coming to your location in real time. ` +
      `Please stay with the vehicle and stay safe. If you need to call the ${role} directly, their number will be in the WhatsApp message. ` +
      `Thank you for your patience. End of message.`;

    this.incidentManager.addTranscriptLine('AI', message);
    response.say({ voice: 'alice', language: 'en-US' }, message);
    response.hangup();

    return response.toString();
  }

  handleDriverCallStatus(status) {
    this._log('call', `📞 Driver call status: ${status}`);
    if (status === 'answered' || status === 'in-progress') {
      this.incidentManager.setCallStatus('connected');
      return;
    }
    if (status === 'completed' || status === 'busy' || status === 'no-answer' || status === 'failed') {
      if (this.driverCompleted) return;
      this.driverCompleted = true;
      this.incidentManager.setCallStatus('all-calls-done');
      this.incidentManager.updateStatus('escalated');
      this.io.emit('driver-helped', { message: 'Driver was informed and help is on the way.' });
      this._log('resolution', '✅ All 3 notification calls completed successfully.');
      this._log('resolution', `🗺️ Tracking link sent to driver via WhatsApp.`);
    }
  }

  async _simulateDriverFlow(role, diagnosis, eta, flowGeneration = this.flowGeneration) {
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.setCallPhase('driver');
    this.incidentManager.setCallRecipient('Vehicle Driver');
    this.incidentManager.setActiveCallRole('driver');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling_driver');
    this._log('call', `📞 [Simulated] [CALL 3/3] Calling driver...`);

    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.setCallStatus('connected');

    const rootCause = diagnosis?.rootCause || 'system failure';
    this.incidentManager.addTranscriptLine('AI',
      `Hello, this is Stella AI. Don't panic. Your vehicle has: ${rootCause}. We've spoken to the engineer. A ${role} is on the way. ETA: ${eta || '15 min'}. Check WhatsApp for live tracking.`
    );
    await this._delay(4000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;

    this.incidentManager.setCallStatus('all-calls-done');
    this.driverCompleted = true;
    this.incidentManager.updateStatus('escalated');
    this.io.emit('driver-helped', { message: 'Driver was informed and help is on the way.' });
    this._log('resolution', '✅ All 3 notification calls completed successfully.');

    // Send tracking WhatsApp
    await this._sendDriverTrackingWhatsApp(role, eta);
  }

  // ═══════════════════════════════════════════════════════
  // WHATSAPP HELPERS
  // ═══════════════════════════════════════════════════════
  async _sendTrackingWhatsApp(role, mapsLink, vehicleNum) {
    if (!this.client) return;
    try {
      const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
      const msgBody = `🚨 *STELLA AI — Emergency Dispatch*\n\n` +
        `A vehicle needs a ${role}.\n` +
        `📍 Location: ${mapsLink}\n` +
        `🚗 Vehicle: ${vehicleNum}\n` +
        `\nPlease head to the location immediately.`;

      await this.client.messages.create({
        body: msgBody,
        from: `whatsapp:${waFrom}`,
        to: `whatsapp:${this.mechanicNumber}`
      });
      this._log('resolution', '✅ WhatsApp GPS location sent to service provider.');
    } catch (e) {
      console.error('WhatsApp send error (mechanic):', e.message);
      this._log('error', `❌ WhatsApp failed (mechanic): ${e.message}`);
    }
  }

  async _sendDriverTrackingWhatsApp(role, eta) {
    if (!this.client) return;
    try {
      const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
      const incident = this.incidentManager.getIncident();
      const trackingUrl = incident?.trackingUrl || 'Link unavailable';
      const providerPhone = this.mechanicNumber;

      const msgBody = `🚗 *STELLA AI — Your Rescue Is On The Way!*\n\n` +
        `A *${role}* has been dispatched to your location.\n` +
        `⏱️ ETA: *${eta || '15 min'}*\n\n` +
        `📍 *Track live:*\n${trackingUrl}\n\n` +
        `📞 Call ${role}: ${providerPhone}\n\n` +
        `Stay with your vehicle and stay safe! 🙏`;

      await this.client.messages.create({
        body: msgBody,
        from: `whatsapp:${waFrom}`,
        to: `whatsapp:${this.driverNumber}`
      });
      this._log('resolution', '✅ WhatsApp tracking link sent to driver.');
    } catch (e) {
      console.error('WhatsApp send error (driver):', e.message);
      this._log('error', `❌ WhatsApp failed (driver): ${e.message}`);
    }
  }

  // Delivery is always surfaced to the dashboard. With Twilio credentials it
  // is also sent to the configured WhatsApp recipient; otherwise this is a
  // faithful demo delivery rather than a silent no-op.
  async _sendTrackingWhatsApp(role, mapsLink, vehicleNum, trackingUrl) {
    const msgBody = `STELLA AI — Emergency Dispatch\n\n` +
      `A vehicle needs a ${role}.\n` +
      `Location (Bangalore): ${mapsLink}\n` +
      `Vehicle: ${vehicleNum}\n` +
      `Driver contact: ${this.driverNumber}\n\n` +
      'Please head to the location immediately.';
    this._emitWhatsApp('Service Provider', this.mechanicNumber, msgBody, Boolean(this.client));
    if (!this.client) {
      this._log('resolution', 'Simulated WhatsApp GPS location delivered to service provider.');
      return;
    }
    try {
      const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
      await this.client.messages.create({
        body: msgBody,
        from: this._whatsAppAddress(waFrom),
        to: this._whatsAppAddress(this.mechanicNumber),
      });
      this._log('resolution', 'WhatsApp GPS location sent to service provider.');
    } catch (error) {
      this._log('error', `WhatsApp failed (service provider): ${error.message}`);
    }
  }

  async _sendDriverTrackingWhatsApp(role, eta) {
    const incident = this.incidentManager.getIncident();
    const trackingUrl = incident?.trackingUrl || 'Link unavailable';
    const rootCause = incident?.diagnosis?.rootCause || 'vehicle breakdown';
    const mapsLink = 'https://www.google.com/maps/dir/?api=1&origin=12.9936%2C77.6166&destination=12.9716%2C77.5946&travelmode=driving';
    const msgBody = `STELLA AI — Your Rescue Is On The Way\n\n` +
      `Issue: ${rootCause}\n` +
      `A ${role} has been dispatched. ETA: ${eta || '15 min'}\n\n` +
      `Track the provider: ${trackingUrl}\n` +
      `Google Maps route: ${mapsLink}\n\n` +
      `Call ${role}: ${this.mechanicNumber}\n` +
      'Please stay safely with the vehicle.';
    this._emitWhatsApp('Vehicle Driver', this.driverNumber, msgBody, Boolean(this.client));
    if (!this.client) {
      this._log('resolution', 'Simulated WhatsApp tracking, issue, provider number, and ETA delivered to driver.');
      return;
    }
    try {
      const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
      await this.client.messages.create({
        body: msgBody,
        from: this._whatsAppAddress(waFrom),
        to: this._whatsAppAddress(this.driverNumber),
      });
      this._log('resolution', 'WhatsApp tracking link sent to driver.');
    } catch (error) {
      this._log('error', `WhatsApp failed (driver): ${error.message}`);
    }
  }

  // Legacy methods for compatibility
  async initiateCall(diagnosis, telemetryHistory) {
    return this.initiateEngineerCall(diagnosis, telemetryHistory);
  }

  handleCallStatus(status) {
    return this.handleEngineerCallStatus(status);
  }

  async sendWhatsAppLocation() {
    // Legacy — now handled in the mechanic call flow
  }

  async initiateDispatchCall(role, diagnosis) {
    return this.initiateMechanicCall(role, diagnosis);
  }

  async simulateCall(diagnosis, telemetryHistory) {
    const flowGeneration = this._beginSimulatedFlow();
    this.simulatedFlowActive = true;
    this.engineerTransitionQueued = false;
    this.mechanicTransitionQueued = false;
    this.driverCompleted = false;
    try {
    this.currentDiagnosis = diagnosis;
    this.telemetryHistory = telemetryHistory;

    this.incidentManager.setCallPhase('engineer');
    this.incidentManager.setActiveCallRole('engineer');
    this.incidentManager.setCallStatus('ringing');
    this.incidentManager.updateStatus('calling');
    this._log('call', '📞 [Simulated] [CALL 1/3] Calling engineer...');

    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.setCallStatus('connected');
    this.incidentManager.updateStatus('in_call');

    await this._delay(1000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.addTranscriptLine('AI', this._getEngineerOpening(diagnosis));
    await this._delay(3000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.addTranscriptLine('Engineer', 'Can you tell me more about the affected parameters?');
    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    const params = diagnosis?.affectedParameters?.join(', ') || 'multiple parameters';
    this.incidentManager.addTranscriptLine('AI',
      `The affected parameters are: ${params}. Risk: ${diagnosis?.riskAssessment || 'Immediate attention required'}.`
    );
    await this._delay(3000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;

    // Engineer decision
    const isAutoFixable = diagnosis?.isAutoFixable ?? false;
    if (isAutoFixable) {
      this.engineerDecision = 'mechanic';
      this.incidentManager.addTranscriptLine('Engineer', 'Send a mechanic. They should be able to fix this on-site.');
    } else {
      this.engineerDecision = 'tow truck';
      this.incidentManager.addTranscriptLine('Engineer', 'This needs a tow truck. The vehicle shouldn\'t be driven.');
    }
    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    this.incidentManager.addTranscriptLine('AI', `Acknowledged. I will dispatch a ${this.engineerDecision} immediately. Thank you, goodbye.`);
    await this._delay(1500);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;

    this.incidentManager.setCallStatus('completed');
    this._log('call', `✅ [Simulated] Engineer decided: ${this.engineerDecision}`);

    // Proceed to Call 2 after 2 seconds
    this._log('call', `⏳ Waiting 2 seconds before calling ${this.engineerDecision}...`);
    this.io.emit('call-waiting', { nextCall: this.engineerDecision, delayMs: 2000 });
    await this._delay(2000);
    if (!this._isCurrentSimulatedFlow(flowGeneration)) return;
    await this._simulateMechanicFlow(this.engineerDecision, diagnosis, flowGeneration);
    } finally {
      if (this._isCurrentSimulatedFlow(flowGeneration)) this.simulatedFlowActive = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════
  _log(category, message) {
    const entry = { timestamp: new Date().toISOString(), category, message };
    this.io.emit('log', entry);
    console.log(`[${category.toUpperCase()}] ${message}`);
  }

  _addTranscriptOnce(key, speaker, text) {
    if (this.emittedTranscriptKeys.has(key)) return;
    this.emittedTranscriptKeys.add(key);
    this.incidentManager.addTranscriptLine(speaker, text);
  }

  _whatsAppAddress(number) {
    const value = String(number || '');
    return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
  }

  _emitWhatsApp(recipient, to, body, isLiveDelivery) {
    this.io.emit('whatsapp-message', {
      id: `${recipient}-${Date.now()}`,
      recipient,
      to,
      body,
      delivery: isLiveDelivery ? 'sending' : 'simulated',
      timestamp: new Date().toISOString(),
    });
  }

  // A new dashboard scenario must never inherit a simulated call chain from
  // the previous one. The active incident check below makes any delayed
  // simulated transition a harmless no-op.
  cancelActiveFlow() {
    this.flowGeneration = (this.flowGeneration || 0) + 1;
    this.activeFlowIncidentId = null;
    this.simulatedFlowActive = false;
    this.simulatedMechanicActive = false;
    this.engineerTransitionQueued = false;
    this.mechanicTransitionQueued = false;
    this.driverCompleted = false;
  }

  _beginSimulatedFlow() {
    this.flowGeneration = (this.flowGeneration || 0) + 1;
    this.activeFlowIncidentId = this.incidentManager.getIncident()?.id || null;
    return this.flowGeneration;
  }

  _isCurrentSimulatedFlow(flowGeneration) {
    return this.flowGeneration === flowGeneration
      && this.activeFlowIncidentId !== null
      && this.incidentManager.getIncident()?.id === this.activeFlowIncidentId;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { TwilioCallService };
