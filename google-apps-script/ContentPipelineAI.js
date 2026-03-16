/**
 * WAAS Content Pipeline — AI API Wrapper
 * Obsługuje 3 providery: Grok (xAI), OpenAI, Claude (Anthropic)
 * 
 * API Keys w Script Properties:
 *   GROK_API_KEY, OPENAI_API_KEY, CLAUDE_API_KEY
 * 
 * @version 1.0
 */

// ============================================================================
// KONFIGURACJA MODELI
// ============================================================================

var AI_MODELS = {
  'Grok': {
    url: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-4-fast-reasoning',
    keyName: 'GROK_API_KEY',
    maxTokens: 16000,
    supportsSystem: true,
  },
  'OpenAI': {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    keyName: 'OPENAI_API_KEY',
    maxTokens: 16000,
    supportsSystem: true,
  },
  'Claude': {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    keyName: 'CLAUDE_API_KEY',
    maxTokens: 16000,
    supportsSystem: true,
    isAnthropic: true,
  },
};

var DEFAULT_PROVIDER = 'Claude';

// ============================================================================
// GŁÓWNA FUNKCJA — wywołaj AI
// ============================================================================

/**
 * Wywołuje AI API z system promptem i user promptem
 * 
 * @param {string} systemPrompt - Stały system prompt (reguły, zasady)
 * @param {string} userPrompt - User message (research + zadanie)
 * @param {string} provider - 'Grok', 'OpenAI', lub 'Claude'
 * @param {number} temperature - 0.0-1.0 (default 0.7)
 * @param {number} maxTokens - max output tokens (default from config)
 * @returns {Object} { success, text, usage, error }
 */
function cpCallAI(systemPrompt, userPrompt, provider, temperature, maxTokens) {
  provider = provider || DEFAULT_PROVIDER;
  temperature = (temperature !== undefined && temperature !== null) ? temperature : 0.7;
  
  var config = AI_MODELS[provider];
  if (!config) {
    // Fallback
    config = AI_MODELS[DEFAULT_PROVIDER];
    provider = DEFAULT_PROVIDER;
  }
  
  var apiKey = PropertiesService.getScriptProperties().getProperty(config.keyName);
  if (!apiKey) {
    return { 
      success: false, 
      error: 'Brak API key: ' + config.keyName + '. Dodaj w Script Properties.' 
    };
  }
  
  maxTokens = maxTokens || config.maxTokens;
  
  try {
    if (config.isAnthropic) {
      return cpCallAnthropic(config, apiKey, systemPrompt, userPrompt, temperature, maxTokens);
    } else {
      return cpCallOpenAICompatible(config, apiKey, systemPrompt, userPrompt, temperature, maxTokens);
    }
  } catch (e) {
    return { success: false, error: provider + ' API error: ' + e.message };
  }
}

// ============================================================================
// OpenAI-compatible API (Grok + OpenAI)
// ============================================================================

function cpCallOpenAICompatible(config, apiKey, systemPrompt, userPrompt, temperature, maxTokens) {
  var messages = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });
  
  var payload = {
    model: config.model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
  };
  
  var options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  var response = UrlFetchApp.fetch(config.url, options);
  var code = response.getResponseCode();
  var rawText = response.getContentText();
  
  // Handle non-JSON responses (504, 502, etc.)
  var body;
  try {
    body = JSON.parse(rawText);
  } catch(e) {
    return { success: false, error: 'HTTP ' + code + ': ' + rawText.substring(0, 200) };
  }
  
  if (code === 200 && body.choices && body.choices[0]) {
    var text = body.choices[0].message.content;
    return {
      success: true,
      text: text,
      usage: body.usage || {},
    };
  } else {
    var errMsg = body.error ? body.error.message : ('HTTP ' + code + ': ' + rawText.substring(0, 200));
    return { success: false, error: errMsg };
  }
}

// ============================================================================
// Anthropic API (Claude)
// ============================================================================

function cpCallAnthropic(config, apiKey, systemPrompt, userPrompt, temperature, maxTokens) {
  var payload = {
    model: config.model,
    max_tokens: maxTokens,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  };
  
  if (systemPrompt) {
    payload.system = systemPrompt;
  }
  
  // Claude nie obsługuje temperature > 1.0
  if (temperature !== undefined) {
    payload.temperature = Math.min(temperature, 1.0);
  }
  
  var options = {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  var response = UrlFetchApp.fetch(config.url, options);
  var code = response.getResponseCode();
  var rawText = response.getContentText();
  
  var body;
  try {
    body = JSON.parse(rawText);
  } catch(e) {
    return { success: false, error: 'HTTP ' + code + ': ' + rawText.substring(0, 200) };
  }
  
  if (code === 200 && body.content && body.content[0]) {
    var text = body.content[0].text;
    return {
      success: true,
      text: text,
      usage: body.usage || {},
    };
  } else {
    var errMsg = body.error ? body.error.message : ('HTTP ' + code);
    return { success: false, error: errMsg };
  }
}

// ============================================================================
// TEST CONNECTION
// ============================================================================

function cpTestAI() {
  var ui = SpreadsheetApp.getUi();
  var provider = DEFAULT_PROVIDER;
  
  var result = cpCallAI(
    'You are a test assistant.',
    'Respond with exactly: {"status":"ok","provider":"' + provider + '"}',
    provider,
    0.0,
    100
  );
  
  if (result.success) {
    ui.alert('AI Connection OK!\n\nProvider: ' + provider + '\nResponse: ' + result.text.substring(0, 200) + '\nTokens: ' + JSON.stringify(result.usage));
  } else {
    ui.alert('AI Connection FAILED!\n\nProvider: ' + provider + '\nError: ' + result.error);
  }
}

/**
 * Setup API keys dialog
 */
function cpSetupAPIKeys() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  
  var html = HtmlService.createHtmlOutput(
    '<style>body{font-family:Arial;padding:15px}input{width:100%;padding:6px;margin:4px 0 12px 0;box-sizing:border-box}label{font-weight:bold;font-size:12px}button{background:#EF6C00;color:white;padding:8px 20px;border:none;cursor:pointer;margin-top:10px}</style>' +
    '<label>Grok API Key (x.ai):</label>' +
    '<input id="grok" value="' + (props.getProperty('GROK_API_KEY') || '') + '">' +
    '<label>OpenAI API Key:</label>' +
    '<input id="openai" value="' + (props.getProperty('OPENAI_API_KEY') || '') + '">' +
    '<label>Claude API Key (Anthropic):</label>' +
    '<input id="claude" value="' + (props.getProperty('CLAUDE_API_KEY') || '') + '">' +
    '<button onclick="save()">Save Keys</button>' +
    '<script>function save(){google.script.run.withSuccessHandler(function(){alert("Saved!");google.script.host.close()}).cpSaveAPIKeys(document.getElementById("grok").value,document.getElementById("openai").value,document.getElementById("claude").value)}</script>'
  ).setWidth(400).setHeight(320);
  
  ui.showModalDialog(html, 'AI API Keys');
}

function cpSaveAPIKeys(grok, openai, claude) {
  var props = PropertiesService.getScriptProperties();
  if (grok) props.setProperty('GROK_API_KEY', grok);
  if (openai) props.setProperty('OPENAI_API_KEY', openai);
  if (claude) props.setProperty('CLAUDE_API_KEY', claude);
}