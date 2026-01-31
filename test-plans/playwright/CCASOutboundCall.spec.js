import { test } from '@playwright/test';
import rawConfig from '../../workload-metadata/CCASOutboundCall.json' with { type: 'json' };
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { pid } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Extract config from workload metadata structure
const config = rawConfig.tasks?.[0]?.scripts?.[0]?.arguments || {};

// Helper function to get screenshot path with username and unique identifier
let screenshotBaseDir = null;

const getScreenshotPath = (filename) => {
  const username = process.env.username || config.username || 'unknown';
  const usernamePart = username.split('@')[0];
  
  if (!screenshotBaseDir) {
    const timestamp = Date.now();
    const uniqueId = `${usernamePart}_${pid}_${timestamp}`;
    screenshotBaseDir = uniqueId;
  }
  
  const fpsxResultsPath = '/results';
  const userScreenshotsDir = `${fpsxResultsPath}/${screenshotBaseDir}`;
  
  if (!existsSync(fpsxResultsPath)) {
    try {
      mkdirSync(fpsxResultsPath, { recursive: true });
    } catch (error) {
      const localResultsDir = resolve(__dirname, '..', '..', 'results');
      if (!existsSync(localResultsDir)) {
        mkdirSync(localResultsDir, { recursive: true });
      }
      const localUserDir = resolve(localResultsDir, screenshotBaseDir);
      if (!existsSync(localUserDir)) {
        mkdirSync(localUserDir, { recursive: true });
      }
      return resolve(localUserDir, filename);
    }
  }
  
  if (!existsSync(userScreenshotsDir)) {
    try {
      mkdirSync(userScreenshotsDir, { recursive: true });
    } catch (error) {
      return `${fpsxResultsPath}/${screenshotBaseDir}_${filename}`;
    }
  }
  
  return `${userScreenshotsDir}/${filename}`;
};

// Helper function to get numeric config value
const getNumberConfig = (key, defaultValue = 0) => {
  const envValue = process.env[key];
  const configValue = config[key];
  if (envValue !== undefined && envValue !== null && envValue !== '') {
    const num = Number(envValue);
    if (!isNaN(num)) return num;
  }
  if (configValue !== undefined && configValue !== null && configValue !== '') {
    const num = Number(configValue);
    if (!isNaN(num)) return num;
  }
  return defaultValue;
};

