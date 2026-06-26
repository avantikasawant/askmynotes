import os
import httpx

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

async def search_youtube_video(topic: str) -> dict:
    """Search YouTube for a short explanatory video on the topic."""
    if not YOUTUBE_API_KEY:
        return {"error": "YouTube API key not configured"}

    query = f"{topic} explained simply short"

    async with httpx.AsyncClient() as client:
        resp = await client.get(YOUTUBE_SEARCH_URL, params={
            "part": "snippet",
            "q": query,
            "type": "video",
            "videoDuration": "short",   # under 4 minutes
            "maxResults": 1,
            "relevanceLanguage": "en",
            "key": YOUTUBE_API_KEY,
        })

    data = resp.json()
    items = data.get("items", [])

    if not items:
        return {"error": "No video found for this topic"}

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
