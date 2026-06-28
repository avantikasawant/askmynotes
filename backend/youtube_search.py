import os
import httpx

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

async def search_youtube_video(topic: str) -> dict:
    if not YOUTUBE_API_KEY:
        return {"error": "YouTube API key not configured"}

    # More targeted educational query
    query = f"{topic} explained lecture tutorial"

    async with httpx.AsyncClient() as client:
        resp = await client.get(YOUTUBE_SEARCH_URL, params={
            "part": "snippet",
            "q": query,
            "type": "video",
            "videoDuration": "short",
            "maxResults": 3,
            "relevanceLanguage": "en",
            "videoEmbeddable": "true",
            "safeSearch": "strict",
            "key": YOUTUBE_API_KEY,
        })

    data = resp.json()
    items = data.get("items", [])
    if not items:
        return {"error": "No video found"}

    item = items[0]
    video_id = item["id"]["videoId"]
    snippet = item["snippet"]
    return {
        "video_id": video_id,
        "title": snippet["title"],
        "channel": snippet["channelTitle"],
        "thumbnail": snippet["thumbnails"]["medium"]["url"],
        "embed_url": f"https://www.youtube.com/embed/{video_id}?autoplay=0",
        "watch_url": f"https://www.youtube.com/watch?v={video_id}",
    }