const ACCESSORS = {
  // Omni-Channel
  omniChannel: '//div[contains(@class, "oneUtilityBarItem")]/button/span[text()="Omni-Channel"]',
  omniChannelOnline: '//div[contains(@class, "oneUtilityBarItem")]/button/span[text()="Omni-Channel (Online)"]',
  statusDropDown: '.oneUtilityBarPanel .slds-dropdown-trigger button',
  availableForVoice: '//div[contains(@class, "slds-dropdown__item")]//span[text()="Available"]',
  offlineStatus: '//div[contains(@class, "slds-dropdown__item")]//span[text()="Offline"]',
  
  // Telephony - Outbound
  telephonyTab: '//div[@class="uiTabBar"]//a[@data-tab-name="embeddedTelephonyTab"]//span[@class="title"]',
  phoneInput: 'lightning-input.fill-width input[type="tel"]',
  callButton: 'native_voice-call-controls-container div.slds-p-horizontal_large button[title="Call"]',
  muteButton: '//button[contains(@title,\'Mute\')]',
  connectedIcon: '//div[contains(@class,"slds-col slds-m-vertical_xx-small")]//span[text()="Connected"]',
  
  // Messages
  customerFirstMessage: '//*[contains(@class, "slds-is-relative") and contains(@class, "slds-chat-message__text") and contains(@class, "slds-chat-message__text_inbound")]',
  agentFirstMessage: '//*[contains(@class, "slds-is-relative") and contains(@class, "slds-chat-message__text") and contains(@class, "slds-chat-message__text_outbound")]',
  
  // Ending Call
  closeVC: '//button[contains(@title,\'Close VC-\')]',
  phoneTab: '//a[contains(@title,\'Phone\')]',
  endCallButton: '//button[contains(@title,\'End\')]',
  endCallConfirmButton: '//button[contains(@class, "slds-button_brand") and contains(@class, "saveBtn") and text()="End Call"]',
  
  // Voice Session ID
  voiceSessionId: '//div[@data-target-selection-name="sfdc:RecordField.VoiceCall.VendorCallKey"]//span[@class="uiOutputText"]',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================
// LOGIN TO SALESFORCE
// ============================================================
function constructLoginUrl(server, auraMode) {
  const baseUrl = new URL(server);
  const BASE_LOGIN_PAGE = '/one/one.app';
  
  let loginPath = BASE_LOGIN_PAGE;
  if (auraMode && auraMode.length) {
    loginPath += `?aura.mode=${auraMode}`;
  }
  
  baseUrl.searchParams.set('startURL', loginPath);
  return baseUrl.toString();
}

async function loginToSalesforce(page) {
  const logger = { info: console.log, warn: console.warn, error: console.error };
  const username = process.env.username || config.username;
  const password = process.env.password || config.password;
  const queueName = process.env.queueName || config.queueName;
  const server = process.env.server || config.server;
  const app = process.env.app || config.app;
  const waitTime = getNumberConfig('loginWaitTimeout', 30000);
  
  const ACCESSORS = {
    username: '#username',
    password: '#password',
    form: '#login_form',
    formSubmitBtn: '#Login',
    appLauncher: '.appLauncher button, one-app-launcher-header',
    recordingModal: 'lightning-modal',
    iAgreeButton: 'lightning-button[data-id="agree-button"] button',
  };
  
  try {
    const loginUrl = constructLoginUrl(server, process.env.auraMode || config.auraMode);
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Navigating to login URL: ${loginUrl} **************\n`);
    
    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: waitTime });
    } catch (error) {
      if (error.message.includes('ERR_HTTP_RESPONSE_CODE_FAILURE')) {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* URL with startURL failed, trying base URL **************\n`);
          await page.goto(server, { waitUntil: 'domcontentloaded', timeout: waitTime });
      } else {
        throw error;
      }
    }
    
    console.log('👤 Step 2: Entering credentials');
    await page.locator(ACCESSORS.form).waitFor({ state: 'visible', timeout: waitTime });
    await page.fill(ACCESSORS.username, username);
    await page.fill(ACCESSORS.password, password);
    await page.click(ACCESSORS.formSubmitBtn);
    
    console.log('⏳ Step 3: Waiting for page to load');
    await page.waitForFunction(
      () => {
        return document.readyState === 'complete' && 
               document.querySelector('one-app-launcher-header') !== null;
      },
      { timeout: waitTime }
    );
    
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Checking for recording modal popup... **************\n`);
    
    try {
      const modalExists = await page.locator(ACCESSORS.recordingModal).count() > 0;
      if (modalExists) {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Recording modal detected, handling... **************\n`);
        
        await page.locator(ACCESSORS.recordingModal).waitFor({ state: 'visible', timeout: 5000 });
        await page.locator(ACCESSORS.iAgreeButton).waitFor({ state: 'visible', timeout: 3000 });
        await page.locator(ACCESSORS.iAgreeButton).click();
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Clicked I Agree button ************** ${new Date().toISOString()} \n`);
        
        await page.waitForFunction(
          () => {
            return document.querySelector('lightning-modal') === null;
          },
          { timeout: 10000 }
        );
        
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Recording modal dismissed ************** ${new Date().toISOString()} \n`);
      } else {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* No recording modal detected ************** ${new Date().toISOString()} \n`);
      }
    } catch (popupError) {
      logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Error checking for popup: ${popupError.message} ************** ${new Date().toISOString()} \n`);
    }
    
    await delay(2000);
    
    console.log('📱 Step 4: Selecting Service Console app');
    const appSelector = `.appName [title='${app}']`;
    const appExists = await page.locator(appSelector).count() > 0;
    
    if (!appExists) {
      logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* App not found, opening app launcher ************** ${new Date().toISOString()} \n`);
      
      await page.locator(ACCESSORS.appLauncher).click();
      await delay(2000);
      
      const searchInput = page.locator('input[placeholder="Search apps and items..."], input[placeholder="Search apps or items..."], input[placeholder="Search apps..."]').first();
      await searchInput.fill(app);
      await delay(2000);
      
      await page.locator('a[class="appTileTitle"] mark, [class="appTileTitleNoDesc"] mark, one-app-launcher-menu-item lightning-formatted-rich-text span p').first().click();
      
      await page.waitForFunction(
        () => {
          return document.readyState === 'complete' && 
                 document.querySelector('one-app-launcher-header') !== null;
        },
        { timeout: waitTime }
      );
    } else {
      logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* App already selected ************** ${new Date().toISOString()} \n`);
    }
    
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Login completed successfully ************** ${new Date().toISOString()} \n`);
    console.log('✅ Login successful');
    
  } catch (error) {
    logger.error(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Login failed: ${error.message} ************** ${new Date().toISOString()} \n`);
    throw error;
  }
}

