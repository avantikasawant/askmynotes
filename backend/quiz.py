import os
import json
from groq import Groq
from rag_pipeline import get_top_chunks

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

QUIZ_PROMPT = """You are a quiz generator for college students.
Based ONLY on the following lecture notes content, generate exactly 5 multiple-choice questions.

Return ONLY valid JSON (no markdown, no commentary, no code fences) in this exact format:
{{
  "questions": [
    {{
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string"
    }}
  ]
}}

Rules:
- "options" must have exactly 4 items
- "correct_index" is the 0-based index of the correct option
- "explanation" is a short (1-2 sentence) reason why that option is correct, written for a student reviewing the answer
- Questions must be answerable from the content below

Lecture notes content:
{content}
"""


def generate_quiz() -> dict:
    content = get_top_chunks(k=6)

    if not content.strip():
        return {"error": "No notes have been uploaded yet."}

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": QUIZ_PROMPT.format(content=content)}],
        # Forces strict JSON output, avoiding markdown fences that break json.loads
        response_format={"type": "json_object"},
        temperature=0.5,
    )

    raw = response.choices[0].message.content

    try:
        quiz_data = json.loads(raw)
    except json.JSONDecodeError:
        return {"error": "Failed to parse quiz response from model."}

    return quiz_data
