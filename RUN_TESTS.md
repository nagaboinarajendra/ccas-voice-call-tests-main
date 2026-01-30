# How to Run and Check Tests

## Prerequisites
- Node.js >= 18.10.0 ✅ (You have v23.11.0)
- npm >= 9.1.0 ✅ (You have 10.9.2)
- Dependencies installed ✅

## Running Tests

### Option 1: Using npm script (Recommended)
```bash
npm test
```

### Option 2: Using Playwright directly
```bash
npx playwright test
```

### Option 3: Run specific test file
```bash
npx playwright test test-plans/playwright/CCASVoiceCall.spec.js
```

## Setting Environment Variables

Since we're using `process.env.username` and `process.env.password`, you can set them:

### On macOS/Linux:
```bash
export username="ria2@salesforce.com"
export password="123456"
npm test
```

### Or inline:
```bash
username="ria2@salesforce.com" password="123456" npm test
```

### Using .env file (if using dotenv):
Create a `.env` file:
```
username=ria2@salesforce.com
password=123456
```

## Verifying Configuration

### 1. Check config file structure:
```bash
cat workload-metadata/CCASVoiceCall.json | jq '.tasks[0].scripts[0].arguments'
```

### 2. Verify test file exists:
```bash
ls -la test-plans/playwright/CCASVoiceCall.spec.js
```

### 3. Verify audio file exists:
```bash
ls -la test-plans/test-asset/roleplay_padded_30secSilence.wav
```

### 4. Check Playwright config:
```bash
cat playwright.config.js
```

## Running with FPSx

When running with FPSx, it will:
1. Read `workload-metadata/CCASVoiceCall.json`
2. Inject `username` and `password` as environment variables
3. Pass other arguments from the `arguments` section
4. Execute the test script

## Troubleshooting

### If you see module resolution errors:
- Make sure `hps-playwright-core` is installed: `npm list hps-playwright-core`
- If it's a private package, ensure you're authenticated to the npm registry

### If credentials fail:
- Check that `process.env.username` and `process.env.password` are set
- Fallback to config file values if env vars not set

### If audio file not found:
- Verify path: `test-plans/test-asset/roleplay_padded_30secSilence.wav`
- Check file exists: `ls -la test-plans/test-asset/`