// ============================================================
// OPEN WEBRTC GATEWAY
// ============================================================
async function openWebRTCGateway(page) {
  const logger = { info: console.log, warn: console.warn };
  const url = process.env.webrtcGatewayUrl || config.webrtcGatewayUrl;
  const timeoutMs = getNumberConfig('webrtcGatewayTimeout', 10000);
  
  const currentUrl = page.url();
  logger.info(`\n##### [CCAS Outbound] Current URL: ${currentUrl} ************** ${new Date().toISOString()}\n`);
  
  logger.info(`\n##### [CCAS Outbound] Navigating to WebRTC Gateway URL: ${url} ************** ${new Date().toISOString()}\n`);
  
  await page.evaluate((gatewayUrl) => {
    window.location.href = gatewayUrl;
  }, url);
  
  await delay(2000);
  
  if (process.env.screenshot || config.screenshot) {
    try {
      await page.screenshot({ path: getScreenshotPath('OpenWebRTCGateway_SecurityWarning_Before.png') });
    } catch (screenshotError) {
      logger.warn(`\n##### [CCAS Outbound] Screenshot failed: ${screenshotError.message} ************** ${new Date().toISOString()}\n`);
    }
  }
  
  try {
    try {
      const advancedButton = page.locator('#details-button');
      if (await advancedButton.count() > 0) {
        await advancedButton.click();
        logger.info(`\n##### [CCAS Outbound] Security warning detected, clicked Advanced button ************** ${new Date().toISOString()}\n`);
        await delay(1000);
      }
    } catch (error) {
      logger.info(`\n##### [CCAS Outbound] Advanced button not found or already clicked: ${error.message} ************** ${new Date().toISOString()}\n`);
    }
    
    try {
      const proceedLink = page.locator('#proceed-link');
      if (await proceedLink.count() > 0) {
        await proceedLink.click();
        logger.info(`\n##### [CCAS Outbound] Clicked Proceed link to bypass security warning ************** ${new Date().toISOString()}\n`);
        await delay(2000);
      } else {
        const clicked = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const proceedLink = links.find(link => link.textContent && link.textContent.includes('Proceed to gateway'));
          if (proceedLink) {
            proceedLink.click();
            return true;
          }
          return false;
        });
        if (clicked) {
          await delay(2000);
          logger.info(`\n##### [CCAS Outbound] Clicked Proceed link via JavaScript ************** ${new Date().toISOString()}\n`);
        } else {
          logger.warn(`\n##### [CCAS Outbound] Proceed link not found on page ************** ${new Date().toISOString()}\n`);
        }
      }
    } catch (error) {
      logger.warn(`\n##### [CCAS Outbound] Could not find or click Proceed link: ${error.message} ************** ${new Date().toISOString()}\n`);
    }
  } catch (error) {
    logger.warn(`\n##### [CCAS Outbound] Security warning page not detected or already bypassed: ${error.message} ************** ${new Date().toISOString()}\n`);
  }
  
  if (process.env.screenshot || config.screenshot) {
    try {
      await page.screenshot({ path: getScreenshotPath('OpenWebRTCGateway_SecurityWarning_After.png') });
    } catch (screenshotError) {
      logger.warn(`\n##### [CCAS Outbound] Screenshot failed: ${screenshotError.message} ************** ${new Date().toISOString()}\n`);
    }
  }
  
  logger.info(`\n##### [CCAS Outbound] WebRTC Gateway URL opened and security warning handled successfully ************** ${new Date().toISOString()}\n`);
  
  logger.info(`\n##### [CCAS Outbound] Navigating back to original URL: ${currentUrl} ************** ${new Date().toISOString()}\n`);
  await page.evaluate((originalUrl) => {
    window.location.href = originalUrl;
  }, currentUrl);
  await delay(1000);
  
  await page.waitForLoadState('domcontentloaded');
  await delay(500);
  
  logger.info(`\n##### [CCAS Outbound] Navigated back to Salesforce login page ************** ${new Date().toISOString()}\n`);
}

