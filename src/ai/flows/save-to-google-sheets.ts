'use server';
/**
 * @fileOverview This file defines a Genkit flow to save extracted form data to Google Sheets.
 *
 * It handles authentication, checking for an existing sheet, creating a new sheet if one doesn't exist,
 * clearing old data, and appending new data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { ExtractDataOutput } from '@/ai/schemas/form-extraction-schemas';

// Define input schema
const SheetDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  data: z.array(z.any()), // Keeping it flexible for various form data shapes
  createdAt: z.string(),
});

const SaveSheetInputSchema = z.object({
  sheet: SheetDataSchema,
  accessToken: z.string().describe('Google OAuth access token for the user.'),
});
type SaveSheetInput = z.infer<typeof SaveSheetInputSchema>;

// Define output schema
const SaveSheetOutputSchema = z.object({
  spreadsheetId: z.string(),
  spreadsheetUrl: z.string(),
});
type SaveSheetOutput = z.infer<typeof SaveSheetOutputSchema>;

// Define the main exported function
export async function saveSheet(input: SaveSheetInput): Promise<SaveSheetOutput> {
  return saveToGoogleSheetsFlow(input);
}

// Helper function to get an authenticated Google Sheets API client
async function getAuthenticatedClient(accessToken: string) {
  console.log('🔐 Authentication Debug:');
  console.log('Access token received:', accessToken ? `Yes (length: ${accessToken.length})` : 'No');
  
  if (!accessToken) {
    throw new Error('No access token provided');
  }

  const oAuth2Client = new OAuth2Client();
  
  try {
    oAuth2Client.setCredentials({ 
      access_token: accessToken
    });

    // Verify the token is valid
    const tokenInfo = await oAuth2Client.getTokenInfo(accessToken);
    console.log('✅ Token is valid:', tokenInfo);
    
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    return { sheets, drive };
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    throw new Error(`Invalid access token: ${error.message}`);
  }
}

const saveToGoogleSheetsFlow = ai.defineFlow(
  {
    name: 'saveToGoogleSheetsFlow',
    inputSchema: SaveSheetInputSchema,
    outputSchema: SaveSheetOutputSchema,
  },
  async ({ sheet, accessToken }) => {
    console.log('🚀 Starting Google Sheets save flow...');
    
    try {
      const { sheets, drive } = await getAuthenticatedClient(accessToken);
      console.log('✅ Authentication successful');
      
      let spreadsheetId: string | undefined;

      // 1. Search for existing spreadsheet
      try {
        console.log('🔍 Searching for existing spreadsheet...');
        const searchResponse = await drive.files.list({
          q: `name='${sheet.name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
          fields: 'files(id, name)',
        });
        console.log('📁 Search results:', searchResponse.data.files);

        if (searchResponse.data.files && searchResponse.data.files.length > 0) {
          spreadsheetId = searchResponse.data.files[0].id!;
          console.log('✅ Found existing spreadsheet:', spreadsheetId);
        } else {
          // 2. Create new spreadsheet
          console.log('📝 Creating new spreadsheet...');
          const createResponse = await sheets.spreadsheets.create({
            resource: {
              properties: {
                title: sheet.name,
              },
            },
            fields: 'spreadsheetId',
          });
          spreadsheetId = createResponse.data.spreadsheetId!;
          console.log('✅ Created new spreadsheet:', spreadsheetId);
        }
      } catch (driveError) {
        console.error('❌ Drive API error:', driveError);
        throw new Error(`Drive API failed: ${driveError.message}. Please ensure Google Drive API is enabled.`);
      }
      
      if (!spreadsheetId) {
        throw new Error('Failed to create or find spreadsheet.');
      }

      // 3. Clear existing data
      try {
        console.log('🧹 Clearing existing data...');
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: 'Sheet1',
        });
        console.log('✅ Sheet cleared successfully');
      } catch (clearError) {
        console.warn('⚠️ Could not clear sheet (might be empty):', clearError);
      }

      // 4. Append new data
      if (sheet.data.length > 0) {
        console.log('📊 Appending new data...');
        const headers = Object.keys(sheet.data[0]).filter(key => key !== 'others');
        const values = sheet.data.map(row => {
          return headers.map(header => (row as any)[header] ?? '');
        });
        const dataToAppend = [headers, ...values];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Sheet1!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: dataToAppend,
          },
        });
        console.log('✅ Data appended successfully');
      }

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      console.log('🎉 Save completed successfully!');

      return { spreadsheetId, spreadsheetUrl };
    } catch (error) {
      console.error('💥 Overall save error:', error);
      throw error;
    }
  }
);