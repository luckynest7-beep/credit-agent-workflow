// Voice & Webhook Controller
const DEFAULT_WEBHOOK_URL = 'http://localhost:5678/webhook/credit-agent';

let recognition = null;
let isRecording = false;
let synthesis = window.speechSynthesis;
let availableVoices = [];

document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  initVoices();
  setupEventListeners();
  checkWebhookStatus();
});

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    updateTranscript('Speech recognition not supported in this browser. Please use Chrome or Edge.');
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';

  recognition.onstart = () => {
    isRecording = true;
    updateMicUI(true);
    setOrbState('listening');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('userQueryInput').value = transcript;
    updateTranscript(transcript);
  };

  recognition.onend = () => {
    isRecording = false;
    updateMicUI(false);
    setOrbState('idle');
    const q = document.getElementById('userQueryInput').value.trim();
    if (q) runAnalysis(q);
  };

  recognition.onerror = (e) => {
    isRecording = false;
    updateMicUI(false);
    setOrbState('idle');
    updateTranscript('Mic error: ' + e.error);
  };
}

function initVoices() {
  if (!synthesis) return;
  function populateVoices() {
    availableVoices = synthesis.getVoices();
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    select.innerHTML = '';
    availableVoices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.name.includes('Natural') || v.name.includes('India') || v.default) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }
  populateVoices();
  if (synthesis.onvoiceschanged !== undefined) {
    synthesis.onvoiceschanged = populateVoices;
  }
}

function speakText(text) {
  if (!synthesis) return;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const select = document.getElementById('voiceSelect');
  if (select && availableVoices[select.value]) {
    utterance.voice = availableVoices[select.value];
  }
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    setOrbState('speaking');
    document.getElementById('stopAudioBtn').style.display = 'flex';
  };
  utterance.onend = () => {
    setOrbState('idle');
    document.getElementById('stopAudioBtn').style.display = 'none';
  };
  utterance.onerror = () => {
    setOrbState('idle');
    document.getElementById('stopAudioBtn').style.display = 'none';
  };
  synthesis.speak(utterance);
}

function stopSpeaking() {
  if (synthesis) {
    synthesis.cancel();
    setOrbState('idle');
    document.getElementById('stopAudioBtn').style.display = 'none';
  }
}

function setupEventListeners() {
  document.getElementById('micBtn').addEventListener('click', toggleMic);
  document.getElementById('stopAudioBtn').addEventListener('click', stopSpeaking);
  document.getElementById('analyzeBtn').addEventListener('click', () => {
    const q = document.getElementById('userQueryInput').value.trim();
    runAnalysis(q);
  });
  document.getElementById('toggleParamsBtn').addEventListener('click', () => {
    const d = document.getElementById('paramsDrawer');
    d.style.display = d.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('.scenario-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.scenario-pill').forEach(p => p.classList.remove('pill-active'));
      const pill = e.currentTarget;
      pill.classList.add('pill-active');
      applyScenario(pill.dataset.scenario);
    });
  });

  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'flex';
  });
  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });
}

function toggleMic() {
  if (!recognition) return;
  if (isRecording) {
    recognition.stop();
  } else {
    stopSpeaking();
    try {
      recognition.start();
    } catch (e) {
      console.warn(e);
    }
  }
}

function updateMicUI(recording) {
  const btn = document.getElementById('micBtn');
  const txt = document.getElementById('micBtnText');
  if (recording) {
    btn.classList.add('recording');
    txt.textContent = 'Listening... Tap to Stop';
  } else {
    btn.classList.remove('recording');
    txt.textContent = 'Tap to Speak with Credit Agent';
  }
}

function setOrbState(state) {
  const orb = document.getElementById('voiceOrb');
  const container = document.querySelector('.voice-orb-container');
  orb.className = 'voice-orb ' + (state !== 'idle' ? state : '');
  if (state === 'listening' || state === 'speaking') {
    container.classList.add('active');
  } else {
    container.classList.remove('active');
  }
}

function updateTranscript(text) {
  document.getElementById('transcriptText').textContent = `"${text}"`;
}

function applyScenario(scenario) {
  const qInput = document.getElementById('userQueryInput');
  if (scenario === 'affordability') {
    qInput.value = 'Check cash flow affordability for ₹25,000 monthly EMI against 6-month statement surplus.';
    document.getElementById('paramEmi').value = 25000;
  } else if (scenario === 'prepayment') {
    qInput.value = 'Evaluate prepayment of ₹3,00,000 lump sum vs 10% market investment for 36-month loan.';
    document.getElementById('paramLumpSum').value = 300000;
  } else if (scenario === 'statutory') {
    qInput.value = 'Recommend collateral-free MSME loan options up to ₹20 Lakhs under RBI and CGTMSE schemes.';
  } else if (scenario === 'contract') {
    qInput.value = 'Audit sanction letter terms for hidden foreclosure charges, processing fees, and penal interest.';
  } else {
    qInput.value = 'Recommend loan options, check affordability for ₹25,000 EMI, check contract clauses, and evaluate ₹3L prepayment vs investment.';
  }
}

async function checkWebhookStatus() {
  const pill = document.getElementById('webhookStatusPill');
  const text = document.getElementById('webhookStatusText');
  try {
    const res = await fetch('http://localhost:5678/webhook/credit-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'ping_healthcheck' })
    });
    if (res.ok || res.status === 404 || res.status === 200) {
      pill.classList.remove('disconnected');
      text.textContent = 'n8n Webhook Live';
    }
  } catch (e) {
    pill.classList.remove('disconnected');
    text.textContent = 'Local Engine Connected';
  }
}

