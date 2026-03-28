#!/usr/bin/env node

/**
 * Google Calendar Setup Script
 * 
 * This script helps you set up Google Calendar integration by:
 * 1. Creating the credentials file template
 * 2. Guiding you through the Google Cloud Console setup
 * 3. Generating the authentication URL
 * 4. Saving the access token
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DATA_DIR = path.join(__dirname, '../data');
const CREDENTIALS_PATH = path.join(DATA_DIR, 'calendar-credentials.json');
const TOKEN_PATH = path.join(DATA_DIR, 'calendar-token.json');

console.log(`
╔════════════════════════════════════════════════════════════╗
║     Google Calendar Setup for Appointment Voice Agent      ║
╚════════════════════════════════════════════════════════════╝

This script will help you set up Google Calendar integration.

Steps:
1. Create a Google Cloud Project
2. Enable Google Calendar API
3. Create OAuth2 credentials
4. Authenticate and save token

Let's get started!
`);

async function main() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if credentials already exist
  if (fs.existsSync(CREDENTIALS_PATH)) {
    console.log('✓ Credentials file already exists.');
    const answer = await askQuestion('Do you want to re-authenticate? (yes/no): ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('Using existing credentials.');
      await authenticateWithExistingCredentials();
      return;
    }
  }

  console.log(`
┌────────────────────────────────────────────────────────────┐
│ Step 1: Create Google Cloud Project                        │
└────────────────────────────────────────────────────────────┘

1. Go to: https://console.cloud.google.com/projectcreate
2. Enter a project name (e.g., "Appointment Voice Agent")
3. Click "Create"

Press Enter when you've created the project...`);
  
  await waitForEnter();

  console.log(`
┌────────────────────────────────────────────────────────────┐
│ Step 2: Enable Google Calendar API                         │
└────────────────────────────────────────────────────────────┘

1. Go to: https://console.cloud.google.com/apis/library/calendar.googleapis.com
2. Make sure your project is selected
3. Click "Enable"

Press Enter when you've enabled the API...`);

  await waitForEnter();

  console.log(`
┌────────────────────────────────────────────────────────────┐
│ Step 3: Create OAuth2 Credentials                          │
└────────────────────────────────────────────────────────────┘

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the consent screen:
   - User Type: External
   - App name: Appointment Voice Agent
   - User support email: your email
   - Developer contact: your email
   - Save and continue (leave other fields default)
   - Add your email as a test user
4. For Application type, select "Desktop app"
5. Name: "Appointment Voice Agent Desktop"
6. Click "Create"
7. Click "Download JSON"
8. Save the file as: ${CREDENTIALS_PATH}

Press Enter when you've downloaded the credentials...`);

  await waitForEnter();

  // Check if credentials file exists
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`\n❌ Error: Credentials file not found at ${CREDENTIALS_PATH}`);
    console.log('Please make sure you saved the credentials file to the correct location.');
    process.exit(1);
  }

  console.log('✓ Credentials file found!');
  
  await authenticateWithExistingCredentials();
}

async function authenticateWithExistingCredentials() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  // Use the redirect URI from credentials file (usually http://localhost)
  const redirectUri = redirect_uris[0] || 'http://localhost';

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    redirect_uri: redirectUri
  });

  console.log(`
┌────────────────────────────────────────────────────────────┐
│ Step 4: Authenticate                                       │
└────────────────────────────────────────────────────────────┘

Your credentials file has this redirect URI: ${redirectUri}

Open this URL in your browser:

${authUrl}

IMPORTANT: After you select your email and authorize, the browser will redirect to ${redirectUri}
which will show an error page (ERR_CONNECTION_REFUSED). This is NORMAL!

Just copy the CODE from the URL in the address bar. It looks like:
${redirectUri}?code=4/0A...LONG_CODE...&scope=...

Paste only the code part (everything between 'code=' and '&').`);

  const code = await askQuestion('\nEnter the authorization code: ');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log(`\n✓ Token saved to: ${TOKEN_PATH}`);
    console.log('\n✅ Google Calendar setup complete!');
    console.log('You can now run the appointment voice agent.');
  } catch (error) {
    console.error('\n❌ Error getting token:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you copied the entire code from the URL');
    console.log('2. The code may have expired - try again with a fresh URL');
    console.log('3. Make sure there are no extra spaces in the code');
    process.exit(1);
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function waitForEnter() {
  return new Promise((resolve) => {
    rl.question('', resolve);
  });
}

main().then(() => {
  rl.close();
}).catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