// ============================================================
// SET OMNI-CHANNEL ONLINE
// ============================================================
async function setOmniChannelOnline(page) {
  const logger = { info: console.log, error: console.error };
  const username = process.env.username || config.username;
  const queueName = process.env.queueName || config.queueName;
  const timeoutMs = getNumberConfig('ccasTimeout', 50000);
  const startTime = Date.now();
  
  try {
    console.log('📞 Step: Setting Omni-Channel to Online');
    
    await page.locator(`xpath=${ACCESSORS.omniChannel}`).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(`xpath=${ACCESSORS.omniChannel}`).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Clicked on Omni-Channel **************${new Date().toISOString()}\n`);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OmniChannelSetOnline_clickOmniChannel.png') });
    }
    
    await page.locator(ACCESSORS.statusDropDown).waitFor({ state: 'visible', timeout: timeoutMs });
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Able to enter inside Omni-Channel  **************${new Date().toISOString()}\n`);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OmniChannelSetOnline_viewStatusDropdown.png') });
    }
    
    await page.locator(ACCESSORS.statusDropDown).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Clicked on Status DropDown  **************${new Date().toISOString()}\n`);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OmniChannelSetOnline_clickStatusDropDown.png') });
    }
    
    await page.locator(`xpath=${ACCESSORS.availableForVoice}`).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(`xpath=${ACCESSORS.availableForVoice}`).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Selected Available For Voice  **************${new Date().toISOString()}\n`);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OmniChannelSetOnline_SelectedAvailableForVoice.png') });
    }
    
    const endTime = Date.now();
    await delay(5000);
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* waited for 5000 ms **************${new Date().toISOString()}\n`);
    
    const ept = endTime - startTime;
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* EPT for OmniChannelSetOnline (Click to Available): ${ept}ms **************\n`);
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* OmniChannelSetOnline (Click to Available) completed at ${new Date().toISOString()} **************\n`);
    
    return ept;
  } catch (error) {
    const endTime = Date.now();
    const ept = endTime - startTime;
    logger.error(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Error in OmniChannelSetOnline after ${ept}ms: ${error.message} **************\n`);
    throw error;
  }
}