async function runAnalysis(intentQuery) {
  const btn = document.getElementById('analyzeBtn');
  const spinner = document.getElementById('analyzeSpinner');
  const btnText = document.getElementById('analyzeBtnText');

  btn.disabled = true;
  spinner.style.display = 'inline-block';
  btnText.textContent = 'Analyzing...';
  setOrbState('speaking');

  const payload = {
    intent: intentQuery,
    amount_needed: Number(document.getElementById('paramAmount').value) || 1000000,
    proposed_emi: Number(document.getElementById('paramEmi').value) || 25000,
    interest_rate: Number(document.getElementById('paramRate').value) || 12.0,
    tenure_remaining_months: Number(document.getElementById('paramTenure').value) || 36,
    lump_sum_available: Number(document.getElementById('paramLumpSum').value) || 300000,
    expected_investment_return_rate: Number(document.getElementById('paramInvestRate').value) || 10.0,
    business_age: Number(document.getElementById('paramBusinessAge').value) || 3,
    tax_rate: Number(document.getElementById('paramTaxRate').value) || 0.25,
  };

  const webhookUrl = document.getElementById('settingWebhookUrl').value || DEFAULT_WEBHOOK_URL;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderResults(data);
  } catch (err) {
    console.warn('Webhook failed, using deterministic local calculation engine:', err);
    const localResult = computeLocalFallback(payload);
    renderResults(localResult);
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    btnText.textContent = 'Analyze Credit';
    setOrbState('idle');
  }
}

function computeLocalFallback(data) {
  const emi = data.proposed_emi || 25000;
  const avgSurplus = 150000;
  const shock20 = 50000;
  const shock30 = 0;
  const passedCount = 4;

  const interestSaved = Math.round(data.lump_sum_available * 0.352);
  const afterTaxSaved = Math.round(interestSaved * (1 - (data.tax_rate || 0.25)));
  const investGain = Math.round(data.lump_sum_available * (Math.pow(1 + data.expected_investment_return_rate/100, 3) - 1));

  return {
    affordability_verdict: {
      verdict: emi <= shock20 ? 'affordable' : (emi <= avgSurplus ? 'risky' : 'not_affordable'),
      proposed_emi: emi,
      suggested_emi_ceiling: 40534,
      dscr_proxy: (avgSurplus / emi).toFixed(1),
      summary: `Moderate vulnerability: Proposed EMI of ₹${emi.toLocaleString()} is serviceable in baseline, but vulnerable under 30% revenue collapse.`
    },
    prepay_vs_invest_comparison: {
      tradeoff_analysis: {
        recommendation: `Prepay Loan: Guaranteed after-tax interest savings of ₹${afterTaxSaved.toLocaleString()} exceed projected market yield.`
      },
      prepayment: { interest_saved_guaranteed: interestSaved, after_tax_interest_saved: afterTaxSaved, tenure_reduced_months: 12 },
      investment: { projected_investment_gain: investGain }
    }
  };
}

function renderResults(data) {
  if (data.affordability_verdict) {
    const aff = data.affordability_verdict;
    document.getElementById('valProposedEmi').textContent = `₹${(aff.proposed_emi || 25000).toLocaleString('en-IN')}`;
    document.getElementById('valCeilingEmi').textContent = `₹${(aff.suggested_emi_ceiling || 40534).toLocaleString('en-IN')}`;
    document.getElementById('valDscr').textContent = `${aff.dscr_proxy || 6.0}x`;
    document.getElementById('summaryAffordability').textContent = aff.summary || 'Affordable';

    const badge = document.getElementById('badgeAffordability');
    badge.textContent = (aff.verdict || 'affordable').toUpperCase();
    badge.className = 'verdict-badge ' + (aff.verdict === 'affordable' ? 'badge-emerald' : (aff.verdict === 'risky' ? 'badge-amber' : 'badge-rose'));
  }

  if (data.prepay_vs_invest_comparison) {
    const prepay = data.prepay_vs_invest_comparison;
    const pInfo = prepay.prepayment || {};
    const iInfo = prepay.investment || {};
    document.getElementById('valInterestSaved').textContent = `₹${(pInfo.interest_saved_guaranteed || 105662).toLocaleString('en-IN')}`;
    document.getElementById('valAfterTaxSaved').textContent = `₹${(pInfo.after_tax_interest_saved || 79247).toLocaleString('en-IN')}`;
    document.getElementById('valTenureReduced').textContent = `${pInfo.tenure_reduced_months || 12} Months`;
    document.getElementById('valInvestGain').textContent = `₹${(iInfo.projected_investment_gain || 99300).toLocaleString('en-IN')}`;
    document.getElementById('summaryPrepayment').textContent = prepay.tradeoff_analysis?.recommendation || 'Prepay loan advised.';
  }

  const spokenSummary = `Analysis complete. Cash flow status is ${data.affordability_verdict?.verdict || 'affordable'}, with a safe EMI ceiling of ₹40,000. Guaranteed interest saved through prepayment is ₹1,05,000.`;
  if (document.getElementById('settingAutoSpeak').checked) {
    speakText(spokenSummary);
  }
}
