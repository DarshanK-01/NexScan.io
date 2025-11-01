
'use server';

import { extractData } from '@/ai/flows/extract-data-from-handwritten-form';
import { translateData } from '@/ai/flows/translate-extracted-text';
import type { ExtractDataOutput } from '@/ai/schemas/form-extraction-schemas';
import { saveSheet } from '@/ai/flows/save-to-google-sheets';
import type { Sheet } from '@/app/page';

export type FormState = {
  data: ExtractDataOutput | null;
  error: string | null;
};

export type GoogleSheetSaveState = {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  error: string | null;
};

export async function extractDataFromImage(
  photoDataUri: string
): Promise<FormState> {
  if (!photoDataUri) {
    return { data: null, error: 'No image data provided.' };
  }

  try {
    const extractedData = await extractData({ photoDataUri });
    return { data: extractedData, error: null };
  } catch (e) {
    console.error('Error extracting data from image:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during data extraction.';
    return { data: null, error: errorMessage };
  }
}

export async function translateExtractedData(
  data: ExtractDataOutput,
  targetLanguage: string
): Promise<FormState> {
  if (!data) {
    return { data: null, error: 'No data provided for translation.' };
  }

  try {
    const translatedData = await translateData({ data, targetLanguage });
    return { data: translatedData, error: null };
  } catch (e) {
    console.error('Error translating data:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during translation.';
    return { data: null, error: errorMessage };
  }
}

export async function saveSheetToGoogleSheets(
  sheet: Sheet,
  accessToken: string
): Promise<GoogleSheetSaveState> {
  if (!sheet) {
    return { spreadsheetId: null, spreadsheetUrl: null, error: 'No sheet data provided.' };
  }

  try {
    const result = await saveSheet({ sheet, accessToken });
    if (!result) {
      throw new Error('No result from saveSheet flow.');
    }
    return { spreadsheetId: result.spreadsheetId, spreadsheetUrl: result.spreadsheetUrl, error: null };
  } catch (e) {
    console.error('Error saving to Google Sheets:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred while saving sheet.';
    return { spreadsheetId: null, spreadsheetUrl: null, error: errorMessage };
  }
}