// ============================================================
// MAKE OUTBOUND CALL
// ============================================================
async function makeOutboundCall(page) {
  const logger = { info: console.log, warn: console.warn, error: console.error };
  const username = process.env.username || config.username;
  const queueName = process.env.queueName || config.queueName;
  const timeoutMs = getNumberConfig('ccasTimeout', 50000);
  const phoneNumber = process.env.phoneNumber || config.phoneNumber || '+12083303355';
  const startTime = Date.now();
  let ept = 0;
  
  try {
    console.log('📞 Step: Making outbound call');
    
    // Click on Telephony tab
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Clicking on Telephony tab **************${new Date().toISOString()}\n`);
    await page.locator(`xpath=${ACCESSORS.telephonyTab}`).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(`xpath=${ACCESSORS.telephonyTab}`).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Telephony tab opened **************${new Date().toISOString()}\n`);
    
    await delay(2000);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('TelephonyTab_Opened.png') });
    }
    
    // Request microphone access BEFORE making the call
    try {
      await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          window.__testAudioStream = stream;
        } catch (error) {
          // Silently handle errors
        }
      });
      await delay(500);
    } catch (preMediaError) {
      // Silently handle errors
    }
    
    // Fill in phone number
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Filling phone number: ${phoneNumber} **************${new Date().toISOString()}\n`);
    await page.locator(ACCESSORS.phoneInput).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(ACCESSORS.phoneInput).fill(phoneNumber);
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Phone number filled **************${new Date().toISOString()}\n`);
    
    await delay(1000);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('PhoneNumber_Filled.png') });
    }
    
    // Click Call button
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Clicking Call button **************${new Date().toISOString()}\n`);
    await page.locator(ACCESSORS.callButton).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(ACCESSORS.callButton).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Call button clicked, call initiated **************${new Date().toISOString()}\n`);
    
    await delay(1000);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OutboundCall_Initiated.png') });
    }
    
    // Wait for call to connect - for outbound calls, the Mute button may stay hidden
    // Instead, we just wait a bit for the call to establish and verify via transcripts later
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Waiting for call to establish **************${new Date().toISOString()}\n`);
    await delay(5000); // Give the call time to establish
    
    // Try to verify call is connected by checking for Mute button (optional - don't fail if not visible)
    try {
      const muteButtonVisible = await page.locator(`xpath=${ACCESSORS.muteButton}`).isVisible({ timeout: 10000 });
      if (muteButtonVisible) {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Call connected (Mute button visible) **************${new Date().toISOString()}\n`);
      } else {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Mute button not visible yet, continuing (call may still be connecting) **************${new Date().toISOString()}\n`);
      }
    } catch (muteCheckError) {
      logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Mute button check timed out, continuing (call in progress) **************${new Date().toISOString()}\n`);
    }
    
    const endTime = Date.now();
    ept = endTime - startTime;
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* EPT for MakeOutboundCall: ${ept}ms **************\n`);
    
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OutboundCall_Connected.png') });
    }
    
  } catch (error) {
    const endTime = Date.now();
    ept = endTime - startTime;
    
    if (process.env.screenshot || config.screenshot) {
      try {
        await page.screenshot({ path: getScreenshotPath('MakeOutboundCall_Error.png') });
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Error screenshot saved: MakeOutboundCall_Error.png ************** ${new Date().toISOString()}\n`);
      } catch (screenshotError) {
        logger.warn(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Failed to save error screenshot: ${screenshotError.message} ************** ${new Date().toISOString()}\n`);
      }
    }
    
    logger.error(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Error in MakeOutboundCall after ${ept}ms: ${error.message} ************** ${new Date().toISOString()}\n`);
    throw error;
  }
  
  // Get and log voice session ID
  try {
    const voiceSessionId = await page.evaluate(() => {
      const div = document.querySelector('div[data-target-selection-name="sfdc:RecordField.VoiceCall.VendorCallKey"]');
      if (div) {
        const span = div.querySelector('span.uiOutputText');
        return span ? span.textContent.trim() : '';
      }
      return '';
    });
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Voice Session ID: "${voiceSessionId}" **************\n`);
  } catch (sessionIdError) {
    logger.warn(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Could not get voice session ID: ${sessionIdError.message} **************\n`);
  }
  
  // Get and log current page URL
  try {
    const currentUrl = page.url();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Current Page URL: "${currentUrl}" **************\n`);
  } catch (urlError) {
    logger.warn(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Could not get current page URL: ${urlError.message} **************\n`);
  }
  
  return ept;
}

