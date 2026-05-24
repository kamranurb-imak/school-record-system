import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// System prompt for diary extraction — stable, will be cached
export const DIARY_EXTRACTION_SYSTEM = `You are a school diary record extractor. You will be given an image of a handwritten school attendance/comment diary page.

Your task is to extract the data into structured JSON. The diary has:
- Rows: student GR numbers or serial numbers (1, 2, 3... or STD-001, STD-002...)
- Columns: subject names (Math, English, Science, etc.)
- Cells: a comment/status written by the subject teacher

Map each cell value to the closest comment code from this list:
EXCELLENT, GOOD, FINE, AVERAGE, HW_NOT_DONE, COPY_MISSING, SLEEPING, MISBEHAVIOR, ABSENT, LATE

Rules:
- If a cell is clearly empty or the student was present with no remark, use null
- If you cannot read a cell clearly, set confidence to "low"
- For all other cells, set confidence to "high" or "medium"
- Return ONLY valid JSON, no explanation text

Output format:
{
  "date": "YYYY-MM-DD or null if not visible",
  "subjects": ["Math", "English", ...],
  "rows": [
    {
      "row_label": "1 or STD-001",
      "cells": [
        { "subject": "Math", "code": "GOOD", "raw_text": "Good", "confidence": "high" },
        { "subject": "English", "code": "COPY_MISSING", "raw_text": "copy mis", "confidence": "medium" },
        { "subject": "Science", "code": null, "raw_text": "", "confidence": "high" }
      ]
    }
  ]
}`

export async function extractDiaryFromImage(imageBase64: string, mimeType: string): Promise<any> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: DIARY_EXTRACTION_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract all student records from this diary page.',
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON returned by Claude')
  return JSON.parse(jsonMatch[0])
}
