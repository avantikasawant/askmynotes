import os
import json
from groq import Groq
from rag_pipeline import get_top_chunks

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

QUESTION_COUNT = {"easy": 5, "medium": 7, "hard": 10}

DIFFICULTY_INSTRUCTIONS = {
    "easy":   "Questions should test basic recall. Use simple, clear language.",
    "medium": "Mix recall and application. Moderate complexity.",
    "hard":   "Test deep understanding and analysis. Use nuanced distractors requiring careful thinking.",
}

def generate_quiz(difficulty: str = "medium") -> dict:
    content = get_top_chunks(k=10)
    if not content.strip():
        return {"error": "No notes have been uploaded yet."}

    count = QUESTION_COUNT.get(difficulty, 7)

    prompt = f"""You are a quiz generator for college students.
Based ONLY on the following lecture notes, generate exactly {count} multiple-choice questions at {difficulty} difficulty.
{DIFFICULTY_INSTRUCTIONS.get(difficulty, '')}

Return ONLY valid JSON with this structure:
{{
  "questions": [
    {{
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "1-2 sentences explaining why the correct answer is right"
    }}
  ]
}}

Rules: options must have exactly 4 items. correct_index is 0-based.

Lecture notes:
{content}"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.5,
    )

    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse quiz response."}