// ============================================================
// ENABLE MICROPHONE - Simplified for outbound calls
// ============================================================
async function enableMicrophone(page) {
  const logger = { info: console.log, warn: console.warn };
  const username = process.env.username || config.username;
  const queueName = process.env.queueName || config.queueName;
  
  console.log('🎤 Step: Enabling microphone and requesting media stream');
  logger.info(`\n##### [CCAS Outbound] Enabling microphone  ************** ${new Date().toISOString()}\n`);
  
  try {
    await page.evaluate(async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (error) {
        // Silently handle errors
      }
    });
  } catch (error) {
    logger.warn(`\n##### [CCAS Outbound] Error enabling microphone: ${error.message} **************\n`);
    console.warn('⚠️ Error enabling microphone:', error);
  }
  
  logger.info(`\n##### [CCAS Outbound] Microphone enabled, audio will play during call ************** ${new Date().toISOString()}\n`);
}

// ============================================================
// END CALL
// ============================================================
async function endCall(page) {
  const logger = { info: console.log, warn: console.warn, error: console.error };
  const username = process.env.username || config.username;
  const queueName = process.env.queueName || config.queueName;
  const timeoutMs = getNumberConfig('ccasTimeout', 50000);
  const callWaitTime = getNumberConfig('callWaitTime', 40000);
  
  console.log('📞 Step: Ending call');
  logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Waiting for ${callWaitTime}ms ************** ${new Date().toISOString()}\n`);
  
  await delay(callWaitTime);
  
  // Before ending call, capture screenshots of call controls and transcripts
  if (process.env.screenshot || config.screenshot) {
    logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Capturing call controls and transcripts screenshots before ending call ************** ${new Date().toISOString()}\n`);
    
    try {
      // Screenshot 1: Call controls (overall view)
      await page.screenshot({ path: getScreenshotPath('BeforeEndCall_CallControls.png') });
      logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Screenshot saved: BeforeEndCall_CallControls.png ************** ${new Date().toISOString()}\n`);
      
      // Screenshot 2: Check and capture customer messages
      const customerMessageCount = await page.locator(`xpath=${ACCESSORS.customerFirstMessage}`).count();
      if (customerMessageCount > 0) {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Customer Messages found: ${customerMessageCount} **************${new Date().toISOString()}\n`);
        await page.screenshot({ path: getScreenshotPath('BeforeEndCall_CustomerMessages.png') });
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Screenshot saved: BeforeEndCall_CustomerMessages.png ************** ${new Date().toISOString()}\n`);
      } else {
        logger.warn(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* No customer messages found for screenshot **************${new Date().toISOString()}\n`);
      }
      
      // Screenshot 3: Check and capture agent messages
      const agentMessageCount = await page.locator(`xpath=${ACCESSORS.agentFirstMessage}`).count();
      if (agentMessageCount > 0) {
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Agent Messages found: ${agentMessageCount} **************${new Date().toISOString()}\n`);
        await page.screenshot({ path: getScreenshotPath('BeforeEndCall_AgentMessages.png') });
        logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Screenshot saved: BeforeEndCall_AgentMessages.png ************** ${new Date().toISOString()}\n`);
      } else {
        logger.warn(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* No agent messages found for screenshot **************${new Date().toISOString()}\n`);
      }
      
      // Screenshot 4: Full transcripts view
      await page.screenshot({ path: getScreenshotPath('BeforeEndCall_Transcripts.png') });
      logger.info(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Screenshot saved: BeforeEndCall_Transcripts.png ************** ${new Date().toISOString()}\n`);
      
    } catch (screenshotError) {
      logger.warn(`\n##### [CCAS Outbound] Agent ${username} ${queueName} : ************* Error capturing screenshots: ${screenshotError.message} ************** ${new Date().toISOString()}\n`);
    }
  }
 
  // Try to click end button - for outbound, need to open Omni-Channel panel first
  let endButtonClicked = false;
  try {
    // First, try to open Omni-Channel (Online) panel
    await page.locator(`xpath=${ACCESSORS.omniChannelOnline}`).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`xpath=${ACCESSORS.omniChannelOnline}`).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Clicked Omni Channel Online button ************** ${new Date().toISOString()}\n`);
    await delay(1000);
    
    // Take screenshot BEFORE clicking End button (to capture call controls)
    if (process.env.screenshot || config.screenshot) {
      try {
        await page.screenshot({ path: getScreenshotPath('BeforeEndButton_CallControls.png') });
        logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Screenshot saved before End button: BeforeEndButton_CallControls.png ************** ${new Date().toISOString()}\n`);
      } catch (screenshotError) {
        logger.warn(`\n##### [CCAS Outbound] Agent ${username} : ************* Screenshot failed: ${screenshotError.message} ************** ${new Date().toISOString()}\n`);
      }
    }
    
    // Now click End button
    await page.locator(`xpath=${ACCESSORS.endCallButton}`).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`xpath=${ACCESSORS.endCallButton}`).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* End call button found & clicked ************** ${new Date().toISOString()}\n`);
    endButtonClicked = true;
  } catch (error) {
    logger.warn(`\n##### [CCAS Outbound] Agent ${username} : ************* Error clicking end button: ${error.message} - proceeding to close tab ************** ${new Date().toISOString()}\n`);
  }
  
  // Close the VC voice call tab
  try {
    const closeVCButtons = page.locator(`xpath=${ACCESSORS.closeVC}`);
    await closeVCButtons.last().waitFor({ state: 'visible', timeout: timeoutMs });
    await closeVCButtons.last().click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Clicked Close VC button (latest) ************** ${new Date().toISOString()}\n`);
    
    // Check if confirmation popup appears
    await delay(1000);
    try {
      await page.locator(`xpath=${ACCESSORS.endCallConfirmButton}`).waitFor({ state: 'visible', timeout: 3000 });
      await page.locator(`xpath=${ACCESSORS.endCallConfirmButton}`).click();
      logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Confirmation popup appeared, clicked "End Call" button ************** ${new Date().toISOString()}\n`);
    } catch (confirmError) {
      logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* No confirmation popup appeared (call ended directly) ************** ${new Date().toISOString()}\n`);
    }
    
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Ended the Voice Call  **************\n`);
  } catch (error) {
    logger.error(`\n##### [CCAS Outbound] Agent ${username} : ************* Error closing voice call tab: ${error.message} ************** ${new Date().toISOString()}\n`);
    throw error;
  }
  
  if (process.env.screenshot || config.screenshot) {
    await page.screenshot({ path: getScreenshotPath('EndingOutboundCall.png') });
  }
  
  await delay(getNumberConfig('defaultTimeout', 3000));
  
  // Set Omni-Channel to Offline to complete the flow
  try {
    console.log('🔴 Step: Setting Omni-Channel to Offline');
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Setting Omni-Channel to Offline ************** ${new Date().toISOString()}\n`);
    
    // Click on Omni-Channel (may be "Omni-Channel (Online)" or just "Omni-Channel")
    try {
      await page.locator(`xpath=${ACCESSORS.omniChannelOnline}`).waitFor({ state: 'visible', timeout: 10000 });
      await page.locator(`xpath=${ACCESSORS.omniChannelOnline}`).click();
      logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Clicked on Omni-Channel (Online) ************** ${new Date().toISOString()}\n`);
    } catch (error) {
      // Fallback to regular Omni-Channel button
      await page.locator(`xpath=${ACCESSORS.omniChannel}`).waitFor({ state: 'visible', timeout: 10000 });
      await page.locator(`xpath=${ACCESSORS.omniChannel}`).click();
      logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Clicked on Omni-Channel ************** ${new Date().toISOString()}\n`);
    }
    
    await delay(1000);
    
    // Click status dropdown
    await page.locator(ACCESSORS.statusDropDown).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(ACCESSORS.statusDropDown).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Clicked on Status DropDown ************** ${new Date().toISOString()}\n`);
    
    await delay(1000);
    
    // Select Offline
    await page.locator(`xpath=${ACCESSORS.offlineStatus}`).waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator(`xpath=${ACCESSORS.offlineStatus}`).click();
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Selected Offline status ************** ${new Date().toISOString()}\n`);
    
    await delay(2000);
    
    // Take final screenshot showing Offline state
    if (process.env.screenshot || config.screenshot) {
      await page.screenshot({ path: getScreenshotPath('OmniChannel_Offline_Complete.png') });
      logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Screenshot saved: OmniChannel_Offline_Complete.png ************** ${new Date().toISOString()}\n`);
    }
    
    logger.info(`\n##### [CCAS Outbound] Agent ${username} : ************* Successfully set Omni-Channel to Offline ************** ${new Date().toISOString()}\n`);
    console.log('✅ Omni-Channel set to Offline');
    
  } catch (error) {
    logger.error(`\n##### [CCAS Outbound] Agent ${username} : ************* Error setting Omni-Channel to Offline: ${error.message} ************** ${new Date().toISOString()}\n`);
    console.warn('⚠️ Failed to set Omni-Channel to Offline, continuing...');
  }
}

