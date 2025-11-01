import { config } from 'dotenv';
config();

import '@/ai/flows/improve-extraction-accuracy-with-llm.ts';
import '@/ai/flows/extract-data-from-handwritten-form.ts';
import '@/ai/flows/translate-extracted-text.ts';
import '@/ai/flows/save-to-google-sheets.ts';