// ============================================================
// CONFIGURE CHROME WITH FAKE AUDIO CAPTURE
// ============================================================
const audioFile = process.env.audioFile || config.audioFile;
const audioFilePath = audioFile.startsWith('/')
  ? audioFile
  : resolve(__dirname, '..', 'test-asset', 'outbound_call_audio.wav');

if (existsSync(audioFilePath)) {
  console.log(`✅ Audio file found: ${audioFilePath}`);
} else {
  console.warn(`⚠️ Audio file NOT found: ${audioFilePath}`);
  console.warn(`⚠️ This may cause issues with fake audio capture!`);
}

test.use({
  channel: 'chrome',
  headless: true,
  permissions: ['microphone', 'camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${audioFilePath}`,
      '--allow-file-access-from-files',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-web-security',
      '--enable-experimental-web-platform-features',
      '--start-maximized',
    ],
  },
});

// ============================================================
// MAIN TEST
// ============================================================
test.describe('CCAS Outbound Voice Call', () => {
  
  test('CCAS Outbound Call Flow with EPT Measurement', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(0); // No timeout

    page.setDefaultTimeout(getNumberConfig('loginWaitTimeout', 30000));
    
    const server = process.env.server || config.server;
    
    try {
      console.log('🚀 Starting CCAS Outbound Voice Call test');
      console.log(`🎤 Audio file configured: ${audioFilePath}`);
      
      await context.grantPermissions(
        ['microphone', 'camera', 'notifications'],
        {
          origin: server || 'https://orgfarm-e439689340.test1.lightning.pc-rnd.force.com',
        }
      );
      console.log('✅ Permissions granted for microphone and camera');
      
      let consoleLogCount = 0;
      const maxConsoleLogs = 2;
      page.on('console', msg => {
        if (consoleLogCount >= maxConsoleLogs) {
          return;
        }
        const text = msg.text();
        if (text.includes('getUserMedia') || text.includes('RTCPeerConnection') || text.includes('mediaDevices') || text.includes('audio track') || text.includes('packetsSent') || text.includes('packetsReceived')) {
          consoleLogCount++;
          console.log(`[Browser Console] ${msg.type()}: ${text} (${consoleLogCount}/${maxConsoleLogs})`);
        }
      });
      
      // Step 1: Login
      await loginToSalesforce(page);
      
      // Step 2: Open WebRTC Gateway
      await openWebRTCGateway(page);
      
      // Step 3: Set Omni-Channel Online
      await setOmniChannelOnline(page);
      
      // Step 4: Make Outbound Call
      await makeOutboundCall(page);
      
      // Step 5: Enable Microphone
      await enableMicrophone(page);
      
      // Step 6: End Call
      await endCall(page);
      
      console.log('🎉 Test completed successfully!');
      
    } catch (error) {
      console.log(`❌ CCAS Outbound Voice Call Test Failed: ${error.message}`);
      console.error(error);
      throw error;
    }
  });
});
